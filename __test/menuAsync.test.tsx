import React from "react";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Menu, type MenuActionEvent, type MenuItem} from "../src/common/src/menu/menu";

function openItem(label: string) {
    const item = screen.getByText(label).closest(".toLine");
    if (!item) throw new Error(`Menu item ${label} has no wrapper`);
    fireEvent.mouseEnter(item);
}

test.each([
    ["submenuError", {next: () => Promise.reject(new Error("submenu failed"))}],
    ["funcError", {func: () => Promise.reject(new Error("func failed"))}],
    ["focusError", {onFocus: () => Promise.reject(new Error("focus failed"))}],
] as const)("reports %s without leaking an unhandled rejection", async (expected, lazyPart) => {
    const events: MenuActionEvent[] = [];
    const item = {name: "Lazy item", ...lazyPart} as MenuItem;
    render(<Menu data={[item]} onActionEvent={event => events.push(event)}/>);

    openItem("Lazy item");

    await waitFor(() => expect(events.some(event => event.type === expected)).toBe(true));
    expect(events.find(event => event.type === expected)?.error).toBeInstanceOf(Error);
});

test("ignores a lazy submenu completion after unmount", async () => {
    let resolve!: (items: MenuItem[]) => void;
    const pending = new Promise<MenuItem[]>(done => { resolve = done; });
    const onActionEvent = jest.fn();
    const view = render(<Menu data={[{name: "Lazy item", next: () => pending}]} onActionEvent={onActionEvent}/>);
    openItem("Lazy item");
    view.unmount();

    resolve([{name: "Too late"}]);
    await pending;

    expect(onActionEvent).not.toHaveBeenCalledWith(expect.objectContaining({type: "submenuOk"}));
});

test("reports a rejected click action without rethrowing from the internal promise chain", async () => {
    const events: MenuActionEvent[] = [];
    const view = render(<Menu
        data={[{name: "Run action", onClick: () => Promise.reject(new Error("action failed"))}]}
        onActionEvent={event => events.push(event)}
    />);

    fireEvent.click(screen.getByText("Run action"));

    await waitFor(() => expect(events.some(event => event.type === "error")).toBe(true));
    expect(events.find(event => event.type === "error")?.error).toBeInstanceOf(Error);
    view.unmount();
});
