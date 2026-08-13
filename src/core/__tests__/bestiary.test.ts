import { describe, expect, it } from "vitest";
import { MAX_DEPTH, generateFloor } from "@/core/dungeon";
import { initState, step } from "@/core/engine";
import type { Enemy, EnemyKind, FloorMap } from "@/core/types";
import { openFloor } from "./fov.test";

function foe(kind: EnemyKind, x: number, y: number, over: Partial<Enemy> = {}): Enemy {
  const base: Record<EnemyKind, { hp: number; atk: number; def: number }> = {
    slime: { hp: 6, atk: 2, def: 0 },
    bat: { hp: 4, atk: 2, def: 0 },
    goblin: { hp: 10, atk: 3, def: 1 },
    ogre: { hp: 16, atk: 5, def: 2 },
    wraith: { hp: 12, atk: 4, def: 1 },
  };
  const s = base[kind];
  return { id: 1, kind, pos: { x, y }, hp: s.hp, maxHp: s.hp, atk: s.atk, def: s.def, alert: false, ...over };
}

// T-070: こうもりは 1 ターンに 2 マス接近
describe("T-070 こうもりの俊敏", () => {
  it("遠方から 1 ターンで 2 マス接近する", () => {
    const f = openFloor();
    f.enemies = [foe("bat", 7, 1)];
    const s2 = step(initState(f, 1, 1), { type: "wait" });
    expect(s2.enemies[0].pos).toEqual({ x: 5, y: 1 });
  });
});

// T-071: 距離 2 なら接近+攻撃を同一ターンに行うが、攻撃は 1 回だけ
describe("T-071 こうもりの接近攻撃", () => {
  it("1 歩接近して 1 回だけ攻撃する", () => {
    const f = openFloor();
    f.enemies = [foe("bat", 3, 1, { alert: true })];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "wait" });
    expect(s2.enemies[0].pos).toEqual({ x: 2, y: 1 });
    const hits = s2.messages.filter((m) => m.includes("こうもりから")).length;
    expect(hits).toBe(1);
    // ダメージは max(1, 2−0)+0〜1 = 2〜3 が 1 回分だけ
    const dmg = s.player.hp - s2.player.hp;
    expect(dmg).toBeGreaterThanOrEqual(2);
    expect(dmg).toBeLessThanOrEqual(3);
  });
});

// T-072: レイスは壁越しでも感知して接近する(移動は床上のみ)
describe("T-072 レイスの感知", () => {
  it("LOS がなくても alert になり床上を接近する", () => {
    const f = openFloor(20, 10);
    for (let y = 1; y < f.height - 1; y++) f.tiles[y * f.width + 5] = "wall";
    f.enemies = [foe("wraith", 8, 1)];
    const s2 = step(initState(f, 1, 1), { type: "wait" });
    expect(s2.enemies[0].alert).toBe(true);
    expect(s2.enemies[0].pos).not.toEqual({ x: 8, y: 1 });
    // 壁マスには入らない
    const p = s2.enemies[0].pos;
    expect(f.tiles[p.y * f.width + p.x]).toBe("floor");
  });
  it("同条件のゴブリン(LOS 必要)は動かない", () => {
    const f = openFloor(20, 10);
    for (let y = 1; y < f.height - 1; y++) f.tiles[y * f.width + 5] = "wall";
    f.enemies = [foe("goblin", 8, 1)];
    const s2 = step(initState(f, 1, 1), { type: "wait" });
    expect(s2.enemies[0].alert).toBe(false);
    expect(s2.enemies[0].pos).toEqual({ x: 8, y: 1 });
  });
});

// T-073: 深度別出現プール(SPEC 敵種テーブルが正本)
describe("T-073 出現プール", () => {
  const POOLS: Record<number, EnemyKind[]> = {
    1: ["slime", "goblin", "bat"],
    2: ["slime", "goblin", "bat"],
    3: ["slime", "goblin", "ogre", "bat"],
    4: ["goblin", "ogre", "bat", "wraith"],
    5: ["goblin", "ogre", "wraith"],
  };
  it("プール外の種は出現しない", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        const f = generateFloor(seed, depth);
        for (const e of f.enemies) {
          expect(POOLS[depth]).toContain(e.kind);
        }
      }
    }
  });
  it("B4〜B5 でレイスが少なくとも 1 回出現する", () => {
    let seen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const depth of [4, 5]) {
        seen += generateFloor(seed, depth).enemies.filter((e) => e.kind === "wraith").length;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

// T-080〜T-082: スコア
describe("T-080 撃破スコア", () => {
  it("スライム撃破で +5、kills +1", () => {
    const f = openFloor();
    f.enemies = [foe("slime", 2, 1, { hp: 1 })];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s2.enemies).toHaveLength(0);
    expect(s2.score).toBe(s.score + 5);
    expect(s2.kills).toBe(s.kills + 1);
  });
  it("レイス撃破で +30", () => {
    const f = openFloor();
    f.enemies = [foe("wraith", 2, 1, { hp: 1 })];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s2.score).toBe(s.score + 30);
  });
});

describe("T-081 降下スコア", () => {
  it("descend で +50、既存スコアに加算", () => {
    const f = openFloor();
    f.stairs = { ...f.entry };
    const s = initState(f, 1, 1);
    const scored = { ...s, score: 10 };
    const s2 = step(scored, { type: "descend" });
    expect(s2.depth).toBe(2);
    expect(s2.score).toBe(60);
  });
});

describe("T-082 勝利スコア", () => {
  it("暁の勾玉取得で +200 と victory", () => {
    const f = openFloor();
    f.items = [{ kind: "amulet", pos: { x: 2, y: 1 } }];
    const s = initState(f, 1, 1);
    const s2 = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s2.status).toBe("victory");
    expect(s2.score).toBe(s.score + 200);
  });
});

// T-083: スコアを含むリプレイ決定性は T-021 の deep-equal が担保するが、
// score フィールドの存在を明示的に固定する
describe("T-083 スコアの決定性", () => {
  it("初期 state に score/kills が 0 で存在する", () => {
    const s = initState(openFloor(), 1, 1);
    expect(s.score).toBe(0);
    expect(s.kills).toBe(0);
  });
});
