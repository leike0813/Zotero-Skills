<p align="center">
  <img src="addon/content/icons/icon_full.png" alt="Zotero Skills" width="128" />
</p>

<h1 align="center">Zotero Skills</h1>

<p align="center">
  <strong>A pluggable workflow engine for Zotero 7 — turn your library into an AI-powered research hub.</strong>
</p>

<p align="center">
  <a href="https://github.com/leike0813/Zotero-Skills/releases"><img src="https://img.shields.io/github/v/release/leike0813/Zotero-Skills?style=flat-square&color=blue" alt="Release" /></a>
  <a href="https://github.com/leike0813/Zotero-Skills/blob/main/LICENSE"><img src="https://img.shields.io/github/license/leike0813/Zotero-Skills?style=flat-square" alt="License" /></a>
  <a href="https://www.zotero.org/"><img src="https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white" alt="Zotero 7" /></a>
  <img src="https://img.shields.io/badge/TypeScript-4.0+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  <a href="doc/README-zhCN.md">简体中文</a> ·
  <a href="doc/README-frFR.md">Français</a> ·
  <a href="doc/README-jaJP.md">日本語</a>
</p>

---

## ✨ What Is Zotero Skills?

Zotero Skills is a **framework-style plugin** for Zotero 7 that provides a universal execution shell for AI and automation workflows. Instead of hard-coding specific features, the plugin offers:

- 📦 **Pluggable Workflows** — Business logic lives in external workflow packages, not in the core plugin.
- 🔌 **Multi-Backend Support** — Route tasks to [Skill-Runner](https://github.com/leike0813/Skill-Runner), generic HTTP APIs, or local pass-through logic.
- ⚡ **Unified Execution** — Selection context, request building, job queuing, result application, and error handling are all handled by a shared runtime.

> Think of it as a **workflow engine inside Zotero** — you define *what* to do via declarative manifests and hook scripts, and the plugin handles *how* to execute it.

## 🚀 Key Features

| Feature | Description |
|---|---|
| **Workflow Engine** | Declarative `workflow.json` manifests + optional hooks (`filterInputs`, `buildRequest`, `applyResult`) |
| **Provider Registry** | Three built-in providers: `skillrunner`, `generic-http`, `pass-through` |
| **Backend Manager** | GUI for configuring multiple backend profiles per provider type |
| **Task Dashboard** | Real-time job monitoring, SkillRunner chat interaction, runtime logs |
| **Workflow Settings** | Per-workflow persistent & one-shot parameter overrides |
| **Workflow Editor** | Host-based renderer for structured data editing (e.g. reference notes) |
| **Log Viewer** | Filterable runtime logs with NDJSON export for diagnostics |

## 📋 Built-in Workflows

| Workflow | Provider | Description |
|---|---|---|
| **Literature Digest** | `skillrunner` | Generate digest/reference notes from markdown or PDF context |
| **Literature Explainer** | `skillrunner` | Interactive conversation-based literature interpretation with conversation notes |
| **Reference Matching** | `pass-through` | Match references to citekeys, rewrite structured payloads |
| **Reference Note Editor** | `pass-through` | Edit structured reference entries in a dedicated form dialog |
| **MinerU** | `generic-http` | Parse PDFs, materialize markdown/assets, attach to parent items |
| **Tag Manager** | `pass-through` | Controlled vocabulary CRUD, facet filtering, YAML import/export |
| **Tag Regulator** | `skillrunner` | Normalize tags via Skill-Runner, import suggested tags |

## 📥 Installation

### Prerequisites

- [Zotero 7](https://www.zotero.org/download/) (version ≥ 6.999)
- For `skillrunner` workflows: a running [Skill-Runner](https://github.com/leike0813/Skill-Runner) instance

### Install Steps

1. Download the latest `.xpi` file from the [Releases](https://github.com/leike0813/Zotero-Skills/releases) page.
2. In Zotero → `Tools` → `Add-ons` → ⚙️ → `Install Add-on From File…`
3. Select the downloaded `.xpi` file and restart Zotero.

### Quick Start

1. **Configure a Backend** — Open `Edit` → `Preferences` → `Zotero Skills` → `Backend Manager`, add your Skill-Runner endpoint.
2. **Place Workflows** — Copy workflow folders into the workflows directory (configurable in preferences).
3. **Use It** — Right-click selected items → `Zotero-Skills` → choose a workflow.

## 🏗️ Architecture Overview

```
User Trigger
    │
    ▼
Selection Context ──► Workflow Engine ──► Provider Registry ──► Job Queue
                          │                     │                  │
                   workflow.json          backend profile     FIFO + concurrency
                   + hook scripts         resolution         control
                          │                     │                  │
                          ▼                     ▼                  ▼
                    Build Requests ──► Resolve Provider ──► Execute & Apply
                                                               │
                                                          Handlers:
                                                          note / tag /
                                                          attachment / item
```

The plugin cleanly separates:

- **Core Runtime** — lifecycle, execution pipeline, UI shell
- **Pluggable Layer** — workflow manifests, hook scripts, backend profiles
- **Result Handling** — handler API for Zotero item/note/tag/attachment operations

## 💰 Cost Advantage

This architecture helps optimize LLM usage costs:

- Route calls through backends aligned with your existing subscriptions.
- Leverage periodically refreshed subscription quotas (e.g. OpenAI/Gemini plans) instead of per-token API billing.
- Keep the plugin provider-agnostic while backend strategy evolves independently.

## 🧑‍💻 Development

```bash
# Install dependencies
npm install

# Start dev server (with mock Skill-Runner)
npm start

# Run tests (lite — fast feedback)
npm test

# Run full tests
npm run test:full

# Build for production
npm run build
```

See [Development Guide](doc/dev_guide.md) for detailed architecture and contribution guidelines.

## 📖 Documentation

| Document | Description |
|---|---|
| [Architecture Flow](doc/architecture-flow.md) | Execution pipeline overview with Mermaid diagrams |
| [Development Guide](doc/dev_guide.md) | Core components, config model, execution chain |
| [Workflows](doc/components/workflows.md) | Manifest schema, hooks, input filtering, execution semantics |
| [Providers](doc/components/providers.md) | Provider contract system, request kinds |
| [Testing](doc/testing-framework.md) | Dual-runner strategy, lite/full modes, CI gates |

## 📄 License

[AGPL-3.0-or-later](LICENSE)

## 🙏 Acknowledgments

- Built on [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) by [@windingwind](https://github.com/windingwind)
- Powered by [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
