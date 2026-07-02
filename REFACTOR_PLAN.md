# Improvement and Fix Plan for `wenay-react2`

> Status: **execution started** (2026-06-06). The safe batch has been applied; see "Done".
>
> The library is **legacy** and is used by other projects. **Main rule: do not break the public API.** All exported methods remain. If a fix changes public behavior, the new functionality must stay behind the old signature plus an `@deprecated` note saying it will stop working soon.
>
> **REQUIRED:** every fix is verified on the QA stand (`src/common/testUseReact/qa.tsx`, `npm run testReact` -> `localhost:3010`). If a fix is invisible (leak/internal), state that explicitly and verify it with `tsc --noEmit` plus code review.
>
> Keep **minimal comments** in code, almost none. For deprecation, see section 6.

> This document contains only the **remaining** work. Completed items were removed from the lists; completed details are in git history/commits. The remaining work is almost entirely **complex**: K2 (rewrites, perf/leaks not visible on the stand), K3 (product decisions like password `"111"`/`keySave`, global state), KB (build: duplicate React, ESM/CJS), and Part II (redesigns). The easy safe layer has been exhausted.

---

## How to Read This Document

Fixes are grouped by increasing risk:

| Cat. | Name | Tests | Description |
|------|------|-------|-------------|
| **K0** | Minimal (harmless) | not needed | Cosmetics, dead code, `console.log`, comments, type typos. Do not change behavior. |
| **K1** | Easy (low risk) | quick manual check | Local fixes: `useEffect` cleanup, `key`, small guards. Behavior barely changes. |
| **K2** | Complex (careful) | tests needed | Hook/effect rewrites, subscription refactoring, performance, regression risk. |
| **K3** | Business logic / public API changes | tests + approval + consumer checks | Fix broken features (change observable behavior), touch export signatures, global state, or data format. |
| **KB** | Build / publishing / deprecation | build and install checks | Package config, module format, deprecation marking. |

For each fix: `file:line` - problem summary - what to do.

---

## K0 - Minimal (Harmless, No Tests Required)

> **Done 2026-06-12** (dead LeftModal code, inputAutoStep comments, AXIS_THICKNESS, onWheel casts, myChart constants). Remaining:

- `copyCompiledFiles.mjs:12-16,39` - `if (0)` branches and the `if (1)` wrapper. **Remove.** (Build file; by KB agreement, do not touch it without discussion.)
- ~~`cache.ts:31` - extra unused generic `<T>` on `delete`.~~ **MOVED to K3** - method is on exported classes, and removing the generic breaks compilation for consumers that call `delete<X>(key)`.

---

## K1 - Easy (Low Risk, Quick Check)

> **Done 2026-06-12** (cleanup leaks, drag-effect deps, Drag2 onStop gate, dirty flag in both render loops, controlled value, map.has, styleGrid, menuR order, RightMenu guard, touchstart, stable keys in MiniButton/menu/RightMenu). Remaining:

- `Other.tsx:36` (`key={i}`) - intentionally left as is: the parameter list is not reordered and items have no stable id.
- `logs` grids - indexed keys were not found by grep; apparently already fixed earlier.

---

## K2 - Complex (Tests Needed, Regression Risk)

> **Done 2026-06-12** (checked with temporary jest tests, run and removed): useDraggable rewritten; DivRnd3 without useMemo-in-callback; StickerMenu subscribes once; menu.tsx stale guard in async effects (deps intentionally unchanged); chartEngine x2 - binary range search, dirty flag, minMaxChunks getter; MyResizeObserver batch; updateBy clean getSnapshot; inputAutoStep addEventListener+disposer and robust 0.1 power detection. Remaining:

