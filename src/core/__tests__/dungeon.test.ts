import { describe, expect, it } from "vitest";
import {
  FLOOR_HEIGHT,
  FLOOR_WIDTH,
  MAX_DEPTH,
  generateFloor,
  reachableFrom,
  tileAt,
} from "@/core/dungeon";
import type { FloorMap, Pos } from "@/core/types";

function allFloorTiles(f: FloorMap): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      if (tileAt(f, { x, y }) === "floor") out.push({ x, y });
    }
  }
  return out;
}

// T-010: 部屋数と配置の健全性
describe("T-010 部屋配置", () => {
  const f = generateFloor(123, 1);
  it("部屋数は 6〜10", () => {
    expect(f.rooms.length).toBeGreaterThanOrEqual(6);
    expect(f.rooms.length).toBeLessThanOrEqual(10);
  });
  it("全部屋が盤面内に収まる", () => {
    for (const r of f.rooms) {
      expect(r.x).toBeGreaterThanOrEqual(1);
      expect(r.y).toBeGreaterThanOrEqual(1);
      expect(r.x + r.w).toBeLessThanOrEqual(FLOOR_WIDTH - 1);
      expect(r.y + r.h).toBeLessThanOrEqual(FLOOR_HEIGHT - 1);
    }
  });
  it("部屋同士は重ならない(1 マスの隔壁を含む)", () => {
    for (let i = 0; i < f.rooms.length; i++) {
      for (let j = i + 1; j < f.rooms.length; j++) {
        const a = f.rooms[i];
        const b = f.rooms[j];
        const overlap =
          a.x < b.x + b.w + 1 &&
          b.x < a.x + a.w + 1 &&
          a.y < b.y + b.h + 1 &&
          b.y < a.y + a.h + 1;
        expect(overlap).toBe(false);
      }
    }
  });
});

// T-011: 同一シード・同一階 → 深い等値
describe("T-011 生成の決定性", () => {
  it("同一シードで 2 回生成すると同一の階", () => {
    const a = generateFloor(999, 3);
    const b = generateFloor(999, 3);
    expect(a).toEqual(b);
  });
  it("異なるシードでは異なる階", () => {
    const a = generateFloor(1, 1);
    const b = generateFloor(2, 1);
    expect(a).not.toEqual(b);
  });
});

// T-012: 全床タイルが連結
describe("T-012 床の連結性", () => {
  it("entry からのフラッドフィルが全床タイルを覆う", () => {
    const f = generateFloor(55, 2);
    const reach = reachableFrom(f, f.entry);
    for (const p of allFloorTiles(f)) {
      expect(reach.has(p.y * f.width + p.x)).toBe(true);
    }
  });
});

// T-013: 階段・アイテム・敵への到達可能性
describe("T-013 到達可能性", () => {
  it("階段・全アイテム・全敵が entry から到達可能", () => {
    const f = generateFloor(77, 4);
    const reach = reachableFrom(f, f.entry);
    expect(f.stairs).not.toBeNull();
    const stairs = f.stairs as Pos;
    expect(reach.has(stairs.y * f.width + stairs.x)).toBe(true);
    for (const it2 of f.items) {
      expect(reach.has(it2.pos.y * f.width + it2.pos.x)).toBe(true);
    }
    for (const e of f.enemies) {
      expect(reach.has(e.pos.y * f.width + e.pos.x)).toBe(true);
    }
  });
  it("B5 は階段の代わりに暁の勾玉を持つ", () => {
    const f = generateFloor(77, MAX_DEPTH);
    expect(f.stairs).toBeNull();
    expect(f.items.filter((i) => i.kind === "amulet")).toHaveLength(1);
  });
});

// T-014: シード 1〜50 × 全階が予算内で検証合格
describe("T-014 生成健全性の網羅", () => {
  it("250 階すべて生成でき、床連結が成立する", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        const f = generateFloor(seed, depth);
        const reach = reachableFrom(f, f.entry);
        const floors = allFloorTiles(f);
        expect(floors.length).toBeGreaterThan(0);
        expect(reach.size).toBe(floors.length);
      }
    }
  });
});

// T-015: 深さ別の敵・アイテム数(N-04)
describe("T-015 深度スケーリング", () => {
  it("敵数は 2+depth で、深いほど多い", () => {
    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      const f = generateFloor(31, depth);
      expect(f.enemies.length).toBe(2 + depth);
    }
  });
  it("回復薬は各階 2 個、剣は B2・盾は B3 のみ", () => {
    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
      const f = generateFloor(13, depth);
      expect(f.items.filter((i) => i.kind === "potion")).toHaveLength(2);
      expect(f.items.filter((i) => i.kind === "sword")).toHaveLength(depth === 2 ? 1 : 0);
      expect(f.items.filter((i) => i.kind === "shield")).toHaveLength(depth === 3 ? 1 : 0);
    }
  });
  it("敵・アイテムは床タイル上にあり、位置が重複しない", () => {
    const f = generateFloor(88, 3);
    const seen = new Set<number>();
    for (const p of [...f.enemies.map((e) => e.pos), ...f.items.map((i) => i.pos)]) {
      expect(tileAt(f, p)).toBe("floor");
      const key = p.y * f.width + p.x;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
