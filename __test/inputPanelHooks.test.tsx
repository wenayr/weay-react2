import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {FileInputPanel, TextInputPanel, useFileInputPanel, useTextInputPanel} from "../src/common/src/components/Input";

test("TextInputPanel submits the latest text through useTextInputPanel", () => {
    const callback = jest.fn();

    const {container} = render(<TextInputPanel callback={callback} name="Name" txt="start" />);
    const input = container.querySelector("input[type='text']") as HTMLInputElement;

    expect(input.value).toBe("start");
    fireEvent.change(input, {target: {value: "updated"}});
    fireEvent.click(screen.getByText("send"));

    expect(callback).toHaveBeenCalledWith("updated");
});

test("FileInputPanel submits the latest file through useFileInputPanel", () => {
    const callback = jest.fn();
    const file = new File(["body"], "report.txt", {type: "text/plain"});

    const filePanel = render(<FileInputPanel callback={callback} name="File" />);
    const input = filePanel.container.querySelector("input[type='file']") as HTMLInputElement;
    Object.defineProperty(input, "files", {value: [file], configurable: true});
    fireEvent.change(input);
    fireEvent.click(screen.getByText("send"));

    expect(callback).toHaveBeenCalledWith(file);
});

test("input panel hooks expose headless getters and submit methods", () => {
    const textCallback = jest.fn();
    const fileCallback = jest.fn();
    const file = new File(["x"], "x.txt");
    const seen: Array<{text: string, file: File | null}> = [];

    function Harness() {
        const text = useTextInputPanel({callback: textCallback, txt: "init"});
        const fileInput = useFileInputPanel({callback: fileCallback});
        return <button onClick={() => {
            text.setValue("headless");
            fileInput.setFile(file);
            text.submit();
            fileInput.submit();
            seen.push({text: text.getValue(), file: fileInput.getFile()});
        }}>run</button>;
    }

    render(<Harness />);
    fireEvent.click(screen.getByText("run"));

    expect(textCallback).toHaveBeenCalledWith("headless");
    expect(fileCallback).toHaveBeenCalledWith(file);
    expect(seen).toEqual([{text: "headless", file}]);
});
