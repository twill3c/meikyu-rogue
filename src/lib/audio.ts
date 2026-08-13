// 効果音の合成(F-14)— ブラウザ専用の薄いレイヤ。音源ファイルなし、オシレータのみ。
// AudioContext は ON 中の初回発音時に遅延生成する(ON 操作がユーザージェスチャのため
// 自動再生制限と両立する)。ロジック(何を鳴らすか)は sound.ts が純関数で決める。

import type { SoundEvent } from "@/lib/sound";

let ctx: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx = ctx ?? new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Blip {
  /** 開始周波数 → 終了周波数(Hz)。スイープで鳴らす */
  from: number;
  to: number;
  dur: number;
  type: OscillatorType;
  gain?: number;
  delay?: number;
}

const PATCHES: Record<SoundEvent, Blip[]> = {
  attack: [{ from: 220, to: 160, dur: 0.07, type: "square" }],
  hurt: [{ from: 120, to: 80, dur: 0.14, type: "sawtooth", gain: 0.06 }],
  kill: [
    { from: 200, to: 320, dur: 0.07, type: "square" },
    { from: 320, to: 480, dur: 0.09, type: "square", delay: 0.07 },
  ],
  pickup: [{ from: 660, to: 880, dur: 0.09, type: "sine" }],
  quaff: [{ from: 440, to: 700, dur: 0.12, type: "sine" }],
  descend: [{ from: 300, to: 140, dur: 0.25, type: "triangle" }],
  victory: [
    { from: 523, to: 523, dur: 0.12, type: "square" },
    { from: 659, to: 659, dur: 0.12, type: "square", delay: 0.12 },
    { from: 784, to: 784, dur: 0.2, type: "square", delay: 0.24 },
  ],
  defeat: [
    { from: 220, to: 220, dur: 0.15, type: "sawtooth", gain: 0.06 },
    { from: 165, to: 110, dur: 0.35, type: "sawtooth", gain: 0.06, delay: 0.15 },
  ],
};

export function playSound(event: SoundEvent): void {
  const c = ensureContext();
  if (!c) return;
  for (const b of PATCHES[event]) {
    const t0 = c.currentTime + (b.delay ?? 0);
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = b.type;
    osc.frequency.setValueAtTime(b.from, t0);
    if (b.to !== b.from) osc.frequency.exponentialRampToValueAtTime(b.to, t0 + b.dur);
    const g = b.gain ?? 0.05;
    amp.gain.setValueAtTime(g, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + b.dur);
    osc.connect(amp);
    amp.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + b.dur + 0.02);
  }
}
