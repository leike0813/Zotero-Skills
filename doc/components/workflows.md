# Workflows 组件说明

## 目标

定义 Workflow 包（manifest + hooks）的加载、校验与执行入口，为 UI 与执行内核提供稳定输入。

配套 API 细节请同时参见 `doc/components/workflow-hook-helpers.md`。

## 目录结构

```text
workflows/
  <workflow-id>/
    workflow.json
    hooks/
      filterInputs.js   # 可选
      buildRequest.js   # 可选（声明式 request 无法覆盖时使用）
      normalizeSettings.js # 可选（workflow 专属设置归一化）
      applyResult.js    # 必需
```

## Manifest（当前实现）

```ts
type WorkflowManifest = {
  id: string;
  label: string;
  provider?: string;
  version?: string;
  parameters?: Record<string, WorkflowParameterSchema>;
  inputs?: {
    unit: "attachment" | "parent" | "note";
    accepts?: { mime?: string[] };
    per_parent?: { min?: number; max?: number };
  };
  execution?: {
    mode?: "auto" | "sync" | "async";
    poll_interval_ms?: number;
    timeout_ms?: number;
  };
  result?: {
    fetch?: { type?: "bundle" | "result" };
    expects?: { result_json?: string; artifacts?: string[] };
  };
  request?: WorkflowRequestSpec;
  hooks: {
    filterInputs?: string;
    buildRequest?: string;
    normalizeSettings?: string;
    applyResult: string;
  };
};
```

说明：

- `hooks.applyResult` 必需。
- `hooks.normalizeSettings` 可选（用于 workflow 设置归一化，phase: `persisted` / `execution`）。
- buildRequest 能力必需，但实现方式二选一：
  - `hooks.buildRequest`
  - `request`（声明式）
- 例外：当 `provider = "pass-through"` 时，允许最小声明（仅 `hooks.applyResult`，可选 `hooks.filterInputs`），runtime 会补全 request。
- 两者同时存在时，优先 `hooks.buildRequest`。
- `provider` 建议显式声明；若缺失，loader 会按 `request.kind` 推断。

## 已废弃字段（会被视为非法 manifest）

下列字段已弃用，出现即视为无效 workflow：

- 顶层 `backend`
- 顶层 `defaults`
- `request.result`
- `request.create.engine`
- `request.create.model`
- `request.create.parameter`
- `request.create.runtime_options`

## 声明式 request（当前支持）

由 `src/workflows/declarativeRequestCompiler.ts` 编译：

- `skillrunner.job.v1`
- `generic-http.request.v1`
- `generic-http.steps.v1`
- `pass-through.run.v1`

### pass-through.run.v1 关键约束

- `kind` 固定为 `pass-through.run.v1`
- 请求由 runtime/compiler 自动补全，包含：
  - 完整 `selectionContext`
  - `parameter`（workflow 参数）
  - `targetParentID/taskName/sourceAttachmentPaths`
- 对未声明 `inputs.unit` 的 pass-through workflow，默认按整份选择上下文执行；
  - 若过滤后仅包含 `notes` 且数量 > 1，会按“每 note 一单元”拆分；
  - 若过滤后仅包含 `parents` 且数量 > 1，会按“每 parent 一单元”拆分。

### skillrunner.job.v1 关键约束

- `request.create.skill_id` 必填
- `request.input.upload.files` 必填
- `files[].from` 当前支持：
  - `selected.markdown`
  - `selected.pdf`
- 每个 selector 在当前输入单元必须唯一命中，否则该输入单元报错/跳过

## 输入筛选策略

- 声明式 `inputs` 负责一阶筛选（unit/mime/per_parent）
- 复杂裁决放到 `hooks.filterInputs`
- 若最终合法输入单元为 0，执行阶段会报“无合法输入”并进入跳过提示

## 运行时兼容

