import { describe, expect, it } from "vitest";
import { initState, step } from "@/core/engine";
import type { Enemy, FloorMap } from "@/core/types";
import { openFloor } from "./fov.test";

function goblin(id: number, x: number, y: number, over: Partial<Enemy> = {}): Enemy {
  return {
    id,
    kind: "goblin",
    pos: { x, y },
    hp: 10,
    maxHp: 10,
    atk: 3,
    def: 1,
    alert: false,
    ...over,
  };
}

// T-040: LOS あり距離 ≤ 8 の敵は接近する
describe("T-040 追跡", () => {
  it("1 ターンで 1 マス接近する", () => {
    const f = openFloor();
    f.enemies = [goblin(1, 7, 1)];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "wait" });
    expect(s2.enemies[0].pos).toEqual({ x: 6, y: 1 });
    expect(s2.enemies[0].alert).toBe(true);
  });
});

// T-041: LOS なしの未発見敵は静止
describe("T-041 壁越しの敵", () => {
  it("壁の向こうの敵は動かない", () => {
    const f = openFloor(20, 10);
    for (let y = 1; y < f.height - 1; y++) f.tiles[y * f.width + 9] = "wall";
    f.enemies = [goblin(1, 12, 1)];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "wait" });
    expect(s2.enemies[0].pos).toEqual({ x: 12, y: 1 });
    expect(s2.enemies[0].alert).toBe(false);
  });
});

// T-042: 直進方向が壁なら代替軸で回り込む
describe("T-042 迂回", () => {
  it("x 軸が塞がれていれば y 軸で動く", () => {
    const f = openFloor(20, 10);
    // 敵(5,3) とプレイヤー(1,3) の間、x=3 の行 y=3 だけ壁にする
    f.tiles[3 * f.width + 3] = "wall";
    f.entry = { x: 1, y: 3 };
    f.enemies = [goblin(1, 4, 3, { alert: true })];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "wait" });
    // x 方向(4,3)→(3,3) は壁。y 軸のどちらかへ動いている
    expect(s2.enemies[0].pos.x).toBe(4);
    expect(s2.enemies[0].pos.y).not.toBe(3);
  });
});

// 補助: 敵同士は重ならない
describe("敵の衝突回避", () => {
  it("先に動いた敵のマスへは入らず待機する", () => {
    const f = openFloor();
    f.enemies = [goblin(1, 4, 1, { alert: true }), goblin(2, 5, 1, { alert: true })];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "wait" });
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    expect(key(s2.enemies[0].pos)).not.toBe(key(s2.enemies[1].pos));
  });
});
