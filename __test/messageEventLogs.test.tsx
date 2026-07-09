import React from "react";
import {act, render, screen} from "@testing-library/react";
import {logsApi, type MessageEventLogsController, useMessageEventLogsController} from "../src/common/src/logs/logs";

function Probe(props: {onReady: (controller: MessageEventLogsController) => void}) {
    const controller = useMessageEventLogsController({maxVisible: 2});
    props.onReady(controller);
    return <div>
        <button onClick={() => logsApi.addLogs({id: "hook", time: new Date("2026-01-01T10:00:00"), txt: "low", var: 1})}>low</button>
        <button onClick={() => logsApi.addLogs({id: "hook", time: new Date("2026-01-01T10:00:01"), txt: "high", var: 8})}>high</button>
        <button onClick={() => controller.setShow(false)}>hide</button>
        <div data-testid="count">{controller.visibleNotifications.length}</div>
        <div data-testid="first">{controller.visibleNotifications[0]?.logs.txt ?? "none"}</div>
        <div data-testid="show">{controller.show ? "show" : "hide"}</div>
    </div>;
}

beforeEach(() => {
    jest.useFakeTimers();
    logsApi.params.set({minVarLogs: 0, minVarMessage: 0, timeShow: 2, show: true});
});

afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    logsApi.params.set({minVarLogs: 0, minVarMessage: 0, timeShow: 2, show: true});
});

test("useMessageEventLogsController exposes global logsApi notification state", () => {
    let controller: MessageEventLogsController | null = null;
    render(<Probe onReady={api => { controller = api; }} />);

    expect(controller).not.toBeNull();
    expect(screen.getByTestId("count").textContent).toBe("0");

    act(() => {
        logsApi.params.set({minVarLogs: 0, minVarMessage: 5, timeShow: 2, show: true});
    });

    act(() => {
        screen.getByText("low").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("0");

    act(() => {
        screen.getByText("high").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("first").textContent).toBe("high");
    expect(controller!.notifications.length).toBe(1);

    act(() => {
        screen.getByText("hide").click();
    });
    expect(screen.getByTestId("show").textContent).toBe("hide");

    act(() => {
        jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
});