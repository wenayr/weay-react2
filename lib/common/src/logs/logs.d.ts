import { Params } from "wenay-common";
type tLogsInput<T extends object> = T & {
    id: string;
    var?: number;
    time: Date;
    txt: string;
};
declare const getSettingLogs: () => {
    minVarLogs: {
        name: string;
        range: {
            min: number;
            max: number;
            step: number;
        };
        value: number;
    };
    minVarMessage: {
        name: string;
        range: {
            min: number;
            max: number;
            step: number;
        };
        value: number;
    };
    timeShow: {
        name: string;
        range: {
            min: number;
            max: number;
            step: number;
        };
        value: number;
    };
    show: {
        name: string;
        value: boolean;
    };
};
export declare function getLogsApi<T extends object = {}>(setting: {
    limit?: number;
    limitPer: number;
    varMin?: number;
}): {
    addLogs(a: tLogsInput<T>): void;
    params: {
        def: () => {
            minVarLogs: {
                name: string;
                range: {
                    min: number;
                    max: number;
                    step: number;
                };
                value: number;
            };
            minVarMessage: {
                name: string;
                range: {
                    min: number;
                    max: number;
                    step: number;
                };
                value: number;
            };
            timeShow: {
                name: string;
                range: {
                    min: number;
                    max: number;
                    step: number;
                };
                value: number;
            };
            show: {
                name: string;
                value: boolean;
            };
        };
        get(): {
            minVarLogs: number;
            minVarMessage: number;
            timeShow: number;
            show: boolean;
        } & {
            readonly [key: number]: void;
        };
        set(a: Params.SimpleParams<ReturnType<typeof getSettingLogs>>): void;
    };
    React: {
        Setting: ({}: {}) => import("react/jsx-runtime").JSX.Element;
        Message: typeof MessageEventLogs;
        PageLogs: typeof PageLogs;
    };
};
export declare const logsApi: {
    addLogs(a: {
        id: string;
        var?: number | undefined;
        time: Date;
        txt: string;
    }): void;
    params: {
        def: () => {
            minVarLogs: {
                name: string;
                range: {
                    min: number;
                    max: number;
                    step: number;
                };
                value: number;
            };
            minVarMessage: {
                name: string;
                range: {
                    min: number;
                    max: number;
                    step: number;
                };
                value: number;
            };
            timeShow: {
                name: string;
                range: {
                    min: number;
                    max: number;
                    step: number;
                };
                value: number;
            };
            show: {
                name: string;
                value: boolean;
            };
        };
        get(): {
            minVarLogs: number;
            minVarMessage: number;
            timeShow: number;
            show: boolean;
        } & {
            readonly [key: number]: void;
        };
        set(a: Params.SimpleParams<ReturnType<typeof getSettingLogs>>): void;
    };
    React: {
        Setting: ({}: {}) => import("react/jsx-runtime").JSX.Element;
        Message: typeof MessageEventLogs;
        PageLogs: typeof PageLogs;
    };
};
export declare function PageLogs({ update }: {
    update?: number;
}): import("react/jsx-runtime").JSX.Element;
export declare function MessageEventLogs({ zIndex }: {
    zIndex?: number;
}): import("react/jsx-runtime").JSX.Element;
export declare function PageLogs2({ update }: {
    update?: number;
}): import("react/jsx-runtime").JSX.Element;
export {};
