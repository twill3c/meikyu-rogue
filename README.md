# meikyu-rogue — 迷宮ローグ

ターン制ローグライク。シードから決定的に生成される 5 階層の迷宮を探索し、
最下層 B5 の秘宝「魂珠」を持ち帰れば勝利。

- **決定的**: 同一シードなら同一の迷宮・同一のリプレイ(乱数は GameState 内で持ち回り)
- **検証済み生成**: すべての階は「入口から階段・全アイテム・全敵へ到達可能」を
  フラッドフィルで検証してから出荷される
- **静的サイト**: サーバなし。`next build` の out/ だけで動く
- **スコア**: 敵撃破(種別ポイント)+ 階降下 +50 + 魂珠 +200。敵は 5 種
  (スライム/こうもり=2 回行動/ゴブリン/オーガ/レイス=壁越し感知)が深度別に出現

## 遊び方

| キー | 動作 |
|---|---|
| 矢印 / hjkl / wasd | 移動(敵に向かえば攻撃) |
| `.` | 待機(階段上では降りる) |
| q | 回復薬を飲む |
| r | 新しいシードで再挑戦 |

## 開発

```bash
npm install
npm run dev           # 開発サーバ
npm run verify:fast   # typecheck + lint + test
npm run verify        # 上記 + next build(完了条件)
```

開発規範は [AGENTS.md](AGENTS.md)、仕様は [SPEC.md](SPEC.md)、
テスト対応表は [TEST_SPEC.md](TEST_SPEC.md) を参照。
ループログは `logs/loops/` に JSONL で残る(loop-observability 規律)。
