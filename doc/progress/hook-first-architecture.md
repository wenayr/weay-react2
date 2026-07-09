# Hook-first architecture for shared functionality

Status: verify; first inventory pass and low-risk input helper hook extraction implemented.

## Source

User clarification: most shared functionality should be implemented as hooks or
headless controllers. A hook/controller may return data, methods, getters, or a
small API object. Visual layers and QA stand cards should use that headless
surface instead of owning the behavior directly.

## Standard

- New reusable behavior starts as `use*` or `create*` API.
- Components are thin renderers over that API.
- Stand cards demonstrate the API plus one visual layer; they must not become
  the only implementation of the behavior.
- If a visual standard is needed, build a component/layer that consumes the
  hook/controller.
- App/domain policy stays above the shared hook/controller.

## First audit candidates

- `SettingsDialog`: search/tree/history behavior now works, but much of the
  tree controller still lives inside the component. Candidate:
  `useSettingsDialogTree` or `createSettingsTreeController`.
- `ParamsEditor`: expand/edit/input behavior is component-owned. Candidate:
  headless params editor controller plus renderer.
- `FloatingWindow`: drag/position/viewport persistence is mostly visual
  component behavior. There is `useDraggableApi`, but the window-level API is
  not separated yet.
- `Input` modal helpers: panel/modal behavior is mixed with JSX. Candidate:
  keep `useModal` as canonical path and move old helpers to compatibility docs.
- `LeftModal` / app-shell menu helpers: likely app-shell layer, not core
  primitive. Candidate: document as compatibility or extract a controller if
  still used generically.

## Done

- Added the hook/controller-first rule to project functionality docs.
- Added usage-standard guidance and anti-pattern entry.
- Added migration wording to the rare API guide.
- Added target task for an audit and safe conversions.

## Verification

- Documentation-only change.
- Passed: scoped `git diff --check` on tracked touched docs.
- Passed: trailing-whitespace scan on touched docs.
## 2026-07-09 inventory pass and safe conversion

Inventory result:

- `SettingsDialog`: still the largest hook-first candidate. Search history is already a controller (`createSearchHistory`), but tree expansion/search selection/nav resize still live inside the component. Do not split this without focused tests around keyboard/search/divider behavior.
- `ParamsEditor`: high-risk candidate. Expand/edit/debounce behavior and legacy rendering are tightly coupled; postpone broad extraction until an API plan exists.
- `FloatingWindow`: has `useDraggableApi`, but window-level persisted position/size/z-index/viewport clamp logic remains in `FloatingWindowBase`. Candidate for a later `useFloatingWindowState` pass.
- `Input` modal helpers: low-risk candidate. `TextInputPanel` and `FileInputPanel` only owned current value/file refs and submit callbacks; safe to extract headless hooks without changing JSX behavior.
- `LeftModal` / app-shell helpers: likely compatibility/app-shell layer. Do not extract until generic use is confirmed.

Implemented safe conversion:

- Added `useTextInputPanel({callback, txt?})`, returning `inputProps`, `submit`, `getValue`, and `setValue`.
- Added `useFileInputPanel({callback})`, returning `inputProps`, `submit`, `getFile`, and `setFile`.
- Kept `TextInputPanel`, `FileInputPanel`, `TextInputModal`, and `FileInputModal` public components compatible; they now consume the hooks as visual wrappers.
- Added `__test/inputPanelHooks.test.tsx` for panel submit behavior and direct headless hook API.

Verification: `npx tsc -p tsconfig.qa-check.json --noEmit`; `npm run testjest -- --runInBand __test/inputPanelHooks.test.tsx`; `npm run testjest -- --runInBand`; `npm run build`; `git diff --check`.