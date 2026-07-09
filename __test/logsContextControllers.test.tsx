import React from "react";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {
    LogsProvider,
    useLogsContext,
    useLogsNotificationsController,
    useLogsTableController,
} from "../src/common/src/logs/logsContext";

test("useLogsTableController exposes provider rows columns and filter state", () => {
    function Probe() {
        const table = useLogsTableController();
        const {addLog, setMinVarLogs} = useLogsContext();
        return <div>
            <button onClick={() => addLog({id: "ctx", time: new Date("2026-01-01T10:00:00"), txt: "row", var: 2})}>add</button>
            <button onClick={() => setMinVarLogs(3)}>filter</button>
            <div data-testid="rows">{table.logs.length}</div>
            <div data-testid="min-var">{table.minVarLogs}</div>
            <div data-testid="columns">{table.columnDefs.length}</div>
            <div data-testid="wrap">{String(table.defaultColDef.wrapText)}</div>
        </div>;
    }

    render(<LogsProvider><Probe /></LogsProvider>);
    expect(screen.getByTestId("rows").textContent).toBe("0");
    expect(screen.getByTestId("columns").textContent).toBe("4");
    expect(screen.getByTestId("wrap").textContent).toBe("true");

    fireEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("rows").textContent).toBe("1");

    fireEvent.click(screen.getByText("filter"));
    expect(screen.getByTestId("min-var").textContent).toBe("3");
});

test("useLogsNotificationsController gates logs and exposes show state", async () => {
    function Probe() {
        const {addLog, setMinVarMessage} = useLogsContext();
        const notifications = useLogsNotificationsController();
        return <div>
            <button onClick={() => setMinVarMessage(5)}>gate</button>
            <button onClick={() => addLog({id: "ctx", time: new Date("2026-01-01T10:00:00"), txt: "low", var: 1})}>low</button>
            <button onClick={() => addLog({id: "ctx", time: new Date("2026-01-01T10:00:01"), txt: "high", var: 8})}>high</button>
            <button onClick={() => notifications.setShowMessages(false)}>hide</button>
            <div data-testid="notification-count">{notifications.visibleNotifications.length}</div>
            <div data-testid="notification-text">{notifications.visibleNotifications[0]?.log.txt ?? "none"}</div>
            <div data-testid="show-state">{notifications.showMessages ? "show" : "hide"}</div>
        </div>;
    }

    render(<LogsProvider><Probe /></LogsProvider>);
    fireEvent.click(screen.getByText("gate"));
    fireEvent.click(screen.getByText("low"));
    expect(screen.getByTestId("notification-count").textContent).toBe("0");

    fireEvent.click(screen.getByText("high"));
    await waitFor(() => expect(screen.getByTestId("notification-count").textContent).toBe("1"));
    expect(screen.getByTestId("notification-text").textContent).toBe("high");

    fireEvent.click(screen.getByText("hide"));
    expect(screen.getByTestId("show-state").textContent).toBe("hide");
});