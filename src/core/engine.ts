// ターンエンジン(F-05)— step(state, action) は純関数。
// 乱数状態は GameState.rng で持ち回り、同一入力 → 同一出力を保証する(F-01)。

import { ENEMY_NAMES, enemyPhase } from "@/core/ai";
import { MAX_DEPTH, generateFloor, idx, tileAt } from "@/core/dungeon";
import { computeFov } from "@/core/fov";
import { randInt, seedRng } from "@/core/rng";
import type { Enemy, FloorMap, Item, Pos, RngState } from "@/core/types";

export const FOV_RADIUS = 6;
export const POTION_HEAL = 8;
export const PLAYER_START = { maxHp: 24, atk: 4, def: 0 } as const;

export type Action =
  | { type: "move"; dx: number; dy: number }
  | { type: "wait" }
  | { type: "descend" }
  | { type: "quaff" };

export interface Player {
  pos: Pos;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  potions: number;
}

export type GameStatus = "playing" | "victory" | "defeat";

export interface GameState {
  seed: number;
  depth: number;
  floor: FloorMap;
  /** 拾われる前のアイテムと生存中の敵(floor の初期配置から複製して持つ) */
  items: Item[];
  enemies: Enemy[];
  player: Player;
  rng: RngState;
  turn: number;
  status: GameStatus;
  messages: string[];
  visible: Set<number>;
  explored: Set<number>;
}

/** 任意の階から状態を作る(テストは手組みの FloorMap を渡す) */
export function initState(floor: FloorMap, seed: number, depth: number): GameState {
  const visible = computeFov(floor, floor.entry, FOV_RADIUS);
  return {
    seed,
    depth,
    floor,
    items: floor.items.map((i) => ({ ...i, pos: { ...i.pos } })),
    enemies: floor.enemies.map((e) => ({ ...e, pos: { ...e.pos } })),
    player: {
      pos: { ...floor.entry },
      hp: PLAYER_START.maxHp,
      maxHp: PLAYER_START.maxHp,
      atk: PLAYER_START.atk,
      def: PLAYER_START.def,
      potions: 0,
    },
    rng: seedRng(Math.imul(seed, 0x85ebca6b) ^ (depth * 977)),
    turn: 0,
    status: "playing",
    messages: [`B${depth} に降り立った`],
    visible,
    explored: new Set(visible),
  };
}

export function newGame(seed: number): GameState {
  return initState(generateFloor(seed, 1), seed, 1);
}

function withMessage(state: GameState, msg: string): GameState {
  return { ...state, messages: [...state.messages, msg] };
}

/** 階を降りる(F-09)。プレイヤーの成長は持ち越し、盤面・敵・視界を作り直す */
function descend(state: GameState): GameState {
  const depth = state.depth + 1;
  const floor = generateFloor(state.seed, depth);
  const fresh = initState(floor, state.seed, depth);
  return {
    ...fresh,
    player: { ...state.player, pos: { ...floor.entry } },
    turn: state.turn + 1,
    messages: [...state.messages, `階段を降りた — B${depth}`],
  };
}

interface PlayerPhase {
  state: GameState;
  turnConsumed: boolean;
}

function playerPhase(state: GameState, action: Action): PlayerPhase {
  const p = state.player;

  if (action.type === "wait") {
    return { state, turnConsumed: true };
  }

  if (action.type === "quaff") {
    if (p.potions <= 0) {
      return { state: withMessage(state, "回復薬を持っていない"), turnConsumed: false };
    }
    const hp = Math.min(p.maxHp, p.hp + POTION_HEAL);
    return {
      state: {
        ...withMessage(state, `回復薬を飲んだ(HP ${p.hp}→${hp})`),
        player: { ...p, hp, potions: p.potions - 1 },
      },
      turnConsumed: true,
    };
  }

  if (action.type === "descend") {
    const st = state.floor.stairs;
    if (st && p.pos.x === st.x && p.pos.y === st.y) {
      return { state: descend(state), turnConsumed: false };
    }
    return { state: withMessage(state, "ここに階段はない"), turnConsumed: false };
  }

  // --- move ---
  const target = { x: p.pos.x + action.dx, y: p.pos.y + action.dy };
  if (
    target.x < 0 ||
    target.y < 0 ||
    target.x >= state.floor.width ||
    target.y >= state.floor.height ||
    tileAt(state.floor, target) !== "floor"
  ) {
    return { state: withMessage(state, "壁がある"), turnConsumed: false };
  }

  const foe = state.enemies.find((e) => e.pos.x === target.x && e.pos.y === target.y);
  if (foe) {
    const [bonus, rng] = randInt(state.rng, 0, 1);
    const dmg = Math.max(1, p.atk - foe.def) + bonus;
    const hp = foe.hp - dmg;
    const name = ENEMY_NAMES[foe.kind];
    if (hp <= 0) {
      return {
        state: {
          ...withMessage(state, `${name}を倒した`),
          rng,
          enemies: state.enemies.filter((e) => e.id !== foe.id),
        },
        turnConsumed: true,
      };
    }
    return {
      state: {
        ...withMessage(state, `${name}に ${dmg} のダメージ`),
        rng,
        enemies: state.enemies.map((e) => (e.id === foe.id ? { ...e, hp } : e)),
      },
      turnConsumed: true,
    };
  }

  // 移動 + 自動取得(F-08)
  let next: GameState = { ...state, player: { ...p, pos: target } };
  const item = next.items.find((i) => i.pos.x === target.x && i.pos.y === target.y);
  if (item) {
    next = { ...next, items: next.items.filter((i) => i !== item) };
    const np = next.player;
    if (item.kind === "potion") {
      next = { ...withMessage(next, "回復薬を拾った"), player: { ...np, potions: np.potions + 1 } };
    } else if (item.kind === "sword") {
      next = { ...withMessage(next, "剣を手に入れた(atk+2)"), player: { ...np, atk: np.atk + 2 } };
    } else if (item.kind === "shield") {
      next = { ...withMessage(next, "盾を手に入れた(def+1)"), player: { ...np, def: np.def + 1 } };
    } else {
      // 魂珠(F-09)— 取得した瞬間に勝利
      next = { ...withMessage(next, "魂珠を手に入れた — 勝利!"), status: "victory" };
    }
  }
  return { state: next, turnConsumed: true };
}

/** 1 ターン進める。status が playing 以外なら state をそのまま返す(F-09) */
export function step(state: GameState, action: Action): GameState {
  if (state.status !== "playing") return state;

  const { state: afterPlayer, turnConsumed } = playerPhase(state, action);
  if (!turnConsumed || afterPlayer.status !== "playing") return afterPlayer;

  const phase = enemyPhase(
    afterPlayer.floor,
    afterPlayer.enemies,
    afterPlayer.player.pos,
    afterPlayer.player.def,
    afterPlayer.player.hp,
    afterPlayer.rng,
  );

  const hp = phase.playerHp;
  const status: GameStatus = hp <= 0 ? "defeat" : "playing";
  const visible = computeFov(afterPlayer.floor, afterPlayer.player.pos, FOV_RADIUS);
  const explored = new Set(afterPlayer.explored);
  for (const v of visible) explored.add(v);

  return {
    ...afterPlayer,
    enemies: phase.enemies,
    player: { ...afterPlayer.player, hp },
    rng: phase.rng,
    turn: afterPlayer.turn + 1,
    status,
    messages: [
      ...afterPlayer.messages,
      ...phase.messages,
      ...(status === "defeat" ? ["力尽きた…"] : []),
    ],
    visible,
    explored,
  };
}

export { MAX_DEPTH };