- ~~`menu.tsx:386-401` `useLayoutEffect` drift~~ - **done 2026-06-12**: idempotent recalculation "from base" (coordinate), no accumulation. Verify menu placement near bottom/right edges on the stand (cards 3, 4-archive).
- ~~`myChart.ts` destroy on temp-detach~~ - **done 2026-06-12**: 10s grace period (pause -> reconnect -> forced redraw); auto-destroy after timeout preserved.
- `logs.tsx:132-218` - `Main = useCallback(..., [true])` freezes the component, closing over `rowData/setting` from the first render (stale closure). It works only because data flows through the transaction API. **Do not fix locally**; close it through Part II (`react/logs` on `core/store`). A local fix would need permanent tests, which conflicts with the temporary-test policy.
- `ParametersEngine.tsx:205-214,244` - `_inputNumStrMap` (WeakMap by `range` identity): the cache of a partially typed value is lost when `range` is recreated. **Deferred**: `InputNumber` is a flat function without field identity; the correct solution is componentization (Part II section F).

---

## K3 - Business Logic / Public API Changes (Approval + Tests + Consumer Checks)

> Warning: the items below **fix broken features**, so they change observable behavior. Consumers may already have adapted to the current broken behavior. **Before fixing, check real usage in consumer projects.**

### Broken Features (Currently Not Working)
- ~~`useOutside.tsx` keySave~~ - **done 2026-06-12**: status is written to `saveStatus` on every toggle (in-memory session persistence), restore handles `false` too.
- ~~`RNDFunc.tsx:27` (Drag2) swapped x/y~~ - **done 2026-06-12**: default `{x, y}`. Behavior is almost unobservable (mousedown/layout-effect overwrote the ref), but consumers that compensated for it will notice.
- `LeftModal.tsx` - three different elements write to the same `viewportSize.current` ref, so animation math uses "who rendered last"; the ternary checks `viewportSize.current` but uses `viewportWidth`. **Deferred**: can only be fixed with a LeftModal QA card (Modal2 is a fullscreen overlay and does not fit the current stand grid; a separate hash route is needed).
- `LeftModal.tsx` (`LeftMenuComponent`) - prop `api(setMenu)` is declared but not called, so the contract is dead (currently no-op). **Deferred** together with the previous item; requires deciding what `api` must be able to do.
- ~~`LeftModal.tsx` (Modal2) setMenu during render~~ - **done 2026-06-12**: moved to `useEffect` + `renderBy`.

### Global State / Import Side Effects
> Items about global state / mutation of foreign data (RNDFunc3 `k`/`openWindows`, `it.status` mutation in menu.tsx, `elements` in RightMenu, `HostName`/`ObjectStringToDate` in cache.ts) are **deferred by user decision 2026-06-12** and should be closed through Part II.

- ~~`Modal.tsx` (`confirmModal`) password `"111"`~~ - **done 2026-06-12**: optional `password` parameter (default `"111"` for compatibility; the custom password is not shown in the prompt).
- `RNDFunc3.tsx:97,116-121,236-243` - module-global `k`/`openWindows`, `updateBy(...)` during render, mutation of shared `size/position` objects. Global state is shared between all instances/bundles. **Isolate state** (high regression risk; maybe leave with documentation).
- `menu.tsx:262-265` - `onMouseEnter` mutates `it.status` on objects passed by the consumer (`fullArray`). **Do not mutate props** (or explicitly document the contract).
- `RightMenu.tsx:227-234` - `set/delete` mutate the shared closure array `elements`, and `render?.(elements)` passes the same reference (React may skip rerender); state is shared between all `<Render/>` instances. **Use immutable updates + a fresh array in render.**
- `cache.ts:9` - `const HostName = location.toString()` at module level: fails in SSR/Node; key depends on hash/query. **Guard with `typeof location` + `location.origin+pathname`.** (Changes the key value -> affects cache hits.)
- `cache.ts:92-99` (`ObjectStringToDate`) - aggressively converts any ISO string to `Date` on load. **Narrow/document it** (changes data shape).

