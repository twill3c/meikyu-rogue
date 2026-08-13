import { describe, expect, it } from "vitest";
import { initState, step } from "@/core/engine";
import type { GameState } from "@/core/engine";
import type { FloorMap } from "@/core/types";
import { openFloor } from "./fov.test";

function stateOn(floor: FloorMap, seed = 9): GameState {
  return initState(floor, seed, 1);
}

// T-050: 回復薬の自動取得
describe("T-050 回復薬の取得", () => {
  it("薬のマスへ移動すると potions +1 でアイテムが消える", () => {
    const f = openFloor();
    f.items = [{ kind: "potion", pos: { x: 2, y: 1 } }];
    const s2 = step(stateOn(f), { type: "move", dx: 1, dy: 0 });
    expect(s2.player.potions).toBe(1);
    expect(s2.items).toHaveLength(0);
  });
});

// T-051: quaff
describe("T-051 quaff", () => {
  it("HP+8(上限あり)で potions −1", () => {
    const s = stateOn(openFloor());
    const hurt: GameState = { ...s, player: { ...s.player, hp: 10, potions: 2 } };
    const s2 = step(hurt, { type: "quaff" });
    expect(s2.player.hp).toBe(18);
    expect(s2.player.potions).toBe(1);
    expect(s2.turn).toBe(hurt.turn + 1);
  });
  it("上限を超えて回復しない", () => {
    const s = stateOn(openFloor());
    const near: GameState = { ...s, player: { ...s.player, hp: s.player.maxHp - 2, potions: 1 } };
    const s2 = step(near, { type: "quaff" });
    expect(s2.player.hp).toBe(s.player.maxHp);
  });
  it("0 個なら不発でターン消費なし", () => {
    const s = stateOn(openFloor());
    const s2 = step(s, { type: "quaff" });
    expect(s2.turn).toBe(s.turn);
    expect(s2.messages.at(-1)).toContain("持っていない");
  });
});

// T-052: 剣・盾の取得
describe("T-052 装備の取得", () => {
  it("剣で atk+2、盾で def+1", () => {
    const f = openFloor();
    f.items = [
      { kind: "sword", pos: { x: 2, y: 1 } },
      { kind: "shield", pos: { x: 3, y: 1 } },
    ];
    let s = stateOn(f);
    const baseAtk = s.player.atk;
    const baseDef = s.player.def;
    s = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s.player.atk).toBe(baseAtk + 2);
    s = step(s, { type: "move", dx: 1, dy: 0 });
    expect(s.player.def).toBe(baseDef + 1);
  });
});

// T-060/T-061: 階段
describe("T-060/T-061 階段", () => {
  it("階段上で descend すると depth+1 の新しい階へ", () => {
    const f = openFloor();
    f.stairs = { ...f.entry };
    const s = stateOn(f);
    const s2 = step(s, { type: "descend" });
    expect(s2.depth).toBe(2);
    expect(s2.player.pos).toEqual(s2.floor.entry);
    expect(s2.floor).not.toBe(f);
    // 成長(atk など)は持ち越される
    expect(s2.player.maxHp).toBe(s.player.maxHp);
  });
  it("階段以外で descend は何も起きない", () => {
    const s = stateOn(openFloor()); // stairs は (w-2,h-2) で entry と異なる
    const s2 = step(s, { type: "descend" });
    expect(s2.depth).toBe(1);
    expect(s2.turn).toBe(s.turn);
    expect(s2.messages.at(-1)).toContain("階段はない");
  });
});

// T-062: 魂珠で勝利
describe("T-062 勝利", () => {
  it("魂珠のマスへ移動すると status=victory", () => {
    const f = openFloor();
    f.items = [{ kind: "amulet", pos: { x: 2, y: 1 } }];
    const s2 = step(stateOn(f), { type: "move", dx: 1, dy: 0 });
    expect(s2.status).toBe("victory");
  });
});

// T-063: 敗北時のメッセージ(HP0 以下 → defeat は T-026 で検証済み)
describe("T-063 敗北", () => {
  it("defeat 時に敗北メッセージが残る", () => {
    const f = openFloor();
    f.enemies = [
      { id: 1, kind: "ogre", pos: { x: 2, y: 1 }, hp: 99, maxHp: 99, atk: 99, def: 0, alert: true },
    ];
    const s2 = step(stateOn(f), { type: "wait" });
    expect(s2.status).toBe("defeat");
    expect(s2.messages.at(-1)).toContain("力尽きた");
  });
});

// T-064: 決着後の step は不変
describe("T-064 決着後の凍結", () => {
  it("victory 後の step は同一参照を返す", () => {
    const f = openFloor();
    f.items = [{ kind: "amulet", pos: { x: 2, y: 1 } }];
    const won = step(stateOn(f), { type: "move", dx: 1, dy: 0 });
    expect(step(won, { type: "wait" })).toBe(won);
  });
  it("defeat 後の step も同一参照を返す", () => {
    const f = openFloor();
    f.enemies = [
      { id: 1, kind: "ogre", pos: { x: 2, y: 1 }, hp: 99, maxHp: 99, atk: 99, def: 0, alert: true },
    ];
    const lost = step(stateOn(f), { type: "wait" });
    expect(lost.status).toBe("defeat");
    expect(step(lost, { type: "move", dx: 1, dy: 0 })).toBe(lost);
  });
});
