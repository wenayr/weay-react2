import React from "react";
import {act, render, screen} from "@testing-library/react";
import {FloatingWindow} from "../src/internal/components/Dnd/FloatingWindow";

describe("FloatingWindow children", () => {
    test("a plain element child follows the parent's re-renders", () => {
        let publish: ((value: number) => void) | null = null;

        function Host() {
            const [value, setValue] = React.useState(0);
            publish = setValue;
            return (
                <FloatingWindow size={{width: 240, height: 160}}>
                    <div data-testid="plain-child">value {value}</div>
                </FloatingWindow>
            );
        }

        render(<Host/>);
        expect(screen.getByTestId("plain-child").textContent).toBe("value 0");

        act(() => publish!(7));
        expect(screen.getByTestId("plain-child").textContent).toBe("value 7");
    });

    test("a render-prop child stays frozen until the window's update counter changes", () => {
        let publish: ((value: number) => void) | null = null;
        let renders = 0;

        function Host() {
            const [value, setValue] = React.useState(0);
            publish = setValue;
            return (
                <FloatingWindow size={{width: 240, height: 160}}>
                    {() => {
                        renders += 1;
                        return <div data-testid="render-prop-child">value {value}</div>;
                    }}
                </FloatingWindow>
            );
        }

        render(<Host/>);
        expect(renders).toBe(1);
        expect(screen.getByTestId("render-prop-child").textContent).toBe("value 0");

        act(() => publish!(7));
        expect(renders).toBe(1);
        expect(screen.getByTestId("render-prop-child").textContent).toBe("value 0");
    });
});
