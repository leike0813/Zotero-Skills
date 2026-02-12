## Context

项目当前已具备 `reference-matching` workflow 的基础链路（payload 解码、匹配评分、回写），但存在两个缺口：

1. 输入路由仅支持直接选中 references note，不支持“选中父条目自动发现子 note”。
2. `bbt-json` 数据源仍为占位分支，无法真正通过 Better BibTeX 本地 HTTP 接口执行匹配。

同时，BBT 本地端口在不同环境中可能不一致，需要提供用户可调入口。用户已决策：该配置放在 Workflow Settings，配置粒度仅端口。

## Goals / Non-Goals

**Goals:**

- 支持 references note 与父条目双入口。
- 对多父条目场景按父条目拆分为独立请求记录。
- 实现 `bbt-json` 的本地 HTTP JSON-RPC 查询链路。
- 在 Workflow Settings 中为该 workflow 暴露 BBT 端口配置项（仅端口）。

**Non-Goals:**

- 不引入全局 Preferences 级别的 BBT URL 配置。
- 不支持自定义主机或路径（固定 `127.0.0.1` 与 `/better-bibtex/json-rpc`）。
- 不改动现有匹配评分核心策略（标题主证据 + 作者/年份辅助）。

## Decisions

### Decision 1: 输入语义放在 workflow 层过滤，执行拆分放在 runtime 层

- `filterInputs` 负责把合法输入归一到 references note 集合：
  - 直接选中 note：保留合法 references note。
  - 选中父条目：扫描父条目子 note，提取合法 references note。
- runtime 负责把“多 note 选择上下文”拆成多个执行单元（每单元 1 note），从而满足“两个父条目 -> 两条记录”。

备选方案：
- 将 workflow 强制声明为 `inputs.unit=parent` 并在 `applyResult` 内部再解析 note。  
未选原因：会弱化“直接选中 note”这一合法入口，且让 `applyResult` 处理职责膨胀。

### Decision 2: BBT 接口采用固定 host/path + 可配端口

- 固定地址模板：`http://127.0.0.1:{port}/better-bibtex/json-rpc`
- 端口来源：
  - 默认值：`23119`
  - 可在 Workflow Settings 中按 workflow 覆盖。
- 参数类型为 number，范围限定 `1..65535`。

备选方案：
- 配置完整 URL。  
未选原因：用户已明确仅配置端口，且固定 host/path 可减少误配面。

### Decision 3: BBT 数据获取采用 JSON-RPC 调用并做结构兜底

- 通过 JSON-RPC 获取候选条目集合（如 `item.search`）并映射为统一候选结构：
  - `title`
  - `authors`
  - `year`
  - `citekey`
- 与现有 `zotero-api` 路径共享评分与回写逻辑，避免双份匹配实现。

## Risks / Trade-offs

- [BBT 端点不可达] -> 返回明确错误并终止当前单元，不做部分回写。
- [不同 BBT 版本返回字段差异] -> 增加字段映射兜底与测试样本覆盖。
- [runtime 拆分逻辑改动影响其他 pass-through workflow] -> 增加回归测试，限定拆分触发条件仅在可判定多单元语义时生效。
- [父条目下多 references note 的歧义] -> 默认全部纳入执行单元，并通过逐单元失败隔离避免整体失败。

## Migration Plan

1. 补测试：父条目输入、两父条目两记录、BBT 端口配置与调用。
2. 实现 `filterInputs` 父条目扫描与 references note 归一化。
3. 实现 runtime 多 note 单元拆分。
4. 实现 `bbt-json` HTTP JSON-RPC 路径与端口参数接入。
5. 回归构建与测试，更新 workflow 文档。

## Open Questions

- BBT JSON-RPC 首选方法与返回结构是否需要在实现时针对本机插件版本做一次兼容性探测；若探测结果存在分歧，再向用户反馈确认。
