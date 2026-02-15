## 1. Bridge Contract and Utilities

- [x] 1.1 新增 runtime bridge 合同与能力解析模块（覆盖 `ztoolkit`/`addon`/window 能力）
- [x] 1.2 定义统一能力返回结构与降级语义（available/unavailable + fallback）
- [x] 1.3 提供测试注入与重置接口（仅用于测试路径）

## 2. Module Migration (HB-06 Priority Path)

- [x] 2.1 迁移执行反馈相关模块到 bridge（toast/dialog 入口）
- [x] 2.2 迁移关键启动/运行入口中分散全局读取逻辑到 bridge
- [x] 2.3 清理迁移后冗余判空分支与重复 fallback 代码

## 3. Verification and Regression

- [x] 3.1 新增/更新 bridge 单元测试（能力解析、降级、注入重置）
- [x] 3.2 新增/更新关键集成测试，验证迁移前后行为一致
- [x] 3.3 运行 node/zotero 相关回归套件，确认无行为回归

## 4. Traceability Closure

- [x] 4.1 在变更说明中明确记录 HB-06 映射与完成证据
- [x] 4.2 更新相关架构文档中的全局桥接访问约定引用