### Signatures / Duplicate Implementations
- **`chartEngine.ts` <-> `chartEngineReact.tsx`** - **confirmed 2026-06-12: chartEngine.ts is NOT public**. Nobody imports it (neither api.tsx nor the stand), it is not included in the build, and library tsc does not check it. Marked `@deprecated` in the file header, candidate for removal when merging into `core/chart`. The public engine is only `chartEngineReact.tsx`.
- `applyTransactionAsyncUpdate.tsx:43,46` - `remove` is sent in both the add transaction and async-update transaction; when both `arrNew` and `arr` are empty, deletion is silently lost. **Run deletion exactly once, independent of add/update.**
- `applyTransactionAsyncUpdate.tsx:15,52,72` - `getId: (...a: any[]) => string` (too broad). Narrowing to `(row: Partial<T>) => string` **may break** loosely typed calls -> keep as is or change only in a major version.
- `cache.ts:31,56` - degenerate generic `<T extends object>` on `delete` in **exported** classes `CSaveToCache`/`CSaveToLocalStorage` (`T` is unused). Removing the generic is type-breaking for consumers using `delete<X>(key)`. **Leave as is or remove only in a major version** (can mark redundancy in a comment). Interface `IServerSaveBasePromise.delete` is already non-generic, so classes diverge from the interface.
- `arrayPromise.tsx:7-15` - counters `ok/countError` are correct only under strictly sequential thunk execution; with `Promise.all` there is a race. **Document the contract** (or compute from settled results, which changes behavior).

---

## KB - Build, Publishing, Module Format

> Highest impact priority: the package in its current form may not work for some consumers.

- **Module format (critical).** `lib/index.js` is emitted as **ESM** (`export`/`import`), but `package.json` has no `"type": "module"`, while `main`/`types` point to a CJS path. `tsconfig_lib.json` (`module:"commonJS"`) is copied to `lib/tsconfig.json`, but it is **not used by the real build** (`tsc --build` with root `tsconfig.json`, `module:ESNext`) and is effectively abandoned. Node consumers in CJS mode will get an error. **Decide:** either `"type":"module"` + ESM, or build CJS (`module:"CommonJS"`) in the active tsconfig; remove unused `tsconfig_lib.json`.
- `package.json:6-7 vs 84-86` - `main`/`types` -> `dist/index.js`/`dist/index.d.ts`, while `exports["."]` -> `./lib/index.js`. After `_afterBuild`, the contents of `dist` are published (where `lib/` exists), so `dist/index.js` does not exist. **Align `main`/`types` to `./lib/index.js` / `./lib/index.d.ts`.**
- `src/index.ts:2,4` (and `lib/index.js`) - `import {test} ...; test()`: side effect on every package import. **Remove the call** (export `test` can remain for compatibility).
- `api.tsx:2-3` - top-level CSS imports (`menuRight.css`, `style.css`): breaks SSR/Node and hurts tree-shaking. **Keep imports but add `"sideEffects": ["**/*.css"]`** to package.json (bundlers will not drop CSS, while JS remains tree-shakeable). Alternative: separate `wenay-react2/styles` entry.
- `package.json` - **no `"sideEffects"`.** With CSS imports + `export *` barrel, bundlers cannot safely tree-shake. **Add `"sideEffects": ["**/*.css"]`.**
- `package.json:34-41` - `react`/`react-dom` are both in `dependencies` **and** `peerDependencies` -> two React copies for the consumer (invalid hook call / context desync). **Remove from `dependencies`, keep only peer.** Check `ag-grid-*` the same way (keep as dep only if really bundled).
- `package.json:16,19` - duplicate scripts `_publish`/`publish`; `publish` is a reserved npm lifecycle name (re-trigger on `npm publish`). **Rename `publish` -> `release`.**
- `package.json:73` - `engines.vscode: "^1.22.0"` is meaningless for an npm library (npm warns). **Remove.**
- **Exclude test files from publishing.** Currently `src/test.ts`, `src/testReact.tsx`, `src/common/testUseReact/**` do not enter the bundle only because `tsconfig.json` has `files:["src/index.ts"]`. **Add a safety net:** add `exclude` in tsconfig (`src/test*.{ts,tsx}`, `src/common/testUseReact/**`) and/or `.npmignore`, in case the build graph changes later.
- `copyCompiledFiles.mjs` - `maxRetries:1` on `rmSync` can flake on Windows; placeholder branches `if(0)/if(1)` (see K0).

