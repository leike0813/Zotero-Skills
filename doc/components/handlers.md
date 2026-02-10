# Handlers 组件说明

## 目标

提供一组面向 Hook 脚本的通用 Handler，使用户以自明的接口完成“新增/更新/删除/挂接”类操作。

## 设计原则

- 按对象域划分：Parent / Note / Attachment / Tag / Collection / Command  
- 挂接行为归 ParentHandler，本体修改归各自 Handler  
- 命名统一：add / create / update / remove / replace / run  

## Handler 分层

### ItemHandler（通用条目）

- `create({ itemType, parent?, data?, fields?, libraryID? })`：创建条目  
- `setParent(item, parent?)`：设置父条目  
- `remove(item)`：删除条目  

说明：
- `item` 可以是对象、id 或 key  
- `data` 会被过滤为可写字段  
- `updateFields` 类操作会进行字段合法性校验（非法字段抛错）

### ParentHandler（父条目）

- `addNote(parent, notePayload)`：在父条目下创建子笔记  
- `addAttachment(parent, fileSpec)`：在父条目下添加附件  
- `addRelated(parent(s), relatedItems)`：关联其他父条目  
- `removeRelated(parent(s), relatedItems)`：移除关联  
- `updateFields(parent, patch)`：更新父条目字段

### NoteHandler（笔记本体）

- `create(notePayload)`：创建独立笔记  
- `update(note, patch)`：更新笔记内容  
- `remove(note)`：删除笔记

### AttachmentHandler（附件本体）

- `create(fileSpec)`：创建独立附件  
- `createFromPath({ parent?, path?, dataPath?, itemKey?, libraryID?, title?, mimeType?, allowMissing? })`：从路径创建附件  
- `update(attachment, patch)`：更新附件属性  
- `remove(attachment)`：删除附件  

说明：
- `fileSpec` 运行时仅支持 `{ file }`。类型层面保留 `{ filePath }` 兼容分支，但传入会显式抛错；路径场景请使用 `createFromPath`  
- `createFromPath` 支持 `attachments:` / `storage:` 路径解析  
- `mimeType` 会映射到附件字段 `contentType`（字段存在才写入）  

### TagHandler（标签）

- `list(item)`：获取标签列表  
- `add(item, tags[])`：添加标签  
- `remove(item, tags[])`：移除标签  
- `replace(item, tags[])`：替换为指定标签集合  

说明：
- 标签必须为非空字符串，否则抛错  

### CollectionHandler（集合）

- `create({ name, libraryID? })`：创建集合  
- `delete(collection)`：删除集合  
- `add(itemOrItems, collection)`：加入集合  
- `remove(itemOrItems, collection)`：移出集合  
- `replace(itemOrItems, collections[])`：替换集合列表  

说明：
- `collection` 支持 id / key / Collection  
- 目标集合不存在会抛错  

### CommandHandler（命令）

- `run(commandId, args, context)`：执行命令/动作

## 责任边界

- Handler 只处理数据写入/变更，不负责后端交互  
- Handler 可被 Hook 脚本直接调用  
- 单个 Handler 失败不应阻断其他 Handler（由 Hook 决定策略）

## 测试点（TDD）

- ItemHandler：create / setParent / remove  
- ParentHandler：addNote / addAttachment / addRelated / removeRelated / updateFields  
- NoteHandler：create / update / remove  
- AttachmentHandler：create / createFromPath / update / remove  
- TagHandler：add / remove / replace / list  
- CollectionHandler：create / delete / add / remove / replace  
- CommandHandler：run（最小可执行）
