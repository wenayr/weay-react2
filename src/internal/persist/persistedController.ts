/** The persisted-state idiom, in one place.
 *
 *  Five controllers (columnState, Toolbar, UiSlot, searchHistory, SettingsDialog's layout) each
 *  repeated the same three steps: read-or-create the entry in memoryProps, wrap it in an
 *  updateBy api, and on every write mutate in place -> render -> memoryMarkDirty. The three
 *  lines are small; what none of them had is the thing that actually matters for stored data -
 *  a place to notice that the shape on disk is older than the code and migrate it. That is why
 *  this exists, and why `version`/`migrate` are the point rather than the line count.
 *
 *  Not re-exported from utils/index.ts (the root public surface); it reaches consumers through
 *  the ./persist entrypoint (src/persist/index.ts) and internally by path.
 *
 *  The surrounding controllers keep their own logic (listen channels, runtime-only state,
 *  normalize) - this owns only the persisted slot itself. */
import {createUpdateApi} from "../updateBy.js";
import {memoryCommit, memoryGetOrCreate, memoryMarkDirty} from "./memoryStore.js";

export type PersistedControllerOptions<T extends object> = {
    /** memoryProps key; also the scope memoryCache marks dirty. */
    key: string;
    /** Shape used when nothing is stored yet. Must be a STABLE reference (see memoryGetOrCreate). */
    def: T;
    /** Forwarded verbatim to memoryGetOrCreate. */
    memory?: {abs?: boolean; deepAutoMerge?: boolean; reversDeep?: boolean};
    /** Current schema version. When set, the stored entry carries it under `v`. */
    version?: number;
    /** Called once, at creation, when the stored `v` differs from `version` - including the
     *  first time a previously unversioned entry is seen (`from` is undefined then). Mutate
     *  `state` in place; `v` is stamped and the entry marked dirty afterwards. */
    migrate?: (state: T, from: number | undefined) => void;
};

export function createPersistedController<T extends object>(opts: PersistedControllerOptions<T>) {
    const state = memoryGetOrCreate<T>(opts.key, opts.def, opts.memory ?? {reversDeep: false});
    const api = createUpdateApi(state);

    if (opts.version != undefined) {
        const versioned = state as T & {v?: number};
        if (versioned.v !== opts.version) {
            opts.migrate?.(state, versioned.v);
            versioned.v = opts.version;
            memoryMarkDirty(opts.key);
        }
    }

    /** Mutate in place, then announce: rerender subscribers AND mark the cache dirty. The body
     *  is memoryCommit - the same idiom memoryUpdate uses - so the two cannot drift apart. */
    const commit = (mutate?: (current: T) => void) => {
        memoryCommit(opts.key, state, mutate);
    };

    return {
        /** The live persisted object. Mutated in place; announce through commit(). */
        state,
        api,
        commit,
        /** React subscription to this slot. */
        use: () => api.use(),
        /** Announce a mutation made elsewhere (the object was handed out and edited directly). */
        markDirty: () => memoryMarkDirty(opts.key),
    };
}

export type PersistedController<T extends object> = ReturnType<typeof createPersistedController<T>>;
