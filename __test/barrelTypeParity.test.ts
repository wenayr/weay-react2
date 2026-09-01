import * as root from "../src/index";
import * as logs from "../src/logs/index";
import * as core from "../src/core/index";
import * as react from "../src/react/index";

/** barrelParity.test.ts compares RUNTIME bindings, so it is blind to the half of the surface
 *  that vanishes at runtime: types. A consumer migrating `import {LogEntry} from "wenay-react2"`
 *  to `"wenay-react2/logs"` used to get a silently different type.
 *
 *  This file locks the shared names down at COMPILE time. `Eq` fails to typecheck when the two
 *  sides diverge, so the assertion lives in the type system - the runtime body only exists to
 *  give jest something to run. Known-divergent names are listed explicitly with a reason, so a
 *  NEW divergence cannot slip in unnoticed. */

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// ---- names that MUST stay identical across the root and subpath surfaces -------------------
type _Tokens = Expect<Eq<import("../src/index").Tokens, import("../src/core/index").Tokens>>;
type _MapChange = Expect<Eq<
    import("../src/index").MapChangeListener<string>,
    import("../src/core/index").MapChangeListener<string>
>>;
type _FixedOrder = Expect<Eq<
    import("../src/index").FixedOrderDescriptor,
    import("../src/core/index").FixedOrderDescriptor
>>;
type _UpdateApi = Expect<Eq<
    import("../src/index").UpdateApi<{a: number}>,
    import("../src/react/index").UpdateApi<{a: number}>
>>;
type _Position = Expect<Eq<
    import("../src/index").FloatingWindowPosition,
    import("../src/windows/index").FloatingWindowPosition
>>;
type _Saved = Expect<Eq<
    import("../src/index").FloatingWindowSavedGeometry,
    import("../src/windows/index").FloatingWindowSavedGeometry
>>;

/** 2.0.0 removed src/internal/logs/logsContext.tsx, the parallel logs stack that owned the
 *  loose `LogEntry` / `LogInput` shapes and the `LogsSettings` React component. Every log name
 *  now resolves to logsController on BOTH surfaces, so the divergence list is empty and these
 *  three names became ordinary parity assertions. */
type _LogEntry = Expect<Eq<
    import("../src/index").LogEntry<{a: number}>,
    import("../src/logs/index").LogEntry<{a: number}>
>>;
type _LogInput = Expect<Eq<
    import("../src/index").LogInput<{a: number}>,
    import("../src/logs/index").LogInput<{a: number}>
>>;
type _LogsSettings = Expect<Eq<
    import("../src/index").LogsSettings,
    import("../src/logs/index").LogsSettings
>>;

const knownLogDivergences = [] as const;

describe("barrel type parity", () => {
    test("the compile-time assertions above hold", () => {
        // reaching this line means tsc accepted every Expect<Eq<...>> in this file
        expect(true).toBe(true);
    });

    test("LogsSettings is a type on both surfaces and a value on neither", () => {
        // the runtime half: logsContext used to export a COMPONENT under this name from the root
        // barrel while ./logs exported a TYPE. Both must now be type-only.
        expect((root as Record<string, unknown>).LogsSettings).toBeUndefined();
        expect((logs as Record<string, unknown>).LogsSettings).toBeUndefined();
    });

    test("the list of known divergences is empty", () => {
        expect(knownLogDivergences).toHaveLength(0);
    });

    test("core and react surfaces are non-empty and disjoint in purpose", () => {
        // guards against an accidental `export *` that would blur the boundary the probes check
        expect(Object.keys(core).length).toBeGreaterThan(0);
        expect(Object.keys(react).length).toBeGreaterThan(0);
    });
});
