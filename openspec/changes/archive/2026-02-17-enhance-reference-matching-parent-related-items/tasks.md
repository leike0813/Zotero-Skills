## 1. Parent Related Update Path (TDD)

- [x] 1.1 先写测试：匹配成功后，把命中条目添加到 references note 对应父条目的 related items
- [x] 1.2 在 `workflows/reference-matching/hooks/applyResult.js` 增加父条目解析与关联写入逻辑
- [x] 1.3 先写测试：仅命中子集时，只添加命中项关联

## 2. Idempotency Guard (TDD)

- [x] 2.1 先写测试：重复执行同一输入时，不重复添加相同 related item
- [x] 2.2 实现“已有关联集合”去重与差量写入（set-diff）
- [x] 2.3 先写测试：父条目预置部分关联时，仅补齐缺失关联

## 3. Safety and Fallback

- [x] 3.1 先写测试：references note 无父条目时，关联写入跳过且流程可预期结束
- [x] 3.2 增加诊断输出（added/skipped/existing counts）便于回归定位

## 4. Verification

- [x] 4.1 运行受影响 workflow 测试分组（至少 `test/workflow-reference-matching/**/*.test.ts`）
- [x] 4.2 运行 `npx tsc --noEmit`
