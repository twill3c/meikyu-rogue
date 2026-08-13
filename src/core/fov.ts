// 視界計算(F-04)— Bresenham 直線による壁遮蔽判定
// 壁タイル自体は、そこまでの直線が通っていれば見える(輪郭描画のため)

import { idx, tileAt } from "@/core/dungeon";
import type { FloorMap, Pos } from "@/core/types";

/** a から b までの格子直線(両端を含む) */
export function bresenhamLine(a: Pos, b: Pos): Pos[] {
  const cells: Pos[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  // 上限は格子直線の最大長(dx+|dy| ステップ)で有界 — 無限ループなし
  for (;;) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

/** a と b の間(両端を除く)がすべて床なら true */
export function hasLos(f: FloorMap, a: Pos, b: Pos): boolean {
  const line = bresenhamLine(a, b);
  for (let i = 1; i < line.length - 1; i++) {
    if (tileAt(f, line[i]) !== "floor") return false;
  }
  return true;
}

/** origin から半径 radius(ユークリッド)以内で LOS が通るタイル集合 */
export function computeFov(f: FloorMap, origin: Pos, radius: number): Set<number> {
  const visible = new Set<number>();
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const p = { x: origin.x + dx, y: origin.y + dy };
      if (p.x < 0 || p.y < 0 || p.x >= f.width || p.y >= f.height) continue;
      if (hasLos(f, origin, p)) visible.add(idx(f.width, p));
    }
  }
  return visible;
}
