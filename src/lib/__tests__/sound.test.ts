import { describe, expect, it } from "vitest";
import { initState, step } from "@/core/engine";
import type { GameState } from "@/core/engine";
import type { Enemy, EnemyKind, FloorMap } from "@/core/types";
import {
  SOUND_KEY,
  loadSoundEnabled,
  saveSoundEnabled,
  soundEventsForStep,
} from "@/lib/sound";
import type { StorageLike } from "@/lib/highscore";
import { openFloor } from "../../core/__tests__/fov.test";

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

function foe(kind: EnemyKind, x: number, y: number, over: Partial<Enemy> = {}): Enemy {
  return { id: 1, kind, pos: { x, y }, hp: 6, maxHp: 6, atk: 2, def: 0, alert: false, ...over };
}

function stateOn(floor: FloorMap): GameState {
  return initState(floor, 1, 1);
}

// T-100: デフォルト OFF
describe("T-100 デフォルト設定", () => {
  it("空ストレージでは false", () => {
    expect(loadSoundEnabled(fakeStorage())).toBe(false);
  });
});

// T-101: 永続化と破損防御
describe("T-101 設定の永続化", () => {
  it("save した値が load で往復する", () => {
    const s = fakeStorage();
    saveSoundEnabled(s, true);
    expect(loadSoundEnabled(s)).toBe(true);
    saveSoundEnabled(s, false);
    expect(loadSoundEnabled(s)).toBe(false);
  });
  it("壊れた保存値は false 扱い", () => {
    expect(loadSoundEnabled(fakeStorage({ [SOUND_KEY]: "banana" }))).toBe(false);
  });
});

// T-102: 遷移差分からのイベント導出
describe("T-102 イベント導出", () => {
  it("敵に命中 → attack", () => {
    const f = openFloor();
    f.enemies = [foe("goblin", 2, 1, { hp: 10, maxHp: 10, def: 0 })];
    const prev = stateOn(f);
    const next = step(prev, { type: "move", dx: 1, dy: 0 });
    expect(soundEventsForStep(prev, next)).toContain("attack");
  });
  it("撃破 → kill(attack は出ない)", () => {
    const f = openFloor();
    f.enemies = [foe("slime", 2, 1, { hp: 1 })];
    const prev = stateOn(f);
    const next = step(prev, { type: "move", dx: 1, dy: 0 });
    const ev = soundEventsForStep(prev, next);
    expect(ev).toContain("kill");
    expect(ev).not.toContain("attack");
  });
  it("被弾 → hurt、攻撃と併発する", () => {
    const f = openFloor();
    f.enemies = [foe("ogre", 2, 1, { hp: 99, maxHp: 99, atk: 5, def: 0, alert: true })];
    const prev = stateOn(f);
    const next = step(prev, { type: "move", dx: 1, dy: 0 }); // bump 攻撃 → 敵の反撃
    const ev = soundEventsForStep(prev, next);
    expect(ev).toContain("attack");
    expect(ev).toContain("hurt");
  });
  it("薬の拾得 → pickup、使用 → quaff", () => {
    const f = openFloor();
    f.items = [{ kind: "potion", pos: { x: 2, y: 1 } }];
    const prev = stateOn(f);
    const picked = step(prev, { type: "move", dx: 1, dy: 0 });
    expect(soundEventsForStep(prev, picked)).toContain("pickup");
    const hurt = { ...picked, player: { ...picked.player, hp: 5 } };
    const quaffed = step(hurt, { type: "quaff" });
    expect(soundEventsForStep(hurt, quaffed)).toContain("quaff");
  });
  it("装備の拾得 → pickup", () => {
    const f = openFloor();
    f.items = [{ kind: "sword", pos: { x: 2, y: 1 } }];
    const prev = stateOn(f);
    const next = step(prev, { type: "move", dx: 1, dy: 0 });
    expect(soundEventsForStep(prev, next)).toContain("pickup");
  });
  it("降階 → descend", () => {
    const f = openFloor();
    f.stairs = { ...f.entry };
    const prev = stateOn(f);
    const next = step(prev, { type: "descend" });
    expect(soundEventsForStep(prev, next)).toEqual(["descend"]);
  });
  it("勝利 → victory 単独(pickup を抑制)", () => {
    const f = openFloor();
    f.items = [{ kind: "amulet", pos: { x: 2, y: 1 } }];
    const prev = stateOn(f);
    const next = step(prev, { type: "move", dx: 1, dy: 0 });
    expect(soundEventsForStep(prev, next)).toEqual(["victory"]);
  });
  it("敗北 → defeat 単独(hurt を抑制)", () => {
    const f = openFloor();
    f.enemies = [foe("ogre", 2, 1, { hp: 99, maxHp: 99, atk: 99, def: 0, alert: true })];
    const prev = stateOn(f);
    const next = step(prev, { type: "wait" });
    expect(next.status).toBe("defeat");
    expect(soundEventsForStep(prev, next)).toEqual(["defeat"]);
  });
});

// T-103: 変化なし
describe("T-103 変化のない遷移", () => {
  it("壁バンプはイベントなし", () => {
    const prev = stateOn(openFloor());
    const next = step(prev, { type: "move", dx: 0, dy: -1 });
    expect(soundEventsForStep(prev, next)).toEqual([]);
  });
  it("同一参照はイベントなし", () => {
    const s = stateOn(openFloor());
    expect(soundEventsForStep(s, s)).toEqual([]);
  });
});
