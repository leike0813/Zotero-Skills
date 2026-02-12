## 1. 输入路由与执行单元拆分（TDD）

- [x] 1.1 先编写测试：父条目下包含合法 references note 时可通过 `filterInputs`
- [x] 1.2 先编写测试：两个父条目输入会产出两条独立请求记录（不打包）
- [x] 1.3 实现 `workflows/reference-matching/hooks/filterInputs.js` 的父条目扫描与 note 归一化
- [x] 1.4 实现 `src/workflows/runtime.ts` 的 pass-through 多 note 单元拆分语义

## 2. BBT HTTP 路径与端口配置（TDD）

- [x] 2.1 先编写测试：`data_source=bbt-json` 时调用本地 BBT JSON-RPC 并参与匹配回写
- [x] 2.2 先编写测试：BBT 端点不可达时返回明确错误且不发生部分回写
- [x] 2.3 在 `workflow.json` 增加 BBT 端口参数声明（默认 23119，数值约束）
- [x] 2.4 实现 `workflows/reference-matching/hooks/applyResult.js` 的 BBT JSON-RPC 数据源适配

## 3. Workflow Settings 端口设置与校验（TDD）

- [x] 3.1 先编写测试：Workflow Settings 可读取/保存 reference-matching 的 BBT 端口
- [x] 3.2 先编写测试：非法端口值被拒绝并回退到最近有效值或默认值
- [x] 3.3 实现 Workflow Settings UI 与设置流中的端口编辑与校验逻辑

## 4. 回归验证与文档

- [x] 4.1 执行 `npm run build`
- [x] 4.2 执行 `npm run test:node:full`
- [x] 4.3 更新 `doc/components/workflows.md`（父条目输入、拆分语义、BBT 端口配置）
