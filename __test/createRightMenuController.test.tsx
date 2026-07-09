import React, {useMemo} from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {createRightMenuController, DropdownMenu, useRightMenuController} from "../src/common/src/components/Menu/RightMenu";

test("createRightMenuController.set rerenders an already mounted Render with newly added menu elements", async () => {
    let api: ReturnType<typeof createRightMenuController> | null = null;

    function Probe() {
        const menu = useMemo(createRightMenuController, []);
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
test("useRightMenuController exposes open fixed and submenu state for custom views", async () => {
    const elements = [{label: "Hook item", subMenuContent: () => <div>hook submenu</div>}];

    function Probe() {
        const controller = useRightMenuController({elements});
        return <div>
            <button onClick={controller.open}>open</button>
            <button onClick={controller.toggleFixed}>toggle fixed</button>
            <button onClick={() => controller.selectItem(elements[0], 0)}>select first</button>
            <div data-testid="right-state">{controller.isOpen ? "open" : "closed"}/{controller.isFixed ? "fixed" : "float"}/{controller.select ?? "none"}</div>
            {controller.submenuRender}
        </div>;
    }

    render(<Probe />);
    expect(screen.getByTestId("right-state").textContent).toBe("closed/float/none");

    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("right-state").textContent).toBe("open/float/none");

    fireEvent.click(screen.getByText("toggle fixed"));
    expect(screen.getByTestId("right-state").textContent).toBe("closed/fixed/none");

    fireEvent.click(screen.getByText("select first"));
    await waitFor(() => expect(screen.getByText("hook submenu")).toBeTruthy());
    expect(screen.getByTestId("right-state").textContent).toBe("closed/fixed/0");
});

test("DropdownMenu stays compatible while using the hook controller", async () => {
    const elements = [{label: "Visible item", subMenuContent: () => <div>visible submenu</div>}];

    render(<DropdownMenu
        elements={elements}
        trigger={state => <span data-testid="right-trigger">{state.isFixed ? "fixed" : state.isOpen ? "open" : "closed"}</span>}
    />);

    const trigger = screen.getByTestId("right-trigger");
    const triggerButton = trigger.parentElement!;
    const container = triggerButton.parentElement!;

    expect(trigger.textContent).toBe("closed");
    fireEvent.mouseEnter(container);
    await waitFor(() => expect(screen.getByText("Visible item")).toBeTruthy());
    expect(screen.getByTestId("right-trigger").textContent).toBe("open");

    fireEvent.mouseEnter(screen.getByText("Visible item"));
    await waitFor(() => expect(screen.getByText("visible submenu")).toBeTruthy());

    fireEvent.click(triggerButton);
    expect(screen.getByTestId("right-trigger").textContent).toBe("fixed");
    fireEvent.mouseLeave(container);
    expect(screen.getByText("Visible item")).toBeTruthy();
});