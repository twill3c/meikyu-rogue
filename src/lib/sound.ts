// サウンド設定と効果音イベント導出(F-14)
// 設定はデフォルト OFF。イベントはメッセージ文字列ではなく GameState の遷移差分から
// 純関数で導出する(文言変更で壊れない)。実際の発音は audio.ts(ブラウザ専用)が担う。

import type { GameState } from "@/core/engine";
import type { StorageLike } from "@/lib/highscore";

export const SOUND_KEY = "meikyu-rogue.sound.v1";

export type SoundEvent =
  | "attack"
  | "hurt"
  | "kill"
  | "pickup"
  | "quaff"
  | "descend"
  | "victory"
  | "defeat";

/** サウンド設定を読む(T-100/101)。未保存・破損は false(デフォルト OFF) */
export function loadSoundEnabled(storage: StorageLike): boolean {
  try {
    return storage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveSoundEnabled(storage: StorageLike, enabled: boolean): void {
  storage.setItem(SOUND_KEY, enabled ? "on" : "off");
}

/**
 * 1 回の step(prev → next)で鳴らす効果音イベントを導出する(T-102/103)。
 * victory / defeat は他イベントを抑制して単独で返す(SPEC F-14)。
 */
export function soundEventsForStep(prev: GameState, next: GameState): SoundEvent[] {
  if (prev === next) return [];
  if (next.status !== prev.status) {
    if (next.status === "victory") return ["victory"];
    if (next.status === "defeat") return ["defeat"];
  }
  if (next.depth > prev.depth) return ["descend"];

  const events: SoundEvent[] = [];
  if (next.kills > prev.kills) {
    events.push("kill");
  } else {
    // 同一 id の敵の HP が下がっていれば命中
    const prevHp = new Map(prev.enemies.map((e) => [e.id, e.hp]));
    if (next.enemies.some((e) => (prevHp.get(e.id) ?? e.hp) > e.hp)) events.push("attack");
  }
  if (next.player.hp < prev.player.hp) events.push("hurt");
  if (
    next.player.potions > prev.player.potions ||
    next.player.atk > prev.player.atk ||
    next.player.def > prev.player.def
  ) {
    events.push("pickup");
  }
  if (next.player.potions < prev.player.potions) events.push("quaff");
  return events;
}
