# QA cards and primitive reuse audit

Status: first pass complete; scoped fixes are in verify.

## Scope

Fresh QA cards and their core primitives, starting from cards 27-31 and card 29 as requested.

## 2026-07-09 findings

### Card 27 / `useReorderBoard`

- Good: behavior is already hook-first. The reusable behavior lives in `useReorderBoard`; the stand is a visual layer and consumer state.
- Good: adding columns is consumer-owned state; the hook picks up live column refs, which matches the current API contract.
- Risk / UX question: insert strips are visible `+` columns between every board column. This is useful for testing dynamic columns, but the action is visually loud and easy to confuse with item creation. Do not change placement/deletion behavior without a UX decision.
- Done: extracted stand-only styles (`board column`, `board item`, `insert strip`, status) to a small local style object/helpers. This stays in the stand and does not change `useReorderBoard` behavior.

### Card 29 / `ColumnDots` + `CardList`

- Good: behavior is controller-first through `createColumnState`; `ColumnDots` and `CardList` run without ag-grid/storage.
- Good: visual styles now use `.wenayColDots*` / `.wenayCardList*` classes instead of inline/raw component styles.
- Risk: moving the visual styles into shared CSS briefly changed the look too much. The restored default should be treated as the compatibility baseline.
- Safe candidate: add optional CSS variables later only around the restored look; do not switch to a new palette by default.

### Card 30 / grouped sub-columns toolbar menu

- Good: domain behavior is split: `columnState.presentGate` owns runtime availability, `createToolbar({source, sourceMode:"order"})` owns toolbar membership/order/density, and the stand owns the square visual face.
- Good: the horizontal menu is now click-only; movement animation is local FLIP and does not add drag behavior.
- Risk: `Qa30AnimatedMenuBar` is stand-only custom code over `qa30MenuToolbar.api.useItems()`. If this pattern repeats, consider a documented `ToolbarHeadlessBar` example or helper, but do not move the square skin into shared defaults.
- Safe candidate: keep the animation as example code; avoid standardizing its dark square style globally.

### Card 31 / Toolbar over columnState

- Good: this is the canonical integration: grid, toolbar, settings editor, and compact menu mirror one `columnState` config.
- Risk: the card still uses both `Toolbar.Bar` and `ColumnsMenu` to show the same model. That is valid as an integration demo, but docs should make clear which surface is canonical for new app work.
- Done: added a short doc note that `ColumnsMenu` remains a compact/presentation surface, while `createToolbar({source: cs.api.listSource})` is the richer settings-integrated surface.

### Core primitive notes

- `ColumnsMenu/MenuStrip` still has inline visual button styles. This is acceptable for now because it preserves the old compact menu look, but it is a style-system candidate.
- `useReorderBoard` has no style opinions and should stay that way.
- Stand card styles should not automatically become shared default styles. Use classes/tokens only when the primitive itself owns the default visual contract.

## Skipped

- Did not change card 27 add/delete semantics. User already flagged uncertainty around where boxes should go on deletion.
- Did not convert `Qa30AnimatedMenuBar` into library API. It is useful evidence, but not yet a repeated pattern.
- Did not alter `ColumnsMenu` inline styles. That belongs to the style-system normalization task.
## 2026-07-09 small fix

Implemented the safest doc-only fix from the first pass:

- `doc/wenay-react2.md` now says new settings-integrated toolbar/grid surfaces should prefer `createToolbar({source: cs.api.listSource})`.
- `doc/wenay-react2-rare.md` now labels `ColumnsMenu` as the compact/presentation surface and `createToolbar({source})` as the richer Settings-integrated surface.

No behavior or stand UI changed.
## 2026-07-09 small fix 2

Implemented the safest stand-code fix from the first pass:

- Card 27 `BoardDemo` now keeps board/strip/item/status styling in local `qaBoardStyles` and small style helpers.
- `useReorderBoard` remains headless; no drag/drop behavior, add-column behavior, or shared defaults changed.

Verification: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand`; `git diff --check`.
## 2026-07-09 card 29 follow-up

- `ColumnDots` default `max` increased from 4 to 8.
- QA card 29 now demonstrates 8 column fields and renders `ColumnDots` as a bottom overlay on the mobile card stack.
- The overlay is stand/example styling only; `ColumnDots` remains headless over `columnState` and `CardList` remains unchanged.