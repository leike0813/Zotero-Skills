# 测试框架设计与落地方案

## 目标

建立可复现、可扩展的测试框架，尽量减少对 Zotero 运行环境的依赖，同时保证关键组件在真实环境中被验证。

## 测试分层

### 1) Zotero 环境测试（真实运行）

必须在 Zotero 中验证以下组件的真实行为与输出：
- SelectionContext
- Handler
- UI Shell

用途：
- 获取真实响应（作为基线样本）
- 验证 UI/交互行为与逻辑触发

### 2) IDE 单元测试（Mock）

在 IDE 内可直接执行：
- Startup（插件实例占位）
- SelectionContext Schema
- Handlers
- SelectionContext Rebuild
- Job Queue
- Transport
- Local Cache（占位）
- Workflow（使用临时目录）

目的：
- 以 Mock Zotero API 与固定 fixtures 进行可重复测试
- 不依赖 Zotero 环境

执行入口：
- `npm run test:node`（Node + tsx + mocha）
- `npm run test` / `npm run test:zotero`（Zotero 真实环境）

## Mock Zotero API 策略

### 核心思路

1) 先在 Zotero 环境获取真实响应  
2) 以真实响应作为 fixtures  
3) 基于 fixtures 构建 Mock Zotero API  
4) IDE 内单元测试依赖 Mock Zotero

Mock 说明文档：
- `doc/components/zotero-mock.md`

### 采样基线（fixtures）

需要采集并保存以下真实响应：
- SelectionContext 输出结构（父条目 / 子条目 / 附件 / 混合）
- Handler 处理后的副作用（Note/Tag/Artifact/UI summary）
- UI Shell 注册结果（菜单项结构、禁用逻辑）

保存位置：
```
test/fixtures/selection-context/
  attachments/
```

## Workflow 测试策略

生产环境：
- Workflow 目录路径由 Zotero prefs 提供

测试环境：
- 使用临时路径
- 测试用 workflow 包放置在 `tests/fixtures/workflows/`（含 workflow.json + hooks）

## 落地步骤（分阶段）

### 阶段 1：SelectionContext 骨架 + 真实采样

1) 实现最小 SelectionContext
2) 在 Zotero 中通过命令触发输出
3) 保存真实输出为 fixtures

### 阶段 2：Mock Zotero API

1) 基于 fixtures 构建 Mock Zotero API
2) 在 IDE 中运行 SelectionContext 测试

### 阶段 3：Handler 与 UI Shell 骨架

1) 编写测试版本（仅输出日志/标记）
2) 在 Zotero 环境手动验证效果
3) 收集反馈并修正

### 阶段 4：Workflow 单元测试

1) Workflow 读取临时路径
2) 解析/校验/manifest 生成
3) 完成 IDE 单元测试

## 测试范围与约束

- TDD 优先：先写测试，再写实现
- 真实环境验证用于采样与验证，不作为常规 CI
- Mock 仅用于 IDE 单元测试

## 当前测试顺序（Node）

1) `00-startup.test.ts`
2) `01-selection-context-schema.test.ts`
3) `02-handlers.test.ts`
4) `03-selection-context-rebuild.test.ts`
