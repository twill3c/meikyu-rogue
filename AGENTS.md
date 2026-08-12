# AGENTS.md — meikyu-rogue エージェントハーネス

このファイルは、本リポジトリで作業するコーディングエージェントの行動規範・品質ゲート・
完了条件を定義するハーネスである。末尾の「共通規律」は scaffold-kit 管理領域であり、直接編集しない。

読む順: 本書 → SPEC.md(仕様の正本)→ TEST_SPEC.md。

## 1. プロジェクト概要

ターン制ローグライク。シード付きで生成される 5 階層の迷宮を探索し、最下層の秘宝を
持ち帰れば勝利。core(エンジン / 生成器 / FOV / AI)+ Next.js 静的エクスポート UI。
生成された階は必ず到達可能性検証を通す(F-03)— 解けない階は出荷されない。

- 仕様の正本は `SPEC.md`。実装とスペックが食い違う場合、スペックが正。
- スペック変更が必要な場合は、**スペック → テスト → 実装**の順(スペック駆動)。
- 同一シードは同一ダンジョン・同一リプレイを保証する(F-01)。この決定性を壊す変更は
  仕様変更であり、スペック経由でしか行えない。

## 2. 開発ループ(loop engineering)

すべてのタスクは末尾の **7 段階ループプロトコル**(共通規律)で進め、
`logs/loops/{loop_id}.jsonl` に `python harness/looplog.py append` で記録する。

| 段階 | meikyu-rogue での実施 |
|---|---|
| 2 文脈読込 | SPEC.md の該当 F-xx と TEST_SPEC.md の対応 T-xxx、直近ループのログを読む |
| 3 テスト先行 | TEST_SPEC.md に行を足し、`npx vitest run` で赤を確認する |
| 4 実装 | 編集 2 回ごとに `npm run verify:fast`(または `npx vitest run`)。実行のたび `test_run` を記録する |
| 5 検証 | `npm run verify`(build 込み)を green にする。ゲートコマンドはパイプを通さず素で実行し exit code で判定する |
| 7 完了 | `looplog.py validate` 合格 + `summary` を完了報告に含める |

looplog 記録の規範(HC-001):

- 新しいイベント種別を初めて使う前に `harness/looplog.py` の EVENT_SPECS(必須フィールドと型)を確認する。推測で引数を組み立てない。
- `test_run` の passed / failed は**直前のテスト出力の数値をそのまま転記**する。記憶で書かない。

## 3. 品質ゲート(完了条件)

`npm run verify` が green であること。内訳:

| ゲート | 基準 |
|---|---|
| typecheck | `tsc --noEmit` エラー 0 |
| lint | eslint エラー 0 |
| test | 全テスト green。`src/core` カバレッジ lines/functions/statements ≥ 90%, branches ≥ 85% |
| build | `next build`(静的エクスポート)成功 |

ゲートを緩める変更(閾値引き下げ、テスト削除・skip、eslint-disable の追加、
`.wt/gate.json` の上限変更)は、人間の承認なしに行わない。

## 4. アーキテクチャ規約

- `src/core/` は**純関数のみ**。React / DOM / Node API / `src/` 内の他レイヤへの import を禁止する。
- 依存方向は一方向: `src/app`, `src/components`, `src/lib` → `src/core`。逆方向は禁止。
- 乱数はシード付き PRNG を**注入**する(F-01)。core 内で `Date.now()` / `Math.random()` を直接呼ばない。
  乱数状態は GameState の一部として持ち回り、`step` は同一入力 → 同一出力を保証する。
- 生成器・AI の探索は必ず予算(試行回数・状態数上限)付きで書く(F-02/F-06)。無限探索を書かない。
- 状態管理は React 標準(useState 等)のみ。ゼロランタイム依存追加を原則とする(devDeps は可)。

## 5. 変更禁止領域

- `logs/loops/*.jsonl` — append-only(LL-00a)。訂正は correction イベントで。
- AGENTS.md 末尾の scaffold ブロックと `.scaffold/manifest.json` — scaffold-kit 管理。
- `.wt/gate.json` の上限値 — 変更はレジストリ経由(免除パス・test_command の調整は可)。

## 6. よく使うコマンド

```bash
npm run dev           # 開発サーバ
npm run verify:fast   # typecheck + lint + test(高速ループ用)
npm run verify        # 上記 + next build(完了条件)

python harness/looplog.py append --loop loop_XXX --event ... --data ...
python harness/looplog.py validate
python harness/looplog.py summary --loop loop_XXX

python ../harness-kit/scaffold-kit/scripts/scaffoldctl.py status --registry ../harness-kit/scaffold-kit/registry
```

<!-- scaffold:block agents_core v1.8.0 -->
## 共通規律(scaffold 管理領域 — 手動編集禁止)

このセクションはスキャフォールド・レジストリが管理する。内容を変更したい場合は、
このファイルを直接編集せず、失敗ログ → HARNESS_CHANGELOG 起票 → レジストリ改訂 → `scaffoldctl update` の経路で行うこと。

### 7 段階ループプロトコル

| 段階 | 名称 | 完了条件 |
|---|---|---|
| 1 | 計画 | 対象の要求 ID を特定し、`loop_start` を記録した |
| 2 | 文脈読込 | SPEC.md / IMPLEMENTATION_GUIDE.md の該当箇所と、直近ループのログを読んだ |
| 3 | テスト先行 | TEST_SPEC.md にトレースする失敗するテストを書き、赤を確認した |
| 4 | 実装 | ファイル編集 2 回ごとにテストを実行し、赤のまま次の編集に進んでいない |
| 5 | 検証 | 全テスト合格 + 独立再計算(該当時)を確認した |
| 6 | 文書同期 | SPEC/docs と実装の乖離(SPEC-DRIFT)を解消し、生成ドキュメントを再生成した |
| 7 | 完了 | `loop_end` を記録し、ループログ validate に合格し、専用コミットを積んだ |

### ループ可観測性

全ループは loop-observability の規律(LOOP_LOG_SPEC / FAILURE_TAXONOMY)に従い
`logs/loops/{loop_id}.jsonl` に記録する。失敗は気づいた瞬間に分類コード付きで記録する。
ツーストライク(LL-10)と S1 即時起票(LL-12)は本プロジェクトでも有効である。

### エスカレーション規範

以下の場合は作業を止め、`escalation` を記録してから人間に確認する:
仕様の複数解釈(SPEC-AMB 相当)/ スコープ外ファイルへの変更が必要になった /
破壊的操作(履歴改変・データ削除・強制 push)/ 同種の修正の 3 回目の失敗(PROC-LOOP)。

### コミット規約

Conventional Commits(feat/fix/test/docs/refactor/chore)。スキャフォールド更新は
`chore: scaffold vX.Y.Z` の専用コミットで行い、機能変更と混ぜない。
<!-- /scaffold:block agents_core -->
