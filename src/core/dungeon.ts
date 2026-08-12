// ダンジョン生成器(F-02)+ 到達可能性検証(F-03)
// すべての探索・リトライは予算付き(AGENTS.md §4)。検証に落ちた階は返さない。

import { randInt } from "@/core/rng";
import { seedRng } from "@/core/rng";
import type {
  Enemy,
  EnemyKind,
  FloorMap,
  Item,
  Pos,
  Rect,
  RngState,
  TileKind,
} from "@/core/types";

export const FLOOR_WIDTH = 44;
export const FLOOR_HEIGHT = 26;
export const MAX_DEPTH = 5;

const MIN_ROOMS = 6;
const MAX_ROOMS = 10;
const ROOM_PLACE_BUDGET = 200; // 部屋配置の試行上限(F-02)
const FLOOR_RETRY_BUDGET = 20; // 階の作り直し上限(F-02)
const SPAWN_TRY_BUDGET = 100; // 敵・アイテム配置の試行上限
const ENEMY_MIN_DIST = 6; // 入口からの最低マンハッタン距離(初手で殴られない)

const ENEMY_STATS: Record<EnemyKind, { hp: number; atk: number; def: number }> = {
  slime: { hp: 6, atk: 2, def: 0 },
  goblin: { hp: 10, atk: 3, def: 1 },
  ogre: { hp: 16, atk: 5, def: 2 },
};

function enemyPool(depth: number): EnemyKind[] {
  if (depth <= 2) return ["slime", "goblin"];
  if (depth <= 4) return ["slime", "goblin", "ogre"];
  return ["goblin", "ogre"];
}

export function idx(width: number, p: Pos): number {
  return p.y * width + p.x;
}

export function tileAt(f: FloorMap, p: Pos): TileKind {
  return f.tiles[idx(f.width, p)];
}

function center(r: Rect): Pos {
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

function overlapsWithGap(a: Rect, b: Rect): boolean {
  // 1 マスの隔壁を確保する(部屋が癒着すると通路検証が緩むため)
  return (
    a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1
  );
}

/** entry から 4 方向で到達できる床タイルのインデックス集合(F-03 の検証器) */
export function reachableFrom(f: FloorMap, from: Pos): Set<number> {
  const seen = new Set<number>();
  if (tileAt(f, from) !== "floor") return seen;
  const queue: Pos[] = [from];
  seen.add(idx(f.width, from));
  while (queue.length > 0) {
    const p = queue.pop() as Pos;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= f.width || n.y >= f.height) continue;
      const key = idx(f.width, n);
      if (seen.has(key) || f.tiles[key] !== "floor") continue;
      seen.add(key);
      queue.push(n);
    }
  }
  return seen;
}

function carveRoom(tiles: TileKind[], r: Rect): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[y * FLOOR_WIDTH + x] = "floor";
    }
  }
}

