# Tag Manager

## 用途

标签受控词表 (Controlled Vocabulary) 的完整管理界面，提供增删改查、批量导入导出、分面过滤等功能。

该 workflow 为纯本地执行 (pass-through)，不依赖任何外部后端服务，用于维护标准化的标签体系。

## 输入约束

| 约束类型 | 说明                       |
| -------- | -------------------------- |
| 输入单元 | 无特定输入（独立 UI 入口） |
| 触发方式 | 右键菜单选择 "Tag Manager" |

## 运行过程

```
1. 启动界面
   └── 加载受控词表 (tagVocabularyJson)
       └── 加载暂存区 (tagVocabularyStagedJson)

2. 用户操作
   └── 受控词表面板
       ├── 添加标签
       ├── 编辑标签（tag、facet、note、deprecated）
       ├── 删除标签
       ├── 搜索过滤
       ├── 分面过滤 (field/topic/method/model/ai_task/data/tool/status)
       └── 导出标签

   └── 暂存区面板
       ├── 查看暂存标签
       ├── 批量提升到受控词表
       ├── 删除暂存
       └── 清空暂存区
```

### 导入/导出功能

#### 导入 YAML

- 支持 YAML 格式批量导入
- 支持重复处理策略：skip / overwrite / error
- 支持 Dry Run 模式预览结果

#### 导出

- 导出为纯标签字符串列表（每行一个）
- 支持复制到剪贴板

## 运行产物

### 1. 受控词表存储

- **位置**: Zotero prefs `tagVocabularyJson`
- **格式**: JSON
- **结构**:

```json
{
  "version": 1,
  "entries": [
    {
      "tag": "topic:machine-learning",
      "facet": "topic",
      "source": "manual",
      "note": "机器学习相关文献",
      "deprecated": false
    }
  ]
}
```

### 2. 暂存区存储

- **位置**: Zotero prefs `tagVocabularyStagedJson`
- **格式**: JSON
- **结构**: 类似受控词表，额外包含 `createdAt`, `updatedAt`, `sourceFlow` 字段

## 标签格式规范

### 标签格式

- 格式: `facet:value`
- 正则: `^[a-z_]+:[a-zA-Z0-9/_.-]+$`
- 示例: `topic:neural-network`, `method:transformer`

### Facet 类型

| Facet     | 说明     |
| --------- | -------- |
| `field`   | 研究领域 |
| `topic`   | 主题     |
| `method`  | 方法     |
| `model`   | 模型     |
| `ai_task` | AI 任务  |
| `data`    | 数据类型 |
| `tool`    | 工具     |
| `status`  | 状态     |

### 标签字段

| 字段         | 类型    | 说明                                  |
| ------------ | ------- | ------------------------------------- |
| `tag`        | string  | 完整标签 (facet:value)                |
| `facet`      | string  | 分面类型                              |
| `source`     | string  | 来源 (manual/import/agent-suggest 等) |
| `note`       | string  | 备注说明                              |
| `deprecated` | boolean | 是否已废弃                            |

## 依赖

- 无外部依赖（纯本地执行）
- 数据存储在 Zotero prefs 中

## 相关工作流

- [tag-regulator](../tag-regulator/README.md): 使用受控词表规范化标签