---

## 6. Deprecation - "Mark It as Going Away Soon" Strategy

Goal: signal consumers to update/migrate without breaking current builds.

Layered marking, from soft to hard:

1. **Registry-level (recommended):** after publishing
   ```
   npm deprecate wenay-react2@"*" "Package is becoming obsolete and will soon stop receiving updates. Migrate to <replacement>."
   ```
   This is **not a package.json field**; the command marks versions in the registry, and consumers see a warning on `npm install`. It does not break installation.
2. **README banner** at the top: "DEPRECATED - package is in maintenance mode, new projects should not use it. End-of-updates date: <...>." (create `README.md`; currently it does not exist, and copyCompiledFiles copies it if present).
3. **JSDoc `@deprecated`** on the most problematic/obsolete exports (especially one of the two `chartEngine` versions, `test`, `DropdownMenuTest`, test components). IDEs will strike through usage without breaking runtime.
4. **One-time `console.warn`** on first import (optional, carefully; do not turn the entry into a noisy side effect):
   ```ts
   if (!globalThis.__wenayReact2DeprecationWarned) {
     globalThis.__wenayReact2DeprecationWarned = true;
     console.warn("[wenay-react2] is becoming obsolete; see README.");
   }
   ```
   Note: the current KB strategy makes the entry **side-effect-free**; this warning conflicts with that, so either accept a controlled warning or limit deprecation to items 1-3.
5. **Versioning:** release all breaking changes from K3/KB **only as a major version** (semver), with CHANGELOG and migration notes.

---

## 7. Recommended Work Order

1. **KB** (build/publishing) - without this, the rest will not reach consumers correctly. First resolve ESM/CJS and `main`/`exports`, remove the `test()` side effect, add `sideEffects`, and separate react/peerDeps.
2. **K0** - large safe cleanup, can be one PR with quick review.
3. **K1** - local leak/perf fixes by module, with a quick check.
4. **Add tests** (jest is already configured) for key nodes before K2/K3: `updateBy`, `applyTransactionAsyncUpdate`, drag hooks, logs grids, chart engine.
5. **K2** - under test coverage, one node at a time.
6. **K3** - only after usage audit in consumer projects; release as a major with a migration guide.
7. **Deprecation** (section 6) - in parallel: README + `npm deprecate` can be done now; `@deprecated` annotations as obsolete APIs are identified.

---

## 8. Top Priorities (Real Bug Summary)

| # | Finding | File:line | Cat. |
|---|---------|-----------|------|
| 1 | ESM emit without `"type":"module"` / broken `main` | package.json + tsconfig | KB |
| 2 | `react` in deps and peerDeps (duplicate React) | package.json:34-41 | KB/K3 |
| 3 | `test()` side effect on import | index.ts:4 | KB |
| 4 | `useDraggable` re-subscribe + timer/listener leaks | useDraggable.tsx | K2 |
| 5 | `getSnapshot` with side effect in the reactivity core | updateBy.ts:74-104 | K2 |
| 6 | Drag2 swaps x/y in default | RNDFunc.tsx:27 | K3 |
| 7 | two diverging chart engine copies | chartEngine.ts / chartEngineReact.tsx | K3 |

---
---

# Part II - Super Refactor (Ideal Architecture)

