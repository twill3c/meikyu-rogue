import { describe, expect, it } from "vitest";
import { idx } from "@/core/dungeon";
import { computeFov, hasLos } from "@/core/fov";
import type { FloorMap, TileKind } from "@/core/types";

/** 外周が壁・内部が床の空き盤面を作るテストヘルパ */
export function openFloor(width = 16, height = 10): FloorMap {
  const tiles: TileKind[] = new Array<TileKind>(width * height).fill("floor");
  for (let x = 0; x < width; x++) {
    tiles[x] = "wall";
    tiles[(height - 1) * width + x] = "wall";
  }
  for (let y = 0; y < height; y++) {
    tiles[y * width] = "wall";
    tiles[y * width + width - 1] = "wall";
  }
  return {
    width,
    height,
    tiles,
    rooms: [],
    entry: { x: 1, y: 1 },
    stairs: { x: width - 2, y: height - 2 },
    items: [],
    enemies: [],
  };
}

function wallAt(f: FloorMap, x: number, y: number): void {
  f.tiles[y * f.width + x] = "wall";
}

// T-030: 遮蔽のない近傍タイルは visible
describe("T-030 視界内タイル", () => {
  it("半径 6 以内・遮蔽なしは visible", () => {
    const f = openFloor();
    const vis = computeFov(f, { x: 5, y: 5 }, 6);
    expect(vis.has(idx(f.width, { x: 5, y: 5 }))).toBe(true);
    expect(vis.has(idx(f.width, { x: 8, y: 5 }))).toBe(true);
    expect(vis.has(idx(f.width, { x: 5, y: 2 }))).toBe(true);
  });
  it("半径の外は visible にならない", () => {
    const f = openFloor(24, 10);
    const vis = computeFov(f, { x: 2, y: 5 }, 6);
    expect(vis.has(idx(f.width, { x: 12, y: 5 }))).toBe(false);
  });
});

// T-031: 壁の向こうは見えない
describe("T-031 壁遮蔽", () => {
  it("壁列の向こうのタイルは visible にならない", () => {
    const f = openFloor();
    // x=7 に縦の壁を立てる(通路孔なし)
    for (let y = 1; y < f.height - 1; y++) wallAt(f, 7, y);
    const vis = computeFov(f, { x: 5, y: 5 }, 6);
    expect(vis.has(idx(f.width, { x: 9, y: 5 }))).toBe(false);
    // 壁そのものは見える(輪郭描画のため)
    expect(vis.has(idx(f.width, { x: 7, y: 5 }))).toBe(true);
  });
  it("hasLos は間に壁があると false", () => {
    const f = openFloor();
    for (let y = 1; y < f.height - 1; y++) wallAt(f, 7, y);
    expect(hasLos(f, { x: 5, y: 5 }, { x: 9, y: 5 })).toBe(false);
    expect(hasLos(f, { x: 2, y: 5 }, { x: 6, y: 5 })).toBe(true);
  });
});
