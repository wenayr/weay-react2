import React, {StrictMode, useRef, useState} from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Observe, Replay} from "wenay-common2";
import {useStoreReplayEach} from "../src/common/src/hooks/useReplay";

type Rows = Record<string, {qty: number}>;
type RowsRemote = Replay.ReplayRemote<[Observe.StorePatch]>;

function EachFeedProbe({remote}: {remote: RowsRemote}) {
    const logRef = useRef<string[]>([]);
    const rowsRef = useRef<Rows>({});
    const [, setTick] = useState(0);
    const [enabled, setEnabled] = useState(true);
    const feed = useStoreReplayEach<Rows>(remote, (key, value) => {
        logRef.current.push(value === undefined ? `-${key}` : `${key}=${value.qty}`);
        if (value === undefined) delete rowsRef.current[key];
        else rowsRef.current[key] = value;
        setTick(t => t + 1);
    }, {enabled, drain: "micro"});

    return <div>
        <output data-testid="feed-ready">{String(feed.ready)}</output>
        <output data-testid="feed-rows">{Object.keys(rowsRef.current).sort().map(k => `${k}=${rowsRef.current[k].qty}`).join(" ")}</output>
        <output data-testid="feed-log">{logRef.current.join(" ")}</output>
        <output data-testid="feed-store">{Object.keys(feed.store.state).sort().join(",")}</output>
        <label>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>
            feed enabled
        </label>
    </div>;
}

async function mutateServer(store: Observe.Store<Rows>, fn: () => void) {
    await act(async () => {
        fn();
        await Observe.flushReactive(store.state);
    });
}

test("useStoreReplayEach folds keyframe expansion, per-key updates, deletes and tail catch-up (StrictMode)", async () => {
    const server = Observe.createStore<Rows>({a: {qty: 1}, b: {qty: 2}});
    const exposed = Observe.exposeStoreReplay(server, {history: 64});

    render(<StrictMode><EachFeedProbe remote={exposed.api.replay}/></StrictMode>);

    // first delivery = the keyframe expanded per key (cold start is not a special case)
    await waitFor(() => expect(screen.getByTestId("feed-ready").textContent).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=1 b=2"));

    // per-key update: deeper dirt (state.a.qty) reports 'a' once
    await mutateServer(server, () => { server.state.a.qty = 5; });
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 b=2"));

    // key add + key delete
    await mutateServer(server, () => { server.state.c = {qty: 3}; });
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 b=2 c=3"));
    await mutateServer(server, () => { delete server.state.b; });
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 c=3"));
    expect(screen.getByTestId("feed-log").textContent).toContain("-b");

    // the mirror store is exposed for direct reads / extra subscriptions
    expect(screen.getByTestId("feed-store").textContent).toBe("a,c");

    // enabled off -> server mutates -> re-enable: catches up through the journal tail on top of kept state
    fireEvent.click(screen.getByText("feed enabled"));
    await mutateServer(server, () => { server.state.a.qty = 7; server.state.d = {qty: 4}; });
    expect(screen.getByTestId("feed-rows").textContent).toBe("a=5 c=3");
    fireEvent.click(screen.getByText("feed enabled"));
    await waitFor(() => expect(screen.getByTestId("feed-rows").textContent).toBe("a=7 c=3 d=4"));
});
