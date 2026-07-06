import React, {useMemo} from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MenuRightApi} from "../src/common/src/components/Menu/RightMenu";

test("MenuRightApi.set rerenders an already mounted Render with newly added menu elements", async () => {
    let api: ReturnType<typeof MenuRightApi> | null = null;

    function Probe() {
        const menu = useMemo(MenuRightApi, []);
        api = menu;
        const Render = menu.Render;
        return <Render />;
    }

    render(<Probe />);

    const button = screen.getByText("☰");
    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.queryByText("Late item")).toBeNull();

    act(() => {
        api!.set([{label: "Late item", subMenuContent: () => <div>late submenu</div>}]);
    });

    await waitFor(() => expect(screen.getByText("Late item")).toBeTruthy());
});