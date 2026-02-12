<p align="center">
  <img src="addon/content/icons/icon_full.png" alt="Zotero-Skills Icon" width="160" />
</p>

# Zotero-Skills

Zotero-Skills is a Zotero 7 plugin that turns Zotero into a pluggable workflow front-end for AI and automation tasks.

Chinese documentation: [doc/README-zhCN.md](doc/README-zhCN.md)

## What This Project Solves

This project provides a reusable execution shell inside Zotero:

- It manages selection context, workflow execution, job tracking, and result application.
- It keeps business logic out of the core plugin.
- It lets you add or swap workflow behavior through external workflow packages.

In short, Zotero-Skills is designed as a framework-style plugin, not a single-purpose feature plugin.

## Pluggable Architecture

The plugin uses a pluggable workflow model:

- Each workflow is defined by `workflow.json` plus optional hooks (`filterInputs`, `buildRequest`, `applyResult`).
- The runtime compiles requests, resolves providers/backends, executes jobs, and applies results uniformly.
- Workflow packages can target different backends (Skill-Runner, generic HTTP, pass-through local logic) without rewriting core plugin code.

Key benefits:

- Extensibility: add new workflows without changing core architecture.
- Isolation: workflow-specific logic stays inside workflow packages.
- Reuse: shared runtime, queue, settings, and UI behavior across different workflows.

## Agent Skills Require Skill-Runner

For Agent Skills invocation, Zotero-Skills depends on [Skill-Runner](https://github.com/leike0813/Skill-Runner) as backend orchestration:

- Zotero-Skills prepares normalized requests from Zotero selections.
- Skill-Runner handles skill execution and backend-facing orchestration.
- Zotero-Skills receives outputs and applies them back to Zotero items/notes/attachments.

Without Skill-Runner, Agent Skills workflows cannot be executed end-to-end.

## Cost Model and Subscription-Quota Advantage

This architecture helps control LLM usage cost:

- You can route calls through Skill-Runner and provider integrations that align with your existing subscriptions.
- In many setups, this allows better use of periodically refreshed subscription allowances (for example in OpenAI/Gemini subscription plans) rather than directly paying per-call API token costs.
- The plugin stays provider-agnostic at the UI/workflow layer while backend strategy can evolve independently.

## Typical Use Cases (Built-in Workflows)

- Literature digest workflow: generate digest/reference notes from selected markdown context.
- Reference matching workflow: resolve references to citekeys and write back structured note payload.
- Reference note editor workflow: edit structured reference payload in a dedicated form dialog and rewrite synchronized table+payload.
- MinerU workflow: parse selected PDF attachments, materialize markdown/assets, and attach outputs to parent items.

## Quick Navigation

- Architecture and current implementation notes: [doc/dev_guide.md](doc/dev_guide.md)
- Workflow component details: [doc/components/workflows.md](doc/components/workflows.md)
- Provider component details: [doc/components/providers.md](doc/components/providers.md)
- Testing strategy: [doc/testing-framework.md](doc/testing-framework.md)

## Template Origin

This repository was initially generated from [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template), and then evolved into the current Zotero-Skills architecture and implementation.
