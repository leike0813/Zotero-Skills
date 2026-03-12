<p align="center">
  <img src="../addon/content/icons/icon_full.png" alt="Zotero Skills" width="128" />
</p>

<h1 align="center">Zotero Skills</h1>

<p align="center">
  <strong>Zotero 7 向けプラガブルワークフローエンジン — 文献ライブラリを AI 駆動の研究ハブに。</strong>
</p>

<p align="center">
  <a href="https://github.com/leike0813/Zotero-Skills/releases"><img src="https://img.shields.io/github/v/release/leike0813/Zotero-Skills?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/leike0813/Zotero-Skills/blob/main/LICENSE"><img src="https://img.shields.io/github/license/leike0813/Zotero-Skills?style=flat-square" alt="License" /></a>
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white" alt="Zotero 7" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="./README-zhCN.md">简体中文</a> ·
  <a href="./README-frFR.md">Français</a> ·
  日本語
</p>

---

## ✨ Zotero Skills とは？

Zotero Skills は Zotero 7 向けの**フレームワーク型プラグイン**です。AI や自動化ワークフローのための汎用実行シェルを提供します：

- 📦 **プラガブルワークフロー** — ビジネスロジックは外部ワークフローパッケージに配置され、コアプラグインには含まれません。
- 🔌 **マルチバックエンド対応** — [Skill-Runner](https://github.com/leike0813/Skill-Runner)、汎用 HTTP API、ローカルパススルーロジックにタスクをルーティングできます。
- ⚡ **統一実行** — 選択コンテキスト構築、リクエスト生成、ジョブキュー、結果適用、エラー処理はすべて共有ランタイムが統一的に処理します。

> **Zotero 内のワークフローエンジン**と考えてください — 宣言的マニフェストとフックスクリプトで「何をするか」を定義し、プラグインが「どう実行するか」を処理します。

## 🚀 主要機能

| 機能 | 説明 |
|---|---|
| **ワークフローエンジン** | 宣言的 `workflow.json` マニフェスト + オプションフック（`filterInputs`、`buildRequest`、`applyResult`） |
| **プロバイダーレジストリ** | 3 つの組み込みプロバイダー：`skillrunner`、`generic-http`、`pass-through` |
| **バックエンドマネージャー** | プロバイダータイプごとに複数のバックエンドプロファイルを GUI で管理 |
| **タスクダッシュボード** | リアルタイムジョブ監視、SkillRunner チャット対話、ランタイムログ |
| **ワークフロー設定** | ワークフローごとの永続化パラメータと一回限りのオーバーライド |
| **ワークフローエディター** | 構造化データ編集用のホストベースレンダラーフレームワーク |
| **ログビューアー** | フィルタリング可能なランタイムログ、診断用 NDJSON エクスポート |

## 📋 組み込みワークフロー

| ワークフロー | プロバイダー | 説明 |
|---|---|---|
| **文献ダイジェスト** | `skillrunner` | markdown/PDF コンテキストからダイジェスト・参考文献ノートを生成 |
| **文献エクスプレイナー** | `skillrunner` | インタラクティブな対話型文献解釈、会話ノートとして記録 |
| **参考文献マッチング** | `pass-through` | 参考文献を citekey にマッチし、構造化 payload を書き戻し |
| **参考文献ノートエディター** | `pass-through` | 専用フォームダイアログで構造化参考文献エントリを編集 |
| **MinerU** | `generic-http` | PDF を解析し、markdown/アセットを実体化して親アイテムに添付 |
| **タグマネージャー** | `pass-through` | 統制語彙の CRUD、ファセットフィルタリング、YAML インポート/エクスポート |
| **タグレギュレーター** | `skillrunner` | Skill-Runner 経由でタグを正規化し、提案タグをインポート |

## 📥 インストール

### 前提条件

- [Zotero 7](https://www.zotero.org/download/)（バージョン ≥ 6.999）
- `skillrunner` ワークフローの場合：稼働中の [Skill-Runner](https://github.com/leike0813/Skill-Runner) インスタンス

### インストール手順

1. [Releases](https://github.com/leike0813/Zotero-Skills/releases) ページから最新の `.xpi` ファイルをダウンロードします。
2. Zotero で `ツール` → `アドオン` → ⚙️ → `ファイルからアドオンをインストール…`
3. ダウンロードした `.xpi` ファイルを選択し、Zotero を再起動します。

### クイックスタート

1. **バックエンドを設定** — `編集` → `設定` → `Zotero Skills` → `Backend Manager` で Skill-Runner エンドポイントを追加。
2. **ワークフローを配置** — ワークフローフォルダをワークフローディレクトリにコピー（設定で構成可能）。
3. **使用開始** — アイテムを右クリック → `Zotero-Skills` → ワークフローを選択。

## 🏗️ アーキテクチャ概要

```
ユーザートリガー
    │
    ▼
選択コンテキスト ──► ワークフローエンジン ──► プロバイダーレジストリ ──► ジョブキュー
                         │                        │                      │
                   workflow.json            バックエンド             FIFO + 同時実行
                   + フックスクリプト         プロファイル解決          制御
                         │                        │                      │
                         ▼                        ▼                      ▼
                   リクエスト構築 ──► プロバイダー解決 ──► 実行 & 結果適用
                                                              │
                                                         Handlers:
                                                         ノート / タグ /
                                                         添付ファイル / アイテム
```

## 💰 コストメリット

- 既存のサブスクリプションに合わせたバックエンド経由で呼び出しをルーティング。
- トークン単位の API 課金ではなく、定期更新されるサブスクリプション枠（OpenAI/Gemini プランなど）を活用。
- UI/ワークフロー層はプロバイダーに依存せず、バックエンド戦略は独立して進化可能。

## 🧑‍💻 開発

```bash
npm install          # 依存関係のインストール
npm start            # 開発サーバー起動（モック Skill-Runner 付き）
npm test             # lite テスト実行
npm run test:full    # フルテスト実行
npm run build        # プロダクションビルド
```

詳細は[開発ガイド](dev_guide.md)を参照してください。

## 📖 ドキュメント

| ドキュメント | 説明 |
|---|---|
| [アーキテクチャフロー](architecture-flow.md) | 実行パイプラインの概要（Mermaid 図付き） |
| [開発ガイド](dev_guide.md) | コアコンポーネント、設定モデル、実行チェーン |
| [ワークフロー](components/workflows.md) | マニフェストスキーマ、フック、入力フィルタリング |
| [プロバイダー](components/providers.md) | プロバイダーコントラクトシステム、リクエスト種別 |
| [テスト](testing-framework.md) | デュアルランナー戦略、lite/full モード、CI ゲート |

## 📄 ライセンス

[AGPL-3.0-or-later](../LICENSE)

## 🙏 謝辞

- [@windingwind](https://github.com/windingwind) の [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) をベースに構築
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) を使用
