import { describe, expect, it } from "vitest";
import { nextFloat, randInt, seedRng } from "@/core/rng";

// T-001: 同一シード → 同一乱数列
describe("T-001 決定性", () => {
  it("同一シードから同一の列を得る", () => {
    let a = seedRng(42);
    let b = seedRng(42);
    for (let i = 0; i < 100; i++) {
      const [va, na] = nextFloat(a);
      const [vb, nb] = nextFloat(b);
      expect(va).toBe(vb);
      a = na;
      b = nb;
    }
  });
});

// T-002: 異なるシード → 異なる列
describe("T-002 シード分離", () => {
  it("先頭 8 個の列が一致しない", () => {
    let a = seedRng(1);
    let b = seedRng(2);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 8; i++) {
      const [va, na] = nextFloat(a);
      const [vb, nb] = nextFloat(b);
      seqA.push(va);
      seqB.push(vb);
      a = na;
      b = nb;
    }
    expect(seqA).not.toEqual(seqB);
  });
});

// T-003: randInt は [lo, hi] に収まり両端が出現する
describe("T-003 randInt の範囲", () => {
  it("常に範囲内で、両端も出現する", () => {
    let s = seedRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const [v, ns] = randInt(s, 3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
      s = ns;
    }
    expect(seen.has(3)).toBe(true);
    expect(seen.has(6)).toBe(true);
  });

  it("nextFloat は [0,1) を返す", () => {
    let s = seedRng(11);
    for (let i = 0; i < 200; i++) {
      const [v, ns] = nextFloat(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      s = ns;
    }
  });
});
