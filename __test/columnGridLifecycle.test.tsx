import React from "react";
import {act, render} from "@testing-library/react";
import {
    useColumnGrid,
    type ColumnGridController,
} from "../src/internal/grid/columnState/columnGrid";

test("useColumnGrid disposes its owned factory subscriptions after unmount", async () => {
    type Row = {id: string};
    let controller: ColumnGridController<Row> | undefined;

    function Probe() {
        controller = useColumnGrid<Row>({
            key: "test.useColumnGrid.lifecycle",
            columns: [{key: "id", title: "Id"}],
            toolbar: false,
        });
        return null;
    }

    const view = render(<Probe/>);
    const dispose = jest.spyOn(controller!, "dispose");
    view.unmount();
    await act(async () => { await Promise.resolve(); });
    expect(dispose).toHaveBeenCalledTimes(1);
});

test("useColumnGrid stays subscribed through the StrictMode effect replay", async () => {
    type Row = {id: string};
    let controller: ColumnGridController<Row> | undefined;

    function Probe() {
        controller = useColumnGrid<Row>({
            key: "test.useColumnGrid.strict-lifecycle",
            columns: [{key: "id", title: "Id"}],
        });
        return null;
    }

    const view = render(<React.StrictMode><Probe/></React.StrictMode>);
    await act(async () => { await Promise.resolve(); });
    const onToolbarChange = jest.fn();
    const off = controller!.toolbar!.api.onChange.on(onToolbarChange);
    controller!.state.api.show("id", false);
    expect(onToolbarChange).toHaveBeenCalledTimes(1);
    off();
    view.unmount();
    await act(async () => { await Promise.resolve(); });
});
