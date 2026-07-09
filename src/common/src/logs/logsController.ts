import {Params} from "wenay-common2";

export type LogInput<T extends object = {}> = T & {id: string, var?: number, time: Date, txt: string};
export type LogEntry<T extends object = {}> = LogInput<T> & {num: number};
export type LogsApiOptions = {
    limit?: number,
    limitPer: number,
    varMin?: number
};

export const getSettingLogs = () => ({
    minVarLogs: {name:"min. importance for notifications", range: {min: 0 , max: 25, step: 1}, value: 0},
    minVarMessage: {name:"min. importance for log table", range: {min: 0 , max: 25, step: 1}, value: 0},
    timeShow: {name:"screen display time", range: {min: 1, max: 20, step: 1}, value: 2},
    show: {name: "show", value: true as boolean}
}) satisfies Params.IParams;

export type LogsSettingsDefinition = ReturnType<typeof getSettingLogs>;
export type LogsSettings = Params.SimpleParams<LogsSettingsDefinition>;
export type LogsFullState<T extends object = {}> = {map: Map<string, LogEntry<T>[]>};
export type LogsMiniState<T extends object = {}> = {last: LogEntry<T>[]};
export type LogsSettingsState = {params: LogsSettings};
export type LogsControllerState<T extends object = {}> = {
    full: LogsFullState<T>;
    mini: LogsMiniState<T>;
    settings: LogsSettingsState;
};
export type LogsControllerEvents = {
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
    params: {
        def: typeof getSettingLogs;
        get(): LogsSettings;
        set(settings: LogsSettings): void;
    };
};

function addToArr<T>(arr: T[], data: T, limit: number) {
    arr.unshift(data);
    if (arr.length > limit) arr.length = limit;
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
                                                              onFullChange,
                                                              onMiniChange,
                                                              onSettingsChange,
                                                          }: CreateLogsControllerOptions<T>): LogsController<T> {
    let num = 0;

    return {
        state,
        options,
        addLogs(input) {
            const item = {...input, num: num++} as LogEntry<T>;
            addToArr(state.mini.last, item, options.limit ?? 50);
            const perId = state.full.map.get(input.id) ?? state.full.map.set(input.id, []).get(input.id)!;
            addToArr(perId, item, options.limitPer);
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