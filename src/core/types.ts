// meikyu-rogue core 型定義(SPEC §2)
// このレイヤは純関数のみ — React / DOM / Node API への依存を持たない(N-01)

export type RngState = number;

export interface Pos {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TileKind = "wall" | "floor";

export type ItemKind = "potion" | "sword" | "shield" | "amulet";

export interface Item {
  kind: ItemKind;
  pos: Pos;
}

export type EnemyKind = "slime" | "bat" | "goblin" | "ogre" | "wraith";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: Pos;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  /** 追跡状態(F-06)。一度プレイヤーを視認すると true になり追跡を続ける */
  alert: boolean;
}

export interface FloorMap {
  width: number;
  height: number;
  /** row-major の地形。tiles[y * width + x] */
  tiles: TileKind[];
  rooms: Rect[];
  /** プレイヤーの入口(前の階の階段直下) */
  entry: Pos;
  /** 下り階段。B5(最下層)は null で、代わりに暁の勾玉アイテムが置かれる */
  stairs: Pos | null;
  items: Item[];
  enemies: Enemy[];
}
