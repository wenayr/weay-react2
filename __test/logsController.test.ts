import {createLogsController, createLogsControllerState, type LogsChange} from "../src/internal/logs/logsController";

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

test("addLogs reports the added item and both eviction lists", () => {
    const changes: LogsChange<{}>[] = [];
    const controller = createLogsController({
        options: {limit: 2, limitPer: 2},
        onChange: change => changes.push(change as LogsChange<{}>),
    });

    const one = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:00"), txt: "one"});
    controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:01"), txt: "two"});
    controller.addLogs({id: "b", time: new Date("2026-01-01T10:00:02"), txt: "three"});

    // mini limit 2 dropped "one", the per-id array for "a" still holds both
    expect(changes[2].item.txt).toBe("three");
    expect(changes[2].evictedMini).toEqual([one]);
    expect(changes[2].evictedFull).toEqual([]);

    const third = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:03"), txt: "four"});
    // limitPer 2 finally pushes "one" out of map.get("a")
    expect(changes[3].item).toBe(third);
    expect(changes[3].evictedFull.map(row => row.txt)).toEqual(["one"]);
    expect(controller.getLastChange()).toBe(changes[3]);
});

test("addLogs stamps the change on the full and mini state objects", () => {
    const state = createLogsControllerState();
    const controller = createLogsController({options: {limit: 5, limitPer: 5}, state});

    expect(state.full.lastChange).toBeUndefined();
    expect(state.mini.lastChange).toBeUndefined();

    const item = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:00"), txt: "one"});

    expect(state.full.lastChange).toBe(state.mini.lastChange);
    expect(state.full.lastChange!.item).toBe(item);
});

test("onChange runs before the coarse full/mini channels", () => {
    const events: string[] = [];
    const controller = createLogsController({
        options: {limitPer: 5},
        onChange: () => events.push("change"),
        onFullChange: () => events.push("full"),
        onMiniChange: () => events.push("mini"),
    });

    controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:00"), txt: "one"});

    expect(events).toEqual(["change", "full", "mini"]);
});

test("eviction keeps the newest-first ordering contract intact", () => {
    const controller = createLogsController({options: {limit: 2, limitPer: 2}});

    controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:00"), txt: "one"});
    controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:01"), txt: "two"});
    const newest = controller.addLogs({id: "a", time: new Date("2026-01-01T10:00:02"), txt: "three"});

    expect(controller.getLatest()).toBe(newest);
    expect(controller.getMiniRows().map(row => row.txt)).toEqual(["three", "two"]);
    expect(controller.state.full.map.get("a")!.map(row => row.txt)).toEqual(["three", "two"]);
});
