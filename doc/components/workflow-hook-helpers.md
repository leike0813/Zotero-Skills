# Workflow Hook 内建函数指南

本文档说明 Workflow hooks 如何使用插件内核注入的 `runtime.helpers`，避免在每个 hook 文件里重复定义通用函数。

## 入口

每个 hook 都会收到 `runtime` 对象：

```js
export function filterInputs({ selectionContext, runtime }) {
  const helpers = runtime.helpers;
  // ...
}
```

## filterInputs 触发与契约（M1）

- 对于 `inputs.unit = "attachment"` 的 workflow：只要声明了 `hooks.filterInputs`，就会在声明式 `inputs` 初筛后执行。
- `filterInputs` 的主要用途仍是处理复杂输入裁决（例如同一父条目下多个同类候选附件）。
- 输入：`selectionContext`（声明式初筛后的候选集）+ `manifest` + `runtime`。
- 输出：筛选后的 `selectionContext`（通常通过 `withFilteredAttachments` 返回）。
- 失败语义：
  - 未提供 hook：直接使用声明式初筛结果继续执行。
  - hook 返回后无合法输入：该 workflow 在构建请求阶段会出现 `no valid input units`，执行层按“跳过并提示”处理。

## 可用函数（M1）

- `getAttachmentParentId(entry)`：获取附件所属父条目 ID
- `getAttachmentFilePath(entry)`：获取附件路径（`filePath`/`data.path`/`title` 回退）
- `getAttachmentFileName(entry)`：获取附件文件名
- `getAttachmentFileStem(entry)`：获取文件名 stem（小写，无扩展名）
- `getAttachmentDateAdded(entry)`：解析附件 `dateAdded` 为时间戳（用于排序）
- `isMarkdownAttachment(entry)`：判断是否 markdown 附件
- `isPdfAttachment(entry)`：判断是否 PDF 附件
- `pickEarliestPdfAttachment(entries)`：从候选集合中选出最早加入的 PDF（同时间按文件名稳定排序）
- `cloneSelectionContext(selectionContext)`：深拷贝选择上下文
- `withFilteredAttachments(selectionContext, attachments)`：返回仅包含指定附件集合的新上下文
- `resolveItemRef(ref)`：将 `Zotero.Item | id | key` 解析为 `Zotero.Item`
- `basenameOrFallback(path, fallback)`：返回文件名或默认值
- `toHtmlNote(title, body)`：生成安全的 HTML note 内容

## 使用建议

- 先使用声明式 `inputs` 完成一阶筛选，复杂输入歧义再放在 `filterInputs`。
- `filterInputs` 内尽量调用 `runtime.helpers` 完成通用判断与排序。
- `chooseMarkdownByPdfOrEarliest` 这类工作流私有规则，建议仅保留在对应 workflow 的 hook 文件中。
- `applyResult` 中涉及 item 解析、HTML note 包装、artifact 文件名处理时优先使用内建函数。
- 当请求终态为 `result`（非 `bundle`）时，`bundleReader.readText()` 不可用会抛错；此时应优先从 `runResult` 读取结果并做分支处理。
- 仅当某逻辑明显是 workflow 私有规则时，再在 hook 内定义局部函数。

## 示例：applyResult

```js
export async function applyResult({ parent, bundleReader, runtime }) {
  const parentItem = runtime.helpers.resolveItemRef(parent);
  const digest = await bundleReader.readText("artifacts/digest.md");
  return runtime.handlers.parent.addNote(parentItem, {
    content: runtime.helpers.toHtmlNote("Digest", digest),
  });
}
```