> This is a **separate track** with a different execution model from K0-K3. K0-K3 fix existing code **in place**. Part II describes **the target state**: target architecture and migration strategy through **temporary duplication** (Strangler Fig pattern + adapters).
>
> **Principle:** first write the "new way" next to the "old way" without touching the old code -> cover the new code with tests -> route old signatures to the new core through thin adapters -> release a major where the old API still works but is marked `@deprecated` ("will be removed soon"). Remove the old code in the next major.

---

## 9. Target Architecture (Ideal)

### 9.0. Systemic Flaws in the Current Code (What We Are Fixing)
1. **Global mutable module-level state** (`KeyDown`, `openWindows`, `saveStatus`, `k`, singleton APIs in `LeftModal`, `RightMenu`, `menuMouse`) - shared between all instances and bundles, breaks in StrictMode and with multiple package copies.
2. **Mutation of foreign objects as a "feature"** (`mapMemory`, `Resizable`, `RNDFunc3`, `menu.tsx`, `applyTransactionAsyncUpdate`) - side effects on consumer data.
3. **Two or more copies of the same thing** (`chartEngine.ts` <-> `chartEngineReact.tsx`, `logs.tsx` <-> `logs3.tsx`, `Parameters` <-> `ParametersEngine`, `RNDFunc` <-> `RNDFunc3`).
4. **Manual DOM event/subscription handling** instead of idiomatic React (`inputAutoStep` through `on*`, hand-rolled drag, re-subscribe on every tick).
5. **Import and render side effects** (`test()`, top-level CSS, seeded test menu, `setMenu` in render, impure `getSnapshot`).
6. **Weak typing** (`any`, `(...a:any[])`, `{}` types).
7. **Build**: ESM emit under a CJS wrapper, no dual-build, no proper `exports`.

### 9.1. Target Directory Structure
```
src/
  core/                      # framework-agnostic, no React, no DOM side effects
    store/                   # reactive store (replacement for updateBy)
    chart/                   # chart core (math, render into canvas context)
    storage/                 # storage interfaces (memory/localStorage/custom)
    grid/                    # ag-grid wrappers (transactions, formatters)
  react/                     # thin React bindings to core
    hooks/                   # useStore, useDrag, useResizable, useElementSize, useDebouncedCallback, useOutside
    components/              # Parameters, Modal, Menu, Inputs, Chart - controlled, immutable
    logs/                    # single LogsStore + presentational components
  compat/                    # ADAPTERS: old names/signatures -> core/react (all @deprecated)
  styles/                    # CSS as a separate entry (optional import)
  index.ts                   # public barrel (new API)
  index.compat.ts            # old API re-export (for exports "./compat" and backward compatibility)
```

### 9.2. Ideal by Subsystem

**A. Reactivity (`core/store`) - replacement for `updateBy.ts`**
- Target API: `const store = createStore(initial)` -> `store.getState()`, `store.setState(patch|fn)`, `store.subscribe(cb)`; React binding `useStore(store, selector?)` on `useSyncExternalStore` with **clean** `getSnapshot` and immutable versioning.
- No mutation of consumer objects; subscriptions do not create state during render; selectors enable targeted rerenders.

**B. Charts (`core/chart` + `react`) - merge the two engines**
- One core that knows nothing about React: input data + canvas context -> drawing. DPR-aware, dirty flag (draw only on changes), binary search of visible range (no `filter` per frame), correct LOD (min+max per pixel), one `AXIS_THICKNESS` constant.
- React binding `<Chart/>` / `useChart(ref, options)`: owns `ResizeObserver` (single, reused), RAF, and `destroy()` on unmount; correctly distinguishes temp-detach from unmount.
- Unified `Panel` model (one way to define height), one `addPanel/resizePanel`.

