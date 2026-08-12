// シード付き PRNG — mulberry32 の関数型版(F-01)
// 状態は number 1 個。next 系は [値, 次状態] を返し、呼び出し側が状態を持ち回る。
// core 内で Math.random() / Date.now() を呼ばないための唯一の乱数源。

import type { RngState } from "@/core/types";

/** シードから初期状態を作る。シードは任意の整数(小数は切り捨て) */
export function seedRng(seed: number): RngState {
  // 0 シードでも縮退しないよう黄金比由来の定数を混ぜる
  return (Math.trunc(seed) ^ 0x9e3779b9) >>> 0;
}

/** [0, 1) の一様乱数 */
export function nextFloat(state: RngState): [number, RngState] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** [lo, hi] の整数一様乱数(両端含む) */
export function randInt(state: RngState, lo: number, hi: number): [number, RngState] {
  const [v, next] = nextFloat(state);
  return [lo + Math.floor(v * (hi - lo + 1)), next];
}
