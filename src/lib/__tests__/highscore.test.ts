import { describe, expect, it } from "vitest";
import {
  HIGHSCORE_KEY,
  MAX_ENTRIES,
  loadHighScores,
  recordHighScore,
} from "@/lib/highscore";
import type { ScoreEntry, StorageLike } from "@/lib/highscore";

function fakeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

function entry(score: number, over: Partial<ScoreEntry> = {}): ScoreEntry {
  return { score, depth: 1, kills: 0, turn: 10, seed: 1, ts: 1000, ...over };
}

// T-090: 空ストレージ
describe("T-090 空ストレージ", () => {
  it("load は空配列を返す", () => {
    expect(loadHighScores(fakeStorage())).toEqual([]);
  });
});

// T-091: score 降順で保存
describe("T-091 降順保存", () => {
  it("record した複数件が score 降順で並ぶ", () => {
    const s = fakeStorage();
    recordHighScore(s, entry(50));
    recordHighScore(s, entry(200));
    recordHighScore(s, entry(120));
    const scores = loadHighScores(s).map((e) => e.score);
    expect(scores).toEqual([200, 120, 50]);
  });
});

// T-092: 上位 10 件を維持
describe("T-092 件数上限", () => {
  it("11 件目で最下位が落ちる", () => {
    const s = fakeStorage();
    for (let i = 1; i <= 11; i++) recordHighScore(s, entry(i * 10));
    const scores = loadHighScores(s).map((e) => e.score);
    expect(scores).toHaveLength(MAX_ENTRIES);
    expect(scores[0]).toBe(110);
    expect(scores.at(-1)).toBe(20); // 最下位の 10 が落ちた
  });
});

// T-093: 同点は先着優先
describe("T-093 同点の順位", () => {
  it("同点なら既存エントリが上位に残る", () => {
    const s = fakeStorage();
    recordHighScore(s, entry(100, { seed: 111 }));
    recordHighScore(s, entry(100, { seed: 222 }));
    const list = loadHighScores(s);
    expect(list[0].seed).toBe(111);
    expect(list[1].seed).toBe(222);
  });
});

// T-094: 破損データへの防御
describe("T-094 破損フォールバック", () => {
  it("不正 JSON は空扱いで例外を投げない", () => {
    const s = fakeStorage({ [HIGHSCORE_KEY]: "{oops" });
    expect(loadHighScores(s)).toEqual([]);
  });
  it("型不一致のエントリは捨てる", () => {
    const bad = JSON.stringify([{ score: "high" }, entry(70), 42]);
    const s = fakeStorage({ [HIGHSCORE_KEY]: bad });
    expect(loadHighScores(s).map((e) => e.score)).toEqual([70]);
  });
  it("破損後の record で正常データに復旧する", () => {
    const s = fakeStorage({ [HIGHSCORE_KEY]: "{oops" });
    recordHighScore(s, entry(30));
    expect(loadHighScores(s).map((e) => e.score)).toEqual([30]);
  });
});

// T-095: rank の戻り値
describe("T-095 rank", () => {
  it("トップ更新で rank=1", () => {
    const s = fakeStorage();
    recordHighScore(s, entry(10));
    const { rank } = recordHighScore(s, entry(999));
    expect(rank).toBe(1);
  });
  it("圏外なら rank=null で保存もされない", () => {
    const s = fakeStorage();
    for (let i = 1; i <= 10; i++) recordHighScore(s, entry(100 + i));
    const { rank, scores } = recordHighScore(s, entry(1));
    expect(rank).toBeNull();
    expect(scores.map((e) => e.score)).not.toContain(1);
  });
});