**C. DnD/Resize (`react/hooks`) - merge `RNDFunc`/`RNDFunc3`/`useDraggable`/`Resizable`**
- `usePointerDrag({onStart,onMove,onEnd})` based on **Pointer Events** + `AbortController`; position in ref, callbacks in ref -> subscription is attached **once**, no re-subscribe on tick. Guaranteed timer/listener cleanup on unmount.
- `useResizable` / `useElementSize` (shared `ResizeObserver` hook, replaces the `MyResizeObserver` loop).
- No global `openWindows`/`k`; z-index/window registry through `<WindowLayerProvider/>` context.
- Where reasonable, rely on existing `react-rnd`/`re-resizable` instead of hand-written logic.

**D. Storage (`core/storage`) - merge `cache.ts` + `mapMemory.tsx`**
- `Storage<T>` interface with implementations `memoryStorage`, `localStorageStorage(serialize/deserialize)`, `customStorage`. SSR-safe (`typeof window` guard), no implicit date conversion (optional reviver), lookup through `has` (not `||`).
- React binding `usePersistentState(key, default, storage)`. Fixes dead `staticGetById`.

**E. Logs (`react/logs`) - merge `logs.tsx` + `logs3.tsx` + `miniLogs.tsx`**
- Single `LogsStore` (on `core/store`) + presentational `<LogsGrid/>`, `<MiniLogs/>`, `<LogToast/>` through context. Correct `valueFormatter`, unified `num`, timer cleanup, per-provider state instead of module-global state.

**F. Parameters (`react/components/Parameters`) - merge `Parameters` + `ParametersEngine`**
- Fully **controlled** `<Parameters value onChange/>`: immutable updates (no `deepClone+Refresh` counter), field schema, `useDebouncedCallback` (correct debounce with cleanup), sizing through `useElementSize`. No mutation of input `params`.

**G. Grid/Transactions (`core/grid`) - `applyTransactionAsyncUpdate`**
- Pure transaction calculation function (add/update/remove are computed once and independently), type-safe `getId: (row: T) => string`, no hidden duplicate remove.

**H. Build/Types**
- Dual-build (ESM+CJS) through `tsup`/`rollup`; `exports` with `import`/`require`/`types` + separate `./styles`; `"sideEffects":["**/*.css"]`; zero import side effects; strict generics, zero `any` in public signatures.

---

## 10. Migration Mechanics: "Old -> New" Through Temporary Duplication

### Pattern
1. New code is written in `src/core/**` and `src/react/**` **next to** old code; do not touch `src/common/**`.
2. During migration, **both** sets are compiled. New API is exported from `index.ts`, old API from `index.compat.ts`.
3. Once the new code is covered by tests and reaches parity, old public symbols are **rewritten as thin adapters** over the new code (`src/compat/**`), preserving signatures.
4. Duplication is removed: old implementation is deleted, adapter remains -> new core.

### "Old / New" Template (Fill for Each Module)

**Example B - charts**
- *Old:* `createChartEngine(canvas)` in two files with different `Panel`/`addPanel` models (px vs %), RAF without dirty flag, `filter` per frame, LOD loses peaks, observer leaks.
- *New:* `core/chart/createChart(ctx, opts)` (clean core) + `react` binding `<Chart/>`/`useChart`. One `Panel`, dirty-render, binary range search, min/max LOD, managed ResizeObserver, `destroy()`.
- *Adapter:* both old `createChartEngine` signatures are implemented as wrappers over `createChart` and marked `@deprecated`.

**Example A - reactivity**
- *Old:* `updateBy(obj, cb)` mutates `obj`, `renderBy(obj)`, impure `getSnapshot`, dual-mode.
- *New:* `createStore`/`useStore`, clean snapshots, immutability.
- *Adapter:* `updateBy`/`renderBy` wrappers hold `createStore` internally and proxy; external signature stays the same.

**Example C - drag**
- *Old:* `Drag2`, `Drag22`, `ExRNDMap3`, `useDraggable` - each has its own implementation, global `openWindows`, re-subscribe on tick, leaks.
- *New:* `usePointerDrag` + `useResizable` + `<WindowLayerProvider/>`.
- *Adapter:* old components render the new hooks inside, with prop signatures preserved.

