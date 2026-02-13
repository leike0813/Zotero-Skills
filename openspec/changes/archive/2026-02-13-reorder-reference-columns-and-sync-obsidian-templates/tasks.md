## 1. Change Setup

- [x] 1.1 Create OpenSpec change artifacts (`proposal`, `design`, `tasks`, delta specs)

## 2. Canonical Renderer Reorder

- [x] 2.1 Update shared references table header order to `Authors -> Source -> Locator`
- [x] 2.2 Update shared references row cell order to `Authors -> Source -> Locator`
- [x] 2.3 Keep source precedence and locator composition logic unchanged

## 3. Obsidian Template Sync

- [x] 3.1 Enhance `workflows/literature-digest/assets/zt-note.eta` to render `Source` and `Locator`
- [x] 3.2 Ensure `zt-note.eta` references table column order matches canonical renderer
- [x] 3.3 Enhance `workflows/literature-digest/assets/zt-field.eta` references rows to include `Source` and `Locator`
- [x] 3.4 Ensure `zt-field.eta` row order matches canonical renderer

## 4. Test and Verification

- [x] 4.1 Update affected tests for new header/column positions
- [x] 4.2 Run `npx tsc --noEmit`
- [x] 4.3 Run `npm run test:node:full`
