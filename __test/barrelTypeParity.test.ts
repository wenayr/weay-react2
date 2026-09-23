import * as logs from "../src/logs/index";
import * as core from "../src/core/index";
import * as react from "../src/react/index";

/** barrelParity.test.ts compares RUNTIME bindings, so it is blind to the half of the surface
 *  that vanishes at runtime: types. Since 4.0.0 there is no root barrel; the types that several
 *  entries publish (./persist shares its maps, memory API and saved-state shapes with ./react,
 *  ./core, ./menu and ./windows) must stay identical, so switching the import path never changes
 *  a type. `Eq` fails to typecheck when two sides diverge; the runtime body only gives jest
 *  something to run. */

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type _MapChange = Expect<Eq<
    import("../src/core/index").MapChangeListener<string>,
    import("../src/persist/index").MapChangeListener<string>
>>;
type _CacheMap = Expect<Eq<import("../src/react/index").CacheMap, import("../src/persist/index").CacheMap>>;
type _CacheStorage = Expect<Eq<import("../src/react/index").CacheStorage, import("../src/persist/index").CacheStorage>>;
type _MenuRightPosition = Expect<Eq<import("../src/menu/index").MenuRightPosition, import("../src/persist/index").MenuRightPosition>>;
type _MenuRightSavedState = Expect<Eq<import("../src/menu/index").MenuRightSavedState, import("../src/persist/index").MenuRightSavedState>>;
type _MenuRightVertical = Expect<Eq<
    import("../src/menu/index").MenuRightVerticalPosition,
    import("../src/persist/index").MenuRightVerticalPosition
>>;
type _CloseReason = Expect<Eq<
    import("../src/windows/index").FloatingWindowCloseReason,
    import("../src/persist/index").FloatingWindowCloseReason
>>;
type _Mode = Expect<Eq<import("../src/windows/index").FloatingWindowMode, import("../src/persist/index").FloatingWindowMode>>;
type _Position = Expect<Eq<import("../src/windows/index").FloatingWindowPosition, import("../src/persist/index").FloatingWindowPosition>>;
type _Saved = Expect<Eq<
    import("../src/windows/index").FloatingWindowSavedGeometry,
    import("../src/persist/index").FloatingWindowSavedGeometry
>>;
type _Size = Expect<Eq<import("../src/windows/index").FloatingWindowSize, import("../src/persist/index").FloatingWindowSize>>;
type _Snap = Expect<Eq<
    import("../src/windows/index").FloatingWindowSnapRegion,
    import("../src/persist/index").FloatingWindowSnapRegion
>>;

/** 4.0.0: the window controller's resize handlers are this package's own types, so the public
 *  surface no longer names react-rnd, and they still fit the react-rnd props they are passed to. */
type _ResizeHandler = Expect<Eq<
    import("../src/windows/index").FloatingWindowController["onResize"],
    import("../src/windows/index").FloatingWindowResizeHandler
>>;
type _RndAccepts = Expect<import("../src/windows/index").FloatingWindowResizeHandler extends NonNullable<import("react-rnd").Props["onResize"]> ? true : false>;
type _RndStartAccepts = Expect<import("../src/windows/index").FloatingWindowResizeStartHandler extends NonNullable<import("react-rnd").Props["onResizeStart"]> ? true : false>;

describe("entry type parity", () => {
    test("the compile-time assertions above hold", () => {
        // reaching this line means tsc accepted every Expect<...> in this file
        expect(true).toBe(true);
    });

    test("LogsSettings is a type, not a runtime value", () => {
        // logsContext (removed in 2.0.0) used to export a COMPONENT under this name
        expect((logs as Record<string, unknown>).LogsSettings).toBeUndefined();
    });

    test("core and react surfaces are non-empty", () => {
        expect(Object.keys(core).length).toBeGreaterThan(0);
        expect(Object.keys(react).length).toBeGreaterThan(0);
    });
});
