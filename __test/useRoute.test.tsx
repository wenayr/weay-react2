import React from "react";
import {act, render, screen} from "@testing-library/react";
import {Replay} from "wenay-common2";
import {useRouteState} from "../src/common/src/hooks/useRoute";

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Hand-built connectors over one journal: no RTC involved, pure coordinator mechanics. */
function makeConnector(line: Replay.ListenReplayApi<[number]>, kind: "relay" | "direct"): Replay.RouteConnector<[number]> {
    let state: Replay.tConnectorState = "idle";
    return {
        info: {label: kind, kind, ordered: true, reliable: true},
        open() {
            state = "open";
            return {
                line: {on: (cb: any) => line.line.on(cb)} as any,
                since: async (seq: number) => line.getSince(seq) ?? null,
                keyframe: async () => line.keyframe() ?? null,
                frame: async (seq: number, hint?: unknown) => line.frame(seq, hint),
            };
        },
        close() { state = "closed"; },
        state: () => state,
    };
}

test("useRouteState mirrors route transitions and cleans its metrics timer on unmount", async () => {
    const [emit, line] = Replay.replayListen<[number]>({history: 16, current: "last"});
    emit(1);
    const coordinator = Replay.createRouteCoordinator<[number]>({
        connect: (_ref, kind) => makeConnector(line, kind),
    });
    const link = coordinator.pair("viewer", "owner");
    const sub = link.subscribe(() => {});
    await sub.ready;

    function Probe() {
        const route = useRouteState(coordinator, link);
        return <>
            <output data-testid="state">{route.state}</output>
            <output data-testid="log">{route.log.map(entry => entry.from + ">" + entry.to).join(",")}</output>
        </>;
    }
    const view = render(<Probe />);
    expect(screen.getByTestId("state").textContent).toBe("relay");

    await act(async () => { await link.promoteDirect({timeoutMs: 2000}); });
    expect(screen.getByTestId("state").textContent).toBe("direct");
    expect(screen.getByTestId("log").textContent).toContain("relay>direct:connecting");
    expect(screen.getByTestId("log").textContent).toContain("direct:connecting>direct");

    await act(async () => { await link.reinterposeRelay("manual"); });
    expect(screen.getByTestId("state").textContent).toBe("relay");

    view.unmount();
    await act(async () => { await sleep(20); });
    sub();
    coordinator.close();
    line.close();
});