- loader 同时支持 Zotero 与 Node。
- 禁止在 loader 顶层静态引入 Node 内置模块（避免 Zotero 打包失败）。
- `provider = "pass-through"` 时，执行上下文使用本地虚拟 backend（无需配置 backend profile）。
- Hook 加载策略：
  - Node：动态 import，失败回退到文本导出转换
  - Zotero：脚本加载器，失败回退到文本导出转换

## Workflow 设置入口（当前实现）

- Workflow 设置改为“每个 workflow 独立设置页”，设置页内不再提供 workflow 下拉切换。
- 右键菜单中的 `Workflow Settings...` 为二级菜单，按 workflow 列出独立设置入口。
- 首选项页的 `Workflow Settings` 按钮会先弹出 workflow 列表，再进入对应 workflow 设置页。
- `Run Once` 默认值语义：
  - 每次打开某个 workflow 设置页时，Run Once 的 profile / workflow 参数 / provider 选项默认值都会从当前 Persistent 设置初始化；
  - 不提供单独的“是否跟随 Persistent”开关；
  - 重新打开设置页会重置待消费的一次性覆盖显示值，避免展示过期 Run Once 输入。
- `normalizeSettings` 钩子语义：
  - `phase = persisted`：用于持久化写入前的配置归一化；
  - `phase = execution`：用于执行前 workflow 参数归一化；
  - hook 返回 `undefined` 时，保持内核默认归一化结果。

### normalizeSettings 设计意图与适用场景

- 该钩子用于承载“workflow 专属配置语义”，避免把业务规则写进插件核心。
- 它不是 BBT 专用能力；BBT 只是当前一个实例。
- 当前实现中，`reference-matching` 使用该钩子来校验/回退 `citekey_template`（legacy + BBT-Lite）。
- 适用场景（典型）：
  - 条件依赖：例如 `data_source=bbt-json` 时强制补默认端口；
  - 跨字段联动：A/B 互斥、C 由 D 推导；
  - 配置迁移：旧字段到新字段的兼容迁移；
  - 执行前稳态：清理非法值，确保本次运行参数可执行。
- 若 workflow 没有此类专属语义，可不提供该钩子。

## 失败语义

- 当输入经声明式规则与 `filterInputs` 处理后为空：workflow 跳过并返回 `no valid input units`。
- 当最小声明 workflow 既无 `request` 又非 `pass-through`：loader 视为无效并跳过。
- 当 provider/请求种类不匹配：执行期失败并进入任务失败汇总。

## applyResult 约束

- `applyResult` 通过 `bundleReader` 与 `runResult` 获取执行输出。
- 当 provider 返回 bundle 时，`bundleReader` 可提供：
  - `readText(entryPath)`
  - `getExtractedDir()`（用于目录级结果物化）
- 当 provider 仅返回 `resultJson`（无 bundle）时，`bundleReader.readText()` 会抛错，hook 应按 `runResult` 分支处理。

## Workflow Editor Host（新增）

- 核心新增通用 `workflowEditorHost`：
  - 统一管理编辑窗体生命周期（打开、保存、取消、销毁）；
  - 提供 renderer 分发（按 `rendererId`）与显式错误上报；
  - 对多输入触发场景按队列串行打开窗体（一次仅一个窗体）。
- workflow 侧负责 renderer（业务 UI 与字段绑定），核心不再承载 workflow 专用编辑界面实现。
- 迁移说明：`reference-note-editor` 已从旧的核心耦合桥接迁移到 host+renderer；取消/关闭未保存的失败语义保持不变。

## reference-matching workflow（新增）

路径：`workflows/reference-matching/`

### 输入约束

- provider 使用 `pass-through`，由本地代码执行，不依赖远端后端。
- `filterInputs` 支持两类合法入口：
  - 直接选中 references note；
  - 选中父条目并在其子 note 中发现 references note。
- references 判定规则：
  - `data-zs-note-kind="references"`，或
  - payload 标记 `data-zs-payload="references-json"`。
