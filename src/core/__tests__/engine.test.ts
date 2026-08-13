import { describe, expect, it } from "vitest";
import { idx } from "@/core/dungeon";
import { initState, newGame, step } from "@/core/engine";
import type { Action, GameState } from "@/core/engine";
import type { Enemy, FloorMap } from "@/core/types";
import { openFloor } from "./fov.test";

function slime(id: number, x: number, y: number, over: Partial<Enemy> = {}): Enemy {
  return {
    id,
    kind: "slime",
    pos: { x, y },
    hp: 6,
    maxHp: 6,
    atk: 2,
    def: 0,
    alert: false,
    ...over,
  };
}

function stateOn(floor: FloorMap, seed = 1): GameState {
  return initState(floor, seed, 1);
}

// T-020: 壁方向へ move
describe("T-020 壁への移動", () => {
  it("位置・ターン不変でメッセージのみ", () => {
    const s = stateOn(openFloor());
    const s2 = step(s, { type: "move", dx: 0, dy: -1 }); // (1,1) の上は外周壁
    expect(s2.player.pos).toEqual(s.player.pos);
    expect(s2.turn).toBe(s.turn);
    expect(s2.messages.length).toBeGreaterThan(s.messages.length);
  });
});

// T-022: 床方向へ move
describe("T-022 床への移動", () => {
  it("1 マス動いて turn が +1", () => {
    const s = stateOn(openFloor());
    const s2 = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s2.player.pos).toEqual({ x: 2, y: 1 });
    expect(s2.turn).toBe(s.turn + 1);
  });
});

// T-021: 同一シード・同一アクション列の再生は同一結果
describe("T-021 リプレイ決定性", () => {
  it("newGame(seed) + 同一アクション列 → 深い等値", () => {
    const actions: Action[] = [
      { type: "move", dx: 1, dy: 0 },
      { type: "move", dx: 0, dy: 1 },
      { type: "wait" },
      { type: "move", dx: -1, dy: 0 },
      { type: "quaff" },
      { type: "move", dx: 0, dy: -1 },
    ];
    const run = () => actions.reduce((st, a) => step(st, a), newGame(4242));
    expect(run()).toEqual(run());
  });
});

// T-023: 敵のいるマスへ move は bump attack
describe("T-023 bump attack", () => {
  it("位置不変で敵 HP が減る", () => {
    const f = openFloor();
    f.enemies = [slime(1, 2, 1)];
    const s = stateOn(f);
    const s2 = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s2.player.pos).toEqual({ x: 1, y: 1 });
    expect(s2.enemies[0].hp).toBeLessThan(6);
    expect(s2.turn).toBe(s.turn + 1);
  });
});

// T-024: ダメージ幅は max(1, atk−def) + 0〜1
describe("T-024 ダメージ計算", () => {
  it("プレイヤー(atk4)→スライム(def0)のダメージは 4〜5", () => {
    const f = openFloor();
    f.enemies = [slime(1, 2, 1, { hp: 100, maxHp: 100 })];
    let s = stateOn(f);
    for (let i = 0; i < 10; i++) {
      const before = s.enemies[0].hp;
      s = step(s, { type: "move", dx: 1, dy: 0 });
      const dmg = before - s.enemies[0].hp;
      expect(dmg).toBeGreaterThanOrEqual(4);
      expect(dmg).toBeLessThanOrEqual(5);
    }
  });
});

// T-025: 敵 HP 0 で消滅
describe("T-025 敵の撃破", () => {
  it("敵が消え、kill メッセージが出る", () => {
    const f = openFloor();
    f.enemies = [slime(1, 2, 1, { hp: 1 })];
    const s = stateOn(f);
    const s2 = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s2.enemies).toHaveLength(0);
    expect(s2.messages.some((m) => m.includes("倒した"))).toBe(true);
  });
});

// T-026: 敵隣接で wait を繰り返すと defeat
describe("T-026 敗北", () => {
  it("HP が削られ 0 以下で status=defeat", () => {
    const f = openFloor();
    f.enemies = [slime(1, 2, 1, { atk: 30, alert: true })];
    let s = stateOn(f);
    s = step(s, { type: "wait" });
    expect(s.player.hp).toBeLessThanOrEqual(0);
    expect(s.status).toBe("defeat");
  });
});

// T-032: 一度見たタイルは explored に残る
describe("T-032 探索メモリ", () => {
  it("離れても explored に残り、visible からは外れる", () => {
    const f = openFloor(30, 10);
    let s = stateOn(f);
    const far = idx(f.width, { x: 4, y: 1 });
    expect(s.visible.has(far)).toBe(true);
    for (let i = 0; i < 12; i++) s = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s.visible.has(far)).toBe(false);
    expect(s.explored.has(far)).toBe(true);
  });
});
