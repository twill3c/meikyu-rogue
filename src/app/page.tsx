"use client";

// meikyu-rogue UI(F-10)— 状態は core の GameState をそのまま持ち、
// 入力を Action に写像して step を呼ぶだけの薄いレイヤ
import { useCallback, useEffect, useState } from "react";
import { idx } from "@/core/dungeon";
import { newGame, step } from "@/core/engine";
import type { Action, GameState } from "@/core/engine";

const KEY_MOVES: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  k: [0, -1],
  j: [0, 1],
  h: [-1, 0],
  l: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

const ENEMY_GLYPHS = { slime: "s", goblin: "g", ogre: "O" } as const;
const ITEM_GLYPHS = { potion: "!", sword: "/", shield: "]", amulet: "*" } as const;

const COLORS = {
  bg: "#0d0f14",
  panel: "#161a22",
  wall: "#5c6370",
  floor: "#3a3f4b",
  dim: "#262b35",
  player: "#e5c07b",
  enemy: "#e06c75",
  item: "#61afef",
  stairs: "#98c379",
  text: "#abb2bf",
  hp: "#98c379",
  hpLow: "#e06c75",
};

interface Cell {
  ch: string;
  color: string;
}

function renderCell(g: GameState, x: number, y: number): Cell {
  const f = g.floor;
  const key = idx(f.width, { x, y });
  const visible = g.visible.has(key);
  const explored = g.explored.has(key);
  if (!visible && !explored) return { ch: " ", color: COLORS.dim };

  if (visible) {
    if (g.player.pos.x === x && g.player.pos.y === y) {
      return { ch: "@", color: COLORS.player };
    }
    const foe = g.enemies.find((e) => e.pos.x === x && e.pos.y === y);
    if (foe) return { ch: ENEMY_GLYPHS[foe.kind], color: COLORS.enemy };
    const item = g.items.find((i) => i.pos.x === x && i.pos.y === y);
    if (item) {
      return {
        ch: ITEM_GLYPHS[item.kind],
        color: item.kind === "amulet" ? COLORS.player : COLORS.item,
      };
    }
  }
  if (f.stairs && f.stairs.x === x && f.stairs.y === y) {
    return { ch: ">", color: visible ? COLORS.stairs : COLORS.dim };
  }
  const wall = f.tiles[key] === "wall";
  if (wall) return { ch: "#", color: visible ? COLORS.wall : COLORS.dim };
  return { ch: "·", color: visible ? COLORS.floor : COLORS.dim };
}

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);

  const restart = useCallback((seed?: number) => {
    // シードの採番は UI レイヤの責務(core は注入されたシードに対し決定的)
    setGame(newGame(seed ?? Math.floor(Math.random() * 1_000_000_000)));
  }, []);

  useEffect(() => {
    restart();
  }, [restart]);

  const dispatch = useCallback((action: Action) => {
    setGame((g) => (g ? step(g, action) : g));
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!game) return;
      const move = KEY_MOVES[ev.key];
      if (move) {
        ev.preventDefault();
        dispatch({ type: "move", dx: move[0], dy: move[1] });
        return;
      }
      if (ev.key === ".") {
        // 待機。階段上なら降りる(F-10)
        const onStairs =
          game.floor.stairs &&
          game.player.pos.x === game.floor.stairs.x &&
          game.player.pos.y === game.floor.stairs.y;
        dispatch(onStairs ? { type: "descend" } : { type: "wait" });
      } else if (ev.key === ">") {
        dispatch({ type: "descend" });
      } else if (ev.key === "q") {
        dispatch({ type: "quaff" });
      } else if (ev.key === "r") {
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, dispatch, restart]);

  if (!game) {
    return (
      <main style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh", padding: 24 }}>
        迷宮を生成中…
      </main>
    );
  }

  const p = game.player;
  const hpRatio = Math.max(0, p.hp) / p.maxHp;
  const rows: Cell[][] = [];
  for (let y = 0; y < game.floor.height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < game.floor.width; x++) row.push(renderCell(game, x, y));
    rows.push(row);
  }

  return (
    <main
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: "100vh",
        padding: "16px 24px",
        fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <header style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
        <h1 style={{ fontSize: 20, color: COLORS.player, margin: 0 }}>迷宮ローグ</h1>
        <span>B{game.depth}</span>
        <span>turn {game.turn}</span>
        <span style={{ opacity: 0.6 }}>seed {game.seed}</span>
      </header>

      <section style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 14 }}>
        <span>
          HP {Math.max(0, p.hp)}/{p.maxHp}
        </span>
        <span
          aria-hidden
          style={{ display: "inline-block", width: 120, height: 10, background: COLORS.dim }}
        >
          <span
            style={{
              display: "block",
              width: `${hpRatio * 100}%`,
              height: "100%",
              background: hpRatio > 0.3 ? COLORS.hp : COLORS.hpLow,
            }}
          />
        </span>
        <span>atk {p.atk}</span>
        <span>def {p.def}</span>
        <span>薬 ×{p.potions}(q で使用)</span>
      </section>

      <pre
        style={{
          margin: 0,
          padding: 12,
          background: COLORS.panel,
          lineHeight: "1.05",
          fontSize: 16,
          letterSpacing: 2,
          borderRadius: 6,
          position: "relative",
        }}
      >
        {rows.map((row, y) => (
          <div key={y}>
            {row.map((c, x) => (
              <span key={x} style={{ color: c.color }}>
                {c.ch}
              </span>
            ))}
          </div>
        ))}
        {game.status !== "playing" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              background: "rgba(13,15,20,0.82)",
              borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 24, color: game.status === "victory" ? COLORS.stairs : COLORS.enemy }}>
              {game.status === "victory" ? "魂珠を持ち帰った — 勝利!" : "力尽きた…"}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => restart(game.seed)} style={buttonStyle}>
                同じシードで再挑戦
              </button>
              <button onClick={() => restart()} style={buttonStyle}>
                新しいシード
              </button>
            </div>
          </div>
        )}
      </pre>

      <section style={{ fontSize: 13, minHeight: 90, textAlign: "center" }}>
        {game.messages.slice(-5).map((m, i) => (
          <div key={i} style={{ opacity: 0.5 + i * 0.125 }}>
            {m}
          </div>
        ))}
      </section>

      <footer style={{ fontSize: 12, opacity: 0.55, maxWidth: 640, textAlign: "center" }}>
        移動: 矢印 / hjkl / wasd(敵に向かうと攻撃) ・ 待機: .(階段上では降りる) ・
        q: 回復薬 ・ r: 新しいシードで再挑戦 — B5 の魂珠 * を取れば勝利
      </footer>
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "#2c313c",
  color: "#e5c07b",
  border: "1px solid #4b5263",
  borderRadius: 4,
  padding: "8px 14px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};
