import React from "react";
import {fireEvent, render} from "@testing-library/react";
import {keyboard, useKeyboard} from "../src/common/src/hooks/useKeyboard";

test("shares one document listener and emits one global event across hook consumers", () => {
    const first = jest.fn();
    const second = jest.fn();
    const global = jest.fn();
    const offGlobal = keyboard.subscribe(global);
    const add = jest.spyOn(document, "addEventListener");
    const remove = jest.spyOn(document, "removeEventListener");

    function Consumer({onKeyDown}: {onKeyDown: (key: string, event: KeyboardEvent) => void}) {
        useKeyboard({onKeyDown});
        return null;
    }

    const view = render(<><Consumer onKeyDown={first}/><Consumer onKeyDown={second}/></>);
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);

    fireEvent.keyDown(document, {key: "K"});
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(global).toHaveBeenCalledTimes(1);
    expect(keyboard.key).toBe("K");

    view.unmount();
    expect(remove.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    offGlobal();
    add.mockRestore();
    remove.mockRestore();
});