function carveCorridor(tiles: TileKind[], from: Pos, to: Pos, horizontalFirst: boolean): void {
  const carve = (p: Pos) => {
    tiles[p.y * FLOOR_WIDTH + p.x] = "floor";
  };
  const stepX = (y: number) => {
    const dir = to.x > from.x ? 1 : -1;
    for (let x = from.x; x !== to.x + dir; x += dir) carve({ x, y });
  };
  const stepY = (x: number) => {
    const dir = to.y > from.y ? 1 : -1;
    for (let y = from.y; y !== to.y + dir; y += dir) carve({ x, y });
  };
  if (horizontalFirst) {
    stepX(from.y);
    stepY(to.x);
  } else {
    stepY(from.x);
    stepX(to.y);
  }
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 空き床タイルを 1 つ選ぶ。constraint を満たせない場合は予算消化後に制約を外して選ぶ */
function pickFreeFloor(
  rng: RngState,
  tiles: TileKind[],
  occupied: Set<number>,
  constraint?: (p: Pos) => boolean,
): [Pos, RngState] {
  let s = rng;
  let fallback: Pos | null = null;
  for (let i = 0; i < SPAWN_TRY_BUDGET; i++) {
    let x: number;
    let y: number;
    [x, s] = randInt(s, 1, FLOOR_WIDTH - 2);
    [y, s] = randInt(s, 1, FLOOR_HEIGHT - 2);
    const p = { x, y };
    const key = y * FLOOR_WIDTH + x;
    if (tiles[key] !== "floor" || occupied.has(key)) continue;
    if (!constraint || constraint(p)) return [p, s];
    fallback = fallback ?? p;
  }
  if (fallback) return [fallback, s];
  // 床は必ず存在する(部屋 6 室以上)ため、ここに来るのは占有だらけの異常時のみ
  throw new Error("pickFreeFloor: spawn budget exceeded");
}

function tryGenerate(rng: RngState, depth: number): [FloorMap | null, RngState] {
  let s = rng;
  const tiles: TileKind[] = new Array<TileKind>(FLOOR_WIDTH * FLOOR_HEIGHT).fill("wall");

  // --- 部屋配置(予算付き) ---
  let target: number;
  [target, s] = randInt(s, MIN_ROOMS, MAX_ROOMS);
  const rooms: Rect[] = [];
  for (let i = 0; i < ROOM_PLACE_BUDGET && rooms.length < target; i++) {
    let w: number, h: number, x: number, y: number;
    [w, s] = randInt(s, 4, 9);
    [h, s] = randInt(s, 3, 6);
    [x, s] = randInt(s, 1, FLOOR_WIDTH - w - 1);
    [y, s] = randInt(s, 1, FLOOR_HEIGHT - h - 1);
    const r = { x, y, w, h };
    if (rooms.some((o) => overlapsWithGap(o, r))) continue;
    rooms.push(r);
  }
  if (rooms.length < MIN_ROOMS) return [null, s];

  // --- 通路で順に接続(構成的に全部屋連結) ---
  for (const r of rooms) carveRoom(tiles, r);
  for (let i = 1; i < rooms.length; i++) {
    let coin: number;
    [coin, s] = randInt(s, 0, 1);
    carveCorridor(tiles, center(rooms[i - 1]), center(rooms[i]), coin === 0);
  }

  const entry = center(rooms[0]);
  const last = center(rooms[rooms.length - 1]);
  const stairs = depth < MAX_DEPTH ? last : null;

  const occupied = new Set<number>([idx(FLOOR_WIDTH, entry), idx(FLOOR_WIDTH, last)]);
  const items: Item[] = [];
  const enemies: Enemy[] = [];

  if (depth === MAX_DEPTH) items.push({ kind: "amulet", pos: last });

  // --- アイテム(F-08 の配置分。回復薬 2 / 剣 B2 / 盾 B3) ---
  const itemPlan: Item["kind"][] = ["potion", "potion"];
  if (depth === 2) itemPlan.push("sword");
  if (depth === 3) itemPlan.push("shield");
  for (const kind of itemPlan) {
    let p: Pos;
    [p, s] = pickFreeFloor(s, tiles, occupied);
    occupied.add(idx(FLOOR_WIDTH, p));
    items.push({ kind, pos: p });
  }

  // --- 敵(N-04: 2 + depth 体) ---
  const pool = enemyPool(depth);
  for (let i = 0; i < 2 + depth; i++) {
    let p: Pos;
    [p, s] = pickFreeFloor(s, tiles, occupied, (q) => manhattan(q, entry) >= ENEMY_MIN_DIST);
    occupied.add(idx(FLOOR_WIDTH, p));
    let k: number;
    [k, s] = randInt(s, 0, pool.length - 1);
    const kind = pool[k];
    const stats = ENEMY_STATS[kind];
    enemies.push({
      id: i + 1,
      kind,
      pos: p,
      hp: stats.hp,
      maxHp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      alert: false,
    });
  }

  const floor: FloorMap = {
    width: FLOOR_WIDTH,
    height: FLOOR_HEIGHT,
    tiles,
    rooms,
    entry,
    stairs,
    items,
    enemies,
  };

  // --- 出荷ゲート(F-03): 全床連結 = entry から全床へ到達可能 ---
  const reach = reachableFrom(floor, entry);
  const floorCount = tiles.filter((t) => t === "floor").length;
  if (reach.size !== floorCount) return [null, s];
  return [floor, s];
}

/**
 * 階を生成する(F-02)。シードと深さから決定的で、検証(F-03)に合格した階のみ返す。
 * 予算(FLOOR_RETRY_BUDGET)内で合格しなければ例外 — T-014 が予算の十分性を固定する。
 */
export function generateFloor(seed: number, depth: number): FloorMap {
  // シードと深さを混ぜて階ごとに独立した乱数列を得る(同一シード同一深さ → 同一の階)
  let s = seedRng(Math.imul(seed, 2654435761) ^ (depth * 0x1f1f1f1f));
  for (let i = 0; i < FLOOR_RETRY_BUDGET; i++) {
    const [floor, next] = tryGenerate(s, depth);
    s = next;
    if (floor) return floor;
  }
  throw new Error(`generateFloor: retry budget exceeded (seed=${seed}, depth=${depth})`);
}
