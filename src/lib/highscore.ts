// ハイスコアのローカル保存(F-13)
// Storage 抽象を注入してテスト可能にする。localStorage への束縛は呼び出し側(UI)が行う。
// 破損データは空扱いにフォールバックし、例外で UI を壊さない。

export const HIGHSCORE_KEY = "meikyu-rogue.highscores.v1";
export const MAX_ENTRIES = 10;

export interface ScoreEntry {
  score: number;
  depth: number;
  kills: number;
  turn: number;
  seed: number;
  ts: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const NUMERIC_FIELDS: (keyof ScoreEntry)[] = ["score", "depth", "kills", "turn", "seed", "ts"];

function isValidEntry(v: unknown): v is ScoreEntry {
  if (typeof v !== "object" || v === null) return false;
  const rec = v as Record<string, unknown>;
  return NUMERIC_FIELDS.every((f) => typeof rec[f] === "number" && Number.isFinite(rec[f]));
}

/** 保存済みハイスコアを読む(T-090/094)。破損・型不一致は捨てて続行する */
export function loadHighScores(storage: StorageLike): ScoreEntry[] {
  let parsed: unknown;
  try {
    const raw = storage.getItem(HIGHSCORE_KEY);
    if (raw === null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidEntry);
}

/**
 * 決着 1 回分を記録する(F-13)。score 降順・同点は先着優先・上位 MAX_ENTRIES 件のみ保持。
 * 戻り値の rank は 1 始まりの順位、圏外なら null(その場合は保存内容も変わらない)。
 */
export function recordHighScore(
  storage: StorageLike,
  entry: ScoreEntry,
): { scores: ScoreEntry[]; rank: number | null } {
  const existing = loadHighScores(storage);
  // 同点は先着優先(T-093)— 挿入位置は「自分より真に小さい最初のエントリ」の直前
  let pos = existing.findIndex((e) => e.score < entry.score);
  if (pos === -1) pos = existing.length;
  const merged = [...existing.slice(0, pos), entry, ...existing.slice(pos)].slice(0, MAX_ENTRIES);
  const rank = pos < MAX_ENTRIES ? pos + 1 : null;
  if (rank !== null) {
    storage.setItem(HIGHSCORE_KEY, JSON.stringify(merged));
    return { scores: merged, rank };
  }
  return { scores: existing, rank: null };
}