> For each module A-H, create this "Old / New / Adapter" triple in a separate issue/checklist.

### Important Decision for Each Broken Behavior (K3)
When writing an adapter for features that are **currently broken** (`staticGetById`, `EditParams3`, time format, swap x/y, debounce), decide per item:
- **(a)** adapter immediately returns *fixed* behavior (risk: consumer adapted to the bug) - mark as breaking in CHANGELOG; **or**
- **(b)** old adapter preserves *old broken* behavior + `@deprecated`, while the new API provides correct behavior -> consumer fixes it during migration.
Recommendation: for data-loss bugs (`EditParams3`, time format), use **(a)**; for "strange but stable" behavior (swap x/y, password `111`), use **(b)** with an explicit note.

---

## 11. Backward-Compatibility Adapters

Each old public export should look like this after migration (schematic):
```ts
// src/compat/updateBy.ts
import { createStore, useStore } from "../core/store";

/**
 * @deprecated Will be removed in v3. Use `createStore`/`useStore` from "wenay-react2".
 * Migration: see MIGRATION.md section updateBy.
 */
export function updateBy(obj, cb) {
  // wrapper over the new store; external signature is unchanged
  ...
}
```
Adapter rules:
- **Signature and name are byte-for-byte** as before, including `as any` points, argument order, and optional parameters.
- All adapters are marked `@deprecated` with the replacement and a link to `MIGRATION.md`.
- Preserve obsolete aliases (`DivOutsideClick2`, `MiniButton3`, `ButtonOutClick`, etc.) as `@deprecated` re-exports too.
- Adapters are collected in `index.compat.ts` and are available through both the root barrel (for smoothness) and the `wenay-react2/compat` sub-entry.

---

## 12. Release Plan and Deprecation Timeline

| Release | Contents | Old API State |
|---------|----------|---------------|
| **vX.next (minor/pre)** | KB + K0 + K1 (see Part I). Build fixed, cleanup, local bugs. | No signature changes. |
| **v(X+1) - "new core" (major)** | `core/**` + `react/**` published as the **main** API. Old API works through adapters (`compat/**`), **all marked `@deprecated` "will be removed soon"**. README/MIGRATION updated. `npm deprecate` for symbols that truly go away (test components, one chart engine copy). | Works, marked deprecated. |
| **v(X+2) - removal (major)** | Remove `compat/**` and old implementations. Only the new API remains. | Removed, with migration notes. |

Related:
- **MIGRATION.md** - table "old symbol -> new symbol -> replacement example" for each A-H.
- **CHANGELOG.md** - semver-based; all breaking changes from K3 and removals only in major.
- **Parity tests**: at vX+1, keep a test suite that runs the old adapter and new API on identical scenarios (guarantees the adapter did not change observable behavior except explicitly declared fixes).
- **Deprecation metric**: optional `console.warn` (once, with guard) in the heaviest adapters so consumers see they touch outgoing API (align with the side-effect-free policy from KB).

---

## 13. Recommended Order for Part II

1. Create `src/core/store` (reactivity) - foundation for logs/parameters. Tests.
2. `core/storage` + `react/hooks` (useStore, useElementSize, useDebouncedCallback, usePointerDrag, useOutside). Tests.
3. `core/chart` + `<Chart/>` - merge the two engine copies. Tests (LOD math, ranges).
4. `react/logs`, `react/components/Parameters`, DnD components - on top of the core. Tests.
5. `core/grid` (transactions). Tests.
6. Write `compat/**` adapters for all old signatures (+ `@deprecated`). Run parity tests.
7. Configure dual-build and `exports` (KB target from section 9.2.H).
8. Release v(X+1): new API is main, old API is deprecated. `npm deprecate` + MIGRATION.md.
9. After a support cycle, release v(X+2): remove `compat/**`.
