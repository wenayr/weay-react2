import {createLogsController, createLogsControllerState} from "../src/common/src/logs/logsController";

test("createLogsController appends logs with numbers and applies mini/per-id limits", () => {
    const controller = createLogsController<{address: string}>({
        options: {limit: 2, limitPer: 2},
    });

    const first = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:00"), txt: "one", address: "qa"});
    const second = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:01"), txt: "two", address: "qa"});
    const third = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:02"), txt: "three", address: "qa"});
    controller.addLogs({id: "b", time: new Date("2026-01-01T10:00:03"), txt: "four", address: "qa"});

    expect(first.num).toBe(0);
    expect(second.num).toBe(1);
    expect(third.num).toBe(2);
    expect(controller.getLatest()?.txt).toBe("four");
    expect(controller.getMiniRows().map(row => row.txt)).toEqual(["four", "three"]);
    expect(controller.state.full.map.get("a")!.map(row => row.txt)).toEqual(["three", "two"]);
    expect(controller.getRows().map(row => row.txt)).toEqual(["three", "two", "four"]);
});

test("createLogsController reports undefined latest on a fresh controller", () => {
    const controller = createLogsController({options: {limitPer: 5}});

    expect(controller.getLatest()).toBeUndefined();
    expect(controller.getRows()).toEqual([]);
    expect(controller.getMiniRows()).toEqual([]);
});

test("createLogsController params.set updates state and emits all local channels", () => {
    const events: string[] = [];
    const state = createLogsControllerState();
    const controller = createLogsController({
        options: {limitPer: 5},
        state,
        onSettingsChange: () => events.push("settings"),
        onMiniChange: () => events.push("mini"),
        onFullChange: () => events.push("full"),
    });

    controller.params.set({...controller.params.get(), minVarLogs: 7});

    expect(controller.params.get().minVarLogs).toBe(7);
    expect(events).toEqual(["settings", "mini", "full"]);
});