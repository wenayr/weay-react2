Wenay Front Library - Recommendations

Scope
- Reviewed source and build/config files under src, public, __test, and root config.
- Ignored generated outputs in dist/lib and vendor code in node_modules.

Implemented (this pass)
- Fixed PageVisibilityContext provider usage.
- Added safe use* hook aliases while keeping old names.
- Added SSR guards for browser-only globals.
- Removed module import side effects in entrypoint.
- Fixed chart engine listener cleanup leaks.
- Fixed ResizeObserver delete logic and added cleanup helper.
- Cleaned up CSS duplicate blocks and invalid properties.
- Updated package entry points and lockfile.

Critical
1) Fix runtime/SSR crashes from global browser-only objects:
   - Move top-level access to window/document/location behind runtime guards.
   - Provide no-op fallbacks for server rendering.
2) Fix hook rule violations and invalid Context Provider usage:
   - Rename/update updateBy/addDownAnyKey to use* hooks (or wrap them).
   - Fix PageVisibilityProvider to use PageVisibilityContext.Provider.
3) Fix packaging entry points:
   - Align main/types/exports to actual build output (lib/index.*).
   - Keep compatibility exports, but remove wrong dist/index.* references.
4) Remove leaking global listeners in chart engines:
   - Track and remove listeners registered in createInteraction init.
   - Ensure destroy() cleans up all document/canvas listeners.

Medium
1) Fix ResizeObserver cleanup and delete logic:
   - CResizeObserver.delete should remove only one callback (splice(i, 1)).
   - setResizeableElement should expose/unregister observer ID.
2) Stabilize logs counter:
   - Avoid stale counter in LogsProvider.addLog; use ref or functional update.
3) Reduce module side effects:
   - Avoid calling test() on import.
   - Avoid default global initialization (ApiLeftMenu.setMenu) at module load.
4) Improve dependency policy:
   - Move react/react-dom to peerDependencies only.
   - Consider looser peer range if backward support is required.

Minor
1) Tidy hook deps:
   - useOutside should include outsideClick in deps.
   - Use [] instead of [true] for effects that run once.
2) Defensive guards:
   - localStorage/caches usage should check typeof window !== 'undefined'.
   - Provide feature detection for ResizeObserver.
3) Code hygiene:
   - Remove unused imports.
   - Prefer consistent naming (Resizeble -> Resizable) with deprecations.

Backward Compatibility Plan
- Keep all current exports in place.
- Add new safe APIs with deprecation notices:
  - updateBy -> useUpdateBy (export both for now).
  - addDownAnyKey -> useAddDownAnyKey (export both).
  - Resizeble -> Resizable with a re-export.
- Add runtime guards but preserve behavior in browsers.
- Publish a migration guide with "no-code-change" defaults first.

Conceptual Improvements
- Introduce a small core layer with zero DOM access at import time.
- Split DOM/UI-heavy modules into sub-exports (e.g., /menu, /charts).
- Consolidate shared helpers (renderBy/updateBy) into a single state/event hub.
- Add minimal storybook or example app for manual QA.

Possible Alternative Libraries (optional replacements)
- Menus/overlays: @floating-ui/react, radix-ui, react-aria.
- Draggable/resizable: react-rnd (already used), react-draggable.
- State/event bus: zustand, mitt.
- Charts: lightweight-charts (already used), echarts, visx.
