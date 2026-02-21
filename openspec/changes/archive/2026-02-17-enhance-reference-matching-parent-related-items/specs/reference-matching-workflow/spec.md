## MODIFIED Requirements

### Requirement: 系统必须为每条参考文献执行高置信匹配并在父条目写入关联引用
系统 MUST 在 references note 回填 citekey 后，将命中的库内文献条目作为 related items 写入该 note 的父条目。

#### Scenario: 匹配成功后同步更新父条目关联
- **WHEN** references note 中一条或多条参考文献被高置信匹配到库内条目
- **THEN** 系统 SHALL 回填 citekey 到 payload/表格
- **AND** 系统 SHALL 将对应命中条目关联到该 references note 的父条目

#### Scenario: 仅部分匹配成功
- **WHEN** 仅部分参考文献命中
- **THEN** 系统 SHALL 仅为命中项写入父条目关联
- **AND** 未命中项 SHALL NOT 创建关联

#### Scenario: references note 无父条目
- **WHEN** 输入 references note 无可解析父条目
- **THEN** 系统 SHALL 跳过关联写入
- **AND** 保持 citekey 回填流程的可预期行为（不因关联阶段崩溃）

### Requirement: 父条目关联写入必须幂等
系统 MUST 以幂等方式维护父条目 related items，重复执行同一 workflow 不得重复添加同一关联。

#### Scenario: 重复执行同一输入
- **WHEN** 对同一 references note 重复执行 reference-matching
- **THEN** 已存在的 related item SHALL NOT 被重复添加
- **AND** 父条目关联集合在重复执行后保持稳定

#### Scenario: 父条目已存在部分关联
- **WHEN** 父条目已含本次命中集合的子集
- **THEN** 系统 SHALL 仅补齐缺失关联
- **AND** 已存在关联保持不变
