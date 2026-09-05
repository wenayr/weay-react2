import {Params} from "wenay-common2/client";

export type LogInput<T extends object = {}> = T & {id: string, var?: number, time: Date, txt: string};
export type LogEntry<T extends object = {}> = LogInput<T> & {num: number};
export type LogsApiOptions = {
    limit?: number,
    limitPer: number,
    varMin?: number,
    /** memoryGetOrCreate key for this instance's settings; without it a fresh
     *  (non-persisted) settings object is used. The global logsApi keeps "settingLogs". */
    settingsKey?: string
};

export const getSettingLogs = () => ({
    minVarLogs: {name:"min. importance for log table", range: {min: 0 , max: 25, step: 1}, value: 0},
    minVarMessage: {name:"min. importance for notifications", range: {min: 0 , max: 25, step: 1}, value: 0},
    timeShow: {name:"screen display time", range: {min: 1, max: 20, step: 1}, value: 2},
    show: {name: "show", value: true as boolean}
}) satisfies Params.IParams;

export type LogsSettingsDefinition = ReturnType<typeof getSettingLogs>;
export type LogsSettings = Params.SimpleParams<LogsSettingsDefinition>;
/** One addLogs call, reported as a delta instead of a bare "something changed". Views that
 *  used to re-derive the whole world per entry (the logs grid rebuilt a Map over every per-id
 *  array, 500 entries each) apply an O(1) transaction from this instead. `evictedFull` are the
 *  entries `limitPer` pushed out of state.full.map[id], `evictedMini` the ones `limit` pushed
 *  out of state.mini.last - oldest dropped first, since both arrays stay newest-first
 *  (getLatest = last[0]). */
export type LogsChange<T extends object = {}> = {
    item: LogEntry<T>;
    evictedFull: LogEntry<T>[];
    evictedMini: LogEntry<T>[];
};
/** `lastChange` is the per-change channel: the controller stamps the delta onto the very state
 *  objects the views already subscribe to (renderBy(state.full) / renderBy(state.mini)), so a
 *  listener woken by a change can read that change without a second subscription mechanism.
 *  Optional on purpose - a state object built by an older consumer simply has none, so every
 *  consumer must fall back to a full reconcile when it is missing or unchanged. */
export type LogsFullState<T extends object = {}> = {map: Map<string, LogEntry<T>[]>, lastChange?: LogsChange<T>};
export type LogsMiniState<T extends object = {}> = {last: LogEntry<T>[], lastChange?: LogsChange<T>};
export type LogsSettingsState = {params: LogsSettings};
export type LogsControllerState<T extends object = {}> = {
    full: LogsFullState<T>;
    mini: LogsMiniState<T>;
    settings: LogsSettingsState;
};
export type LogsControllerEvents = {
    /** Additive: fires once per addLogs, before onFullChange/onMiniChange, with the delta. */
    onChange?: (change: LogsChange<any>) => void;
    onFullChange?: () => void;
    onMiniChange?: () => void;
    onSettingsChange?: () => void;
};
export type CreateLogsControllerOptions<T extends object = {}> = LogsControllerEvents & {
    options: LogsApiOptions;
    state?: LogsControllerState<T>;
};
export type LogsController<T extends object = {}> = {
    state: LogsControllerState<T>;
    options: LogsApiOptions;
    addLogs(input: LogInput<T>): LogEntry<T>;
    getRows(): LogEntry<T>[];
    getMiniRows(): LogEntry<T>[];
    getLatest(): LogEntry<T> | undefined;
    /** Delta of the most recent addLogs, or undefined before the first one. */
    getLastChange(): LogsChange<T> | undefined;
    params: {
        def: typeof getSettingLogs;
        get(): LogsSettings;
        set(settings: LogsSettings): void;
    };
};

// frozen: this one array is handed out on every non-evicting call, and it travels to
// consumers inside LogsChange - a consumer pushing into it would poison every later change
const EMPTY_EVICTED: never[] = Object.freeze([]) as never[];

/** Returns the entries the limit pushed out (oldest first), so callers can report evictions
 *  instead of forcing every consumer to diff the array to discover them. */
function addToArr<T>(arr: T[], data: T, limit: number): T[] {
    arr.unshift(data);
    if (arr.length <= limit) return EMPTY_EVICTED;
    const kept = Math.max(limit, 0);
    const evicted = arr.slice(kept);
    arr.length = kept;
    return evicted;
}

export function createLogsControllerState<T extends object = {}>(state: Partial<LogsControllerState<T>> = {}): LogsControllerState<T> {
    return {
        full: state.full ?? {map: new Map<string, LogEntry<T>[]>()},
        mini: state.mini ?? {last: []},
        settings: state.settings ?? {params: Params.GetSimpleParams(getSettingLogs())},
    };
}

export function createLogsController<T extends object = {}>({
                                                              options,
                                                              state = createLogsControllerState<T>(),
                                                              onChange,
                                                              onFullChange,
                                                              onMiniChange,
                                                              onSettingsChange,
                                                          }: CreateLogsControllerOptions<T>): LogsController<T> {
    let num = 0;
    let lastChange: LogsChange<T> | undefined;

    return {
        state,
        options,
        addLogs(input) {
            const item = {...input, num: num++} as LogEntry<T>;
            const evictedMini = addToArr(state.mini.last, item, options.limit ?? 50);
            const perId = state.full.map.get(input.id) ?? state.full.map.set(input.id, []).get(input.id)!;
            const evictedFull = addToArr(perId, item, options.limitPer);
            const change: LogsChange<T> = {item, evictedFull, evictedMini};
            lastChange = change;
            state.full.lastChange = change;
            state.mini.lastChange = change;
            onChange?.(change);
            onFullChange?.();
            onMiniChange?.();
            return item;
        },
        getRows() {
            return [...state.full.map.values()].flat();
        },
        getMiniRows() {
            return state.mini.last.slice();
        },
        getLatest() {
            return state.mini.last[0];
        },
        getLastChange() {
            return lastChange;
        },
        params: {
            def: getSettingLogs,
            get() {return state.settings.params;},
            set(settings) {
                state.settings.params = settings;
                onSettingsChange?.();
                onMiniChange?.();
                onFullChange?.();
            },
        },
    };
}