- 非 references 输入会被过滤；若过滤后为空，workflow 进入 `no valid input units` 跳过语义。
- 多父条目输入按“每 references note 一条请求记录”拆分执行，不打包。

### 匹配规则

- 数据源默认 `zotero-api`（全库本地检索）。
- 当 `data_source=bbt-json` 时，走本地 Better BibTeX JSON-RPC：
  - 端点模板：`http://127.0.0.1:{bbt_port}/better-bibtex/json-rpc`
  - 端口参数：`bbt_port`（workflow 参数，默认 `23119`，范围 `1..65535`）
- 新增模板参数：`citekey_template`（默认 `{author}_{title}_{year}`）。
  - 支持 legacy 占位符：`{author}`、`{year}`、`{title}`；
  - 支持 BBT-Lite 表达式：`auth/year/title` 对象、链式方法、单引号字符串字面量、`+` 拼接；
  - BBT-Lite 当前仅覆盖 Auth/Year/Title 常用方法，不完整复刻 Better BibTeX 全量模板引擎；
  - 非法模板会在设置层回退到“最近一次有效模板”或默认值。
- 匹配顺序固定为三段：
  - `reference.citekey/citeKey` 显式精确命中（最高优先级，唯一命中即短路）；
  - 用 `citekey_template` 从 reference 生成预测 CiteKey 后再做精确命中（唯一命中即短路）；
  - 上述两段都未形成唯一命中时，回退“标题主导 + 作者/年份辅助”评分匹配。
- BBT-Lite 失败安全语义：
  - 模板解析失败、对象/方法不支持、参数非法或字段缺失导致预测值无效时，不中断 workflow；
  - 保持“显式 -> 预测 -> 评分”顺序，自动进入评分兜底阶段。
- 评分兜底语义：
  - 标题完全匹配优先；
  - 非完全匹配必须满足高标题相似度，且作者或年份至少一个辅助证据成立；
  - 低置信或多候选冲突不回填 citekey（宁缺毋滥）。
- CiteKey 阶段若命中歧义（同 key 多候选）不会直接回写，会自动回退到后续阶段。
- 命中后同步更新两处：
  - payload JSON 中 reference 条目的 `citekey`
  - HTML references table 的 `Citekey` 列

### 回写与失败语义

- 回写采用覆盖写入同一 note，但保留原外层结构（如 wrapper/header 非目标区域）。
- payload 缺失、损坏、编码不支持或 JSON 非法时：
  - 当前输入报错终止；
  - 不进行部分回写（保持原 note 内容不变）。
- `bbt-json` 端点不可达或返回非法 JSON/RPC error 时：
  - 当前输入报错终止；
  - 不进行部分回写（保持原 note 内容不变）。

## reference-note-editor workflow（新增）

路径：`workflows/reference-note-editor/`

### 输入约束

- provider 使用 `pass-through`，本地执行，不依赖后端 API。
- 合法输入与 `reference-matching` 一致：
  - 直接选中 references note；
  - 选中父条目后展开其 references note。
- references 判定规则：
  - `data-zs-note-kind="references"`，或
  - payload 标记 `data-zs-payload="references-json"`。
- 过滤后无合法输入时，workflow 按 `no valid input units` 跳过。

### 编辑行为

- 每个合法输入单元打开一个独立编辑窗体（由 host 串行调度，非并行）。
- 单次触发包含多个合法输入时，按输入顺序逐个弹窗编辑。
- 编辑窗体显示目标父条目上下文，支持：
  - 字段编辑（title/year/author/citekey/rawText）；
  - 扩展元数据编辑（`publicationTitle`、`conferenceName`、`university`、`archiveID`、`volume`、`issue`、`pages`、`place`）；
  - 增加条目；
  - 删除条目；
  - 调整条目顺序（上移/下移）。
