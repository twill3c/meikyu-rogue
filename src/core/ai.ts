// 敵 AI(F-06)— LOS + 距離で発見、以後は貪欲一歩の追跡。全探索は 1 歩なので有界
import { idx, tileAt } from "@/core/dungeon";
import { hasLos } from "@/core/fov";
import { randInt } from "@/core/rng";
import type { Enemy, FloorMap, Pos, RngState } from "@/core/types";

export const ENEMY_NAMES: Record<Enemy["kind"], string> = {
  slime: "スライム",
  goblin: "ゴブリン",
  ogre: "オーガ",
};

const ALERT_RANGE = 8; // マンハッタン距離(F-06)

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export interface EnemyPhaseResult {
  enemies: Enemy[];
  playerHp: number;
  rng: RngState;
  messages: string[];
}

/**
 * 全敵の 1 ターン。プレイヤー行動の後に呼ばれる(F-05 のターン順)。
 * 追跡: プレイヤー現在位置への貪欲一歩(距離の大きい軸を優先、塞がっていれば代替軸)。
 */
export function enemyPhase(
  floor: FloorMap,
  enemies: Enemy[],
  playerPos: Pos,
  playerDef: number,
  playerHp: number,
  rng: RngState,
): EnemyPhaseResult {
  let hp = playerHp;
  let s = rng;
  const messages: string[] = [];
  const next: Enemy[] = enemies.map((e) => ({ ...e, pos: { ...e.pos } }));
  const occupied = new Set<number>(next.map((e) => idx(floor.width, e.pos)));

  for (const e of next) {
    if (!e.alert && manhattan(e.pos, playerPos) <= ALERT_RANGE && hasLos(floor, e.pos, playerPos)) {
      e.alert = true;
    }
    if (!e.alert || hp <= 0) continue;

    if (manhattan(e.pos, playerPos) === 1) {
      let bonus: number;
      [bonus, s] = randInt(s, 0, 1);
      const dmg = Math.max(1, e.atk - playerDef) + bonus;
      hp -= dmg;
      messages.push(`${ENEMY_NAMES[e.kind]}から ${dmg} のダメージを受けた`);
      continue;
    }

    const dx = Math.sign(playerPos.x - e.pos.x);
    const dy = Math.sign(playerPos.y - e.pos.y);
    const preferX = Math.abs(playerPos.x - e.pos.x) >= Math.abs(playerPos.y - e.pos.y);
    const candidates: Pos[] = (
      preferX
        ? [
            { x: dx, y: 0 },
            { x: 0, y: dy },
          ]
        : [
            { x: 0, y: dy },
            { x: dx, y: 0 },
          ]
    ).filter((d) => d.x !== 0 || d.y !== 0);
    // プレイヤーと軸整列している場合、直進が塞がれたら垂直 2 方向で回り込む(T-042)
    if (dy === 0) candidates.push({ x: 0, y: 1 }, { x: 0, y: -1 });
    if (dx === 0) candidates.push({ x: 1, y: 0 }, { x: -1, y: 0 });

    for (const d of candidates) {
      const n = { x: e.pos.x + d.x, y: e.pos.y + d.y };
      const key = idx(floor.width, n);
      if (tileAt(floor, n) !== "floor") continue;
      if (occupied.has(key)) continue;
      if (n.x === playerPos.x && n.y === playerPos.y) continue;
      occupied.delete(idx(floor.width, e.pos));
      e.pos = n;
      occupied.add(key);
      break;
    }
  }

  return { enemies: next, playerHp: hp, rng: s, messages };
}
