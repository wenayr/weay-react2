# Menu compatibility and statistics

Status: action-level stats implemented; RightMenu diagnostics deferred.

## Compatibility policy

- New hook/controller APIs should usually keep old public component APIs working during internal refactors.
- Compatibility is not absolute: an aggressive migration is allowed when it is an explicit migration cut.
- Legacy paths can be marked as compatibility/low-level, but not silently removed.
- Removal requires a separate breaking-release task, migration notes, changelog, and usage signal that the old path is no longer important.
- Default style removal is stricter than API migration: keep a replacement class/token path before removing old default visuals.

## Menu statistics idea

Add optional local diagnostics for menu primitives. This must be a library-local
counter/listen API, not hidden analytics and not network reporting.

Suggested shape:

- `contextMenu.stats.getSnapshot()`
- `contextMenu.stats.reset()`
- `contextMenu.stats.onChange(cb) -> off`

Useful counters:

- `openAt` / `openAtPoint` usage.
- legacy `contextMenu.map` / queued path usage.
- open count by `source` / `layerId`.
- close reasons where known: item click, outside click, escape, replace.
- item click count by stable action key when provided.
- submenu open count and async menu error count.

Privacy/default rule:

- Do not store arbitrary item labels by default.
- Prefer explicit `actionKey` / `source` fields from the app.
- Per-action counters use only `MenuItemStrict.actionKey`; unkeyed items update aggregate `actionTotals` only.
- Keep counters in memory by default; persistence should be app-owned.

## Right-button menu focus

The first candidate is the mouse/right-click menu surface:

- `contextMenu.openAt(event, items, {source?, layerId?})`
- legacy `contextMenu.map` path consumed by `contextMenu.Layer`
- lower-level `Menu` item click/submenu/async behavior

`DropdownMenu` / `createRightMenuController` can get a smaller counter later:
open/fixed/select/drag/persist events.
## 2026-07-09 active pass

Status: in progress.

Chosen first because it is the smallest Ready task with a safe first step: a local in-memory diagnostics API for `contextMenu` can be added without changing visual behavior or removing legacy paths.

Plan:

1. Add `contextMenu.stats.getSnapshot/reset/onChange` to `createContextMenu()`.
2. Count direct `openAt`, `openAtPoint`, legacy Layer queued opens, empty opens, close, replace, and source/layer usage.
3. Add focused tests that prove counters are local, resettable, and subscribe-able.
4. Update docs/changelog for the implemented subset.

Skipped for this pass:

- Item click counts and submenu/async error counts, because `Menu`/`MenuElement` currently do not carry stable action keys through the right-click layer; adding that needs a separate API shape decision.
- RightMenu/DropdownMenu counters, because `contextMenu` is the lower-risk first surface.
## 2026-07-09 implementation result

Status: moved to Verify.

Implemented:

- `ContextMenuStatsSnapshot` / `ContextMenuStats` public types.
- `contextMenu.stats.getSnapshot()` returns a cloned snapshot.
- `contextMenu.stats.reset()` clears counters and emits to listeners.
- `contextMenu.stats.onChange(cb)` subscribes to local counter changes.
- Counters: `openAt`, `openAtPoint`, `legacyLayer`, `close`, `replace`, `empty`, `sources`, `layers`.
- Legacy `contextMenu.map` + `Layer` queue path remains supported; opening through it increments `legacyLayer` and still clears the map on consume.

Verification:

- `npx tsc -p tsconfig.qa-check.json --noEmit`
- `npm run testjest -- --runInBand __test/contextMenuStats.test.tsx`
- `git diff --check -- src/common/src/menu/menuMouse.tsx __test/contextMenuStats.test.tsx doc/wenay-react2.md doc/wenay-react2-rare.md doc/changes/v1.0.39.md doc/target/my.md doc/progress/menu-compat-stats.md`

Deferred after first pass:

- Item click counters by action key.
- Submenu open counters.
- Async menu error counters.
- RightMenu/DropdownMenu diagnostics.

## 2026-07-09 action-key pass

Status: implemented, pending full final verification after docs/target updates.

Implemented:

- `MenuItemStrict.actionKey?: string | null` as the explicit diagnostics key.
- `MenuActionEvent` / `MenuActionHandler` wiring through `Menu`, nested menu layers, and `contextMenu.Layer`.
- `ContextMenuStatsSnapshot.actionTotals` aggregate counters for click/ok/error/task/submenu/func/focus outcomes.
- `ContextMenuStatsSnapshot.actions` keyed counters for explicit `actionKey` values only.
- Snapshot cloning and reset cover action counters; labels and errors are not stored.
- QA card 4 now supplies `qa4.*` action keys for manual right-click checks.

Tests added:

- keyed action increments totals and `actions[actionKey]` without storing the visible label;
- unkeyed action increments totals only;
- keyed submenu open increments submenu counters.

Still deferred:

- RightMenu/DropdownMenu diagnostics and controller cleanup; this is the next small related task.
- A deeper `useMenuActionController` extraction. Current pass kept the visual DOM/classes stable and only added event wiring; a full hook/controller split is larger than needed for action stats.