- 编辑区采用紧凑行布局：左侧行号、右侧行内操作按钮、明显滚动容器；`Raw Text` 始终可见可编辑。

### 保存与失败语义

- Save：重建 `references-json` payload 与 `references-table` HTML，并覆盖回写同一 note。
- Cancel/关闭未保存：
  - 当前 job 标记失败；
  - note 保持不变。
- 回写后保证 payload 与表格顺序、字段内容保持同步。

### Reference 表格列映射（共享规则）

- `reference-note-editor`、`reference-matching`、`literature-digest` 三个 workflow 使用同一套 canonical `references-table` 渲染规则，列顺序为：
  - `#`、`Citekey`、`Year`、`Title`、`Authors`、`Source`、`Locator`。
- `Source` 列取值优先级（命中首个非空即停止）：
  - `publicationTitle` > `conferenceName` > `university` > `archiveID`。
- `Locator` 列由以下字段按固定顺序合并：
  - `volume`、`issue`、`pages`、`place`；
  - 渲染格式为：`Vol. <volume>; No. <issue>; pp. <pages>; <place>`（空字段跳过，不补占位）。

## mineru workflow（新增）

路径：`workflows/mineru/`

### 输入约束

- 输入单元是 PDF 附件；每个 PDF 独立一条请求任务。
- 直接选 PDF：一附件一任务。
- 选父条目：自动展开其子 PDF 附件并一附件一任务。
- 仅当目标目录存在同名 `<pdfBaseName>.md` 时，输入在 `filterInputs` 阶段被跳过。
- 若本次触发所有候选 PDF 都命中该冲突，则 workflow 不提交任何 job，执行汇总中 `skipped` 等于候选输入总数。
- 若仅部分候选命中冲突，则仅提交未冲突 PDF，执行汇总中 `skipped` 为被剔除数量。
- 若仅存在 `Images_<itemKey>` 目录而无同名 `.md`，不跳过。

### 请求链路

- provider 使用 `generic-http`，request kind 为 `generic-http.steps.v1`。
- 调用链路：
  - `POST /api/v4/file-urls/batch` 申请上传 URL
  - `PUT upload_url` 上传 PDF
  - `GET /api/v4/extract-results/batch/{batch_id}` 轮询状态
  - `GET full_zip_url` 下载 bundle bytes
- Token 不在 workflow 参数中维护，统一来自 backend profile 的 `auth.kind=bearer`。

### 结果物化

- 从 bundle 中读取 `full.md`，重命名为 `<pdfBaseName>.md` 并写回到 PDF 同目录。
- `images/` 重命名为 `Images_<itemKey>/` 并移动到 PDF 同目录。
- markdown 内 `images/...` 引用会改写为 `Images_<itemKey>/...`。
- 若目标目录已有同名 `Images_<itemKey>`，先删除旧目录，再落新目录。
- 物化成功后，把 `<pdfBaseName>.md` 以链接附件形式添加到 PDF 父条目下。
- 若父条目下已存在同路径 `<pdfBaseName>.md` 附件链接，`applyResult` 不会重复创建附件。
- bundle 缺少 `full.md` 时，当前任务直接失败，不做部分回写。

## 测试点（TDD）

- manifest 字段校验与废弃字段拒绝
- hooks 路径与导出函数校验
- `buildStrategy = hook | declarative` 分支行为
- 声明式 request 编译与输入映射约束
- Node/Zotero 双运行时 loader 行为

## 文档维护检查清单

- 修改 `src/workflows/types.ts` 中 `WorkflowHooksSpec` 或 `WorkflowManifest` 后，同步更新本文件的 manifest 契约章节。
- 修改 `src/workflows/loader.ts` 的 hook 载入策略或失败语义后，同步更新本文件的运行时兼容/失败语义章节。
- 修改 `src/workflows/helpers.ts` 中 canonical references 表格渲染逻辑后，同步更新本文件的“Reference 表格列映射”。
