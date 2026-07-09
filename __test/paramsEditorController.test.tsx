import React from "react";
import {act, render} from "@testing-library/react";
import {ParamsEditorController, useParamsEditorController} from "../src/common/src/components/ParamsEditor";

afterEach(() => {
    jest.useRealTimers();
});

test("useParamsEditorController edits a mutable draft without mutating source params", () => {
    const source = {name: "initial", enabled: true};
    const changes: typeof source[] = [];
    let controller: ParamsEditorController<typeof source> | null = null;

    function Probe() {
        controller = useParamsEditorController({
            params: source,
            onChange: params => changes.push(params),
        });
        return null;
    }

    render(<Probe />);

    act(() => {
        controller!.paramsRef.current.name = "changed";
        controller!.notifyChange();
    });

    expect(source.name).toBe("initial");
    expect(changes).toHaveLength(1);
    expect(changes[0].name).toBe("changed");
});

test("useParamsEditorController debounces changes and clears pending timer on unmount", () => {
    jest.useFakeTimers();
    const source = {count: {value: 1, range: {min: 0, max: 10, step: 1}}};
    const changes: typeof source[] = [];
    let controller: ParamsEditorController<typeof source> | null = null;

    function Probe() {
        controller = useParamsEditorController({
            params: source,
            onChange: params => changes.push(params),
        });
        return null;
    }

    const view = render(<Probe />);

    act(() => {
        controller!.paramsRef.current.count.value = 2;
        controller!.notifyChangeDelayed();
        jest.advanceTimersByTime(199);
    });
    expect(changes).toHaveLength(0);

    act(() => {
        jest.advanceTimersByTime(1);
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].count.value).toBe(2);

    act(() => {
        controller!.paramsRef.current.count.value = 3;
        controller!.notifyChangeDelayed();
        view.unmount();
        jest.advanceTimersByTime(250);
    });
    expect(changes).toHaveLength(1);
});

test("useParamsEditorController calls current onExpand callback with draft params", () => {
    const source = {group: {value: {name: "nested"}, expanded: false}};
    const expanded: typeof source[] = [];
    let controller: ParamsEditorController<typeof source> | null = null;

    function Probe({suffix}: {suffix: string}) {
        controller = useParamsEditorController({
            params: source,
            onChange: () => undefined,
            onExpand: params => {
                params.group.value.name = params.group.value.name + suffix;
                expanded.push(params);
            },
        });
        return null;
    }

    const view = render(<Probe suffix="-a" />);
    view.rerender(<Probe suffix="-b" />);

    act(() => {
        controller!.notifyExpand();
    });

    expect(source.group.value.name).toBe("nested");
    expect(expanded).toHaveLength(1);
    expect(expanded[0].group.value.name).toBe("nested-b");
});