import React, {StrictMode, useRef} from "react";
import {createServer} from "http";
import {act, render, screen, waitFor} from "@testing-library/react";
import {Server as SocketIOServer} from "socket.io";
import {io} from "socket.io-client";
import {createRpcClientHub, createRpcServerAuto, listen, Replay, rpc} from "wenay-common2";
import {useReplaySubscribe} from "../src/common/src/hooks/useReplay";

jest.setTimeout(15000);

type NumberRemote = Replay.ReplayRemote<[number]>;

async function waitUntil(name: string, predicate: () => boolean, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`timeout waiting for ${name}`);
}

/** A genuine Socket.IO server/client pair; no Replay or RPC implementation is mocked. */
async function makeRpcFixture(history = 128) {
    const [emit, replay] = Replay.replayListen<[number]>({history}); // sacred: no keyframe fallback
    const object = {ticks: replay};
    const httpServer = createServer();
    const ioServer = new SocketIOServer(httpServer, {transports: ["polling"], cors: {origin: "*"}});
    const serverApis: any[] = [];
    ioServer.on("connection", socket => {
        const [disconnect, disconnectListen] = listen();
        socket.on("disconnect", () => disconnect(undefined as any));
        const server = createRpcServerAuto({
            socket: {emit: (key, data) => socket.emit(key, data), on: (key, cb) => socket.on(key, cb)},
            object,
            socketKey: "replay",
            disconnectListen,
        });
        serverApis.push(server.api);
    });
    await new Promise<void>(resolve => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address == "string") throw new Error("test Socket.IO server has no TCP port");
    const hub = createRpcClientHub(
        () => io(`http://127.0.0.1:${address.port}`, {
            transports: ["polling"], forceNew: true, reconnection: true, reconnectionDelay: 10, reconnectionDelayMax: 20,
        }),
        rpcType => ({replay: rpcType<typeof object>("replay")}),
    );
    const clients = await hub.connect(null);
    const remote = clients.replay.func.ticks as unknown as NumberRemote;

    return {
        emit,
        replay,
        remote,
        disconnect: async () => {
            const socket = hub.socket as any;
            const connectCount = hub.connectCount();
            const engine = socket?.io?.engine;
            if (!socket?.connected || !engine?.close) throw new Error("test Socket.IO client is not connected");
            engine.close(); // transient Engine.IO break: Socket.IO reconnects the SAME Socket object
            await waitUntil("Socket.IO disconnect", () => !socket.connected);
            return {socket, connectCount};
        },
        reconnect: async ({socket, connectCount}: {socket: any, connectCount: number}) => {
            await waitUntil("Socket.IO reconnect", () => socket.connected && hub.connectCount() == connectCount + 1);
            expect(hub.socket).toBe(socket);
        },
        serverConsumers: () => serverApis.reduce((sum, api) =>
            sum + api.subscriptions().reduce((count: number, item: any) => count + item.consumers, 0), 0),
        close: async () => {
            (clients.replay as any).dispose?.("test complete");
            hub.socket?.disconnect?.();
            await new Promise<void>(resolve => {
                ioServer.close();
                httpServer.close(() => resolve());
            });
        },
    };
}

function expectExact(values: number[], last: number) {
    expect(values).toHaveLength(last);
    expect(values).toEqual(Array.from({length: last}, (_, index) => index + 1));
    expect(new Set(values).size).toBe(last);
}

type ReconnectProbeProps = {
    remote: NumberRemote;
    revision: number;
    since: number;
    values: number[];
    callbackRevisions: number[];
    seqRevisions: number[];
    errors: string[];
    controllerRef: React.MutableRefObject<any>;
};

function ReconnectProbe(props: ReconnectProbeProps) {
    const renders = useRef(0);
    renders.current++;
    const controller = useReplaySubscribe(props.remote, value => {
        props.values.push(value);
        props.callbackRevisions.push(props.revision);
    }, {
        since: props.since,
        policy: "queue",
        hint: {revision: props.revision},
        onSeq: () => props.seqRevisions.push(props.revision),
        onError: error => props.errors.push(`${props.revision}:${error instanceof Error ? error.message : String(error)}`),
        onStale: () => undefined,
    });
    props.controllerRef.current = controller;
    return <output data-testid="rpc-reconnect-ready">{String(controller.ready)}:{renders.current}</output>;
}

test("useReplaySubscribe recovers a real RPC Replay Listen after reconnect under StrictMode", async () => {
    const fixture = await makeRpcFixture(128);
    const values: number[] = [];
    const callbackRevisions: number[] = [];
    const seqRevisions: number[] = [];
    const errors: string[] = [];
    const controllerRef = {current: null} as React.MutableRefObject<any>;

    const view = render(<StrictMode><ReconnectProbe remote={fixture.remote} revision={0} since={0}
        values={values} callbackRevisions={callbackRevisions} seqRevisions={seqRevisions}
        errors={errors} controllerRef={controllerRef}/></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("rpc-reconnect-ready").textContent?.startsWith("true")).toBe(true));
    await waitFor(() => expect(fixture.serverConsumers()).toBe(1));

    await act(async () => { for (let value = 1; value <= 10; value++) fixture.emit(value); });
    await waitFor(() => expectExact(values, 10));
    expect(controllerRef.current.seq()).toBe(10);

    const broken = await fixture.disconnect();
    await act(async () => { for (let value = 11; value <= 50; value++) fixture.emit(value); });
    expectExact(values, 10); // disconnected events are recovered from the sacred journal, not locally queued by React

    for (let revision = 1; revision <= 3; revision++) {
        view.rerender(<StrictMode><ReconnectProbe remote={fixture.remote} revision={revision} since={999}
            values={values} callbackRevisions={callbackRevisions} seqRevisions={seqRevisions}
            errors={errors} controllerRef={controllerRef}/></StrictMode>);
    }

    await fixture.reconnect(broken);
    await waitFor(() => expectExact(values, 50));
    expect(errors).toEqual([]);
    expect(callbackRevisions.slice(10)).toEqual(Array(40).fill(3));
    expect(seqRevisions.slice(10)).toEqual(Array(40).fill(3));
    expect(controllerRef.current.seq()).toBe(50);
    await waitFor(() => expect(fixture.serverConsumers()).toBe(1));

    await act(async () => { for (let value = 51; value <= 60; value++) fixture.emit(value); });
    await waitFor(() => expectExact(values, 60));
    expect(callbackRevisions.slice(50)).toEqual(Array(10).fill(3));
    expect(controllerRef.current.seq()).toBe(60);

    view.unmount();
    await waitFor(() => expect(fixture.serverConsumers()).toBe(0));
    await fixture.close();
});

test("callback/options rerenders preserve the RPC subscription, while a new remote starts a new line", async () => {
    const fixture = await makeRpcFixture();
    const values: number[] = [];
    const callbackRevisions: number[] = [];
    const seqRevisions: number[] = [];
    const errors: string[] = [];
    const controllerRef = {current: null} as React.MutableRefObject<any>;
    const view = render(<StrictMode><ReconnectProbe remote={fixture.remote} revision={0} since={0}
        values={values} callbackRevisions={callbackRevisions} seqRevisions={seqRevisions}
        errors={errors} controllerRef={controllerRef}/></StrictMode>);
    await waitFor(() => expect(fixture.serverConsumers()).toBe(1));

    for (let revision = 1; revision <= 3; revision++) {
        view.rerender(<StrictMode><ReconnectProbe remote={fixture.remote} revision={revision} since={1000}
            values={values} callbackRevisions={callbackRevisions} seqRevisions={seqRevisions}
            errors={errors} controllerRef={controllerRef}/></StrictMode>);
        expect(fixture.serverConsumers()).toBe(1);
    }
    await act(async () => fixture.emit(1));
    await waitFor(() => expect(values).toEqual([1]));
    expect(callbackRevisions).toEqual([3]);
    expect(controllerRef.current.seq()).toBe(1);

    const [emitOther, otherReplay] = Replay.replayListen<[number]>({history: 16});
    const otherRemote = Replay.exposeReplay(otherReplay);
    view.rerender(<StrictMode><ReconnectProbe remote={otherRemote} revision={4} since={0}
        values={values} callbackRevisions={callbackRevisions} seqRevisions={seqRevisions}
        errors={errors} controllerRef={controllerRef}/></StrictMode>);
    await waitFor(() => expect(fixture.serverConsumers()).toBe(0));
    await act(async () => emitOther(100));
    await waitFor(() => expect(values).toEqual([1, 100]));
    expect(controllerRef.current.seq()).toBe(1); // seq belongs to the new logical line, not the prior RPC line
    view.unmount();
    await fixture.close();
});

test("a high-frequency RPC Replay queue folds every event without React rendering per event", async () => {
    const fixture = await makeRpcFixture(4096);
    const values: number[] = [];
    const controllerRef = {current: null} as React.MutableRefObject<any>;
    const renderCount = {current: 0};

    function BurstProbe() {
        renderCount.current++;
        const controller = useReplaySubscribe(fixture.remote, value => values.push(value), {since: 0, policy: "queue"});
        controllerRef.current = controller;
        return <output data-testid="rpc-burst-ready">{String(controller.ready)}</output>;
    }

    const view = render(<StrictMode><BurstProbe/></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("rpc-burst-ready").textContent).toBe("true"));
    const rendersAfterReady = renderCount.current;
    const total = 3000;
    await act(async () => { for (let value = 1; value <= total; value++) fixture.emit(value); });
    await waitFor(() => expect(values).toHaveLength(total));
    expectExact(values, total);
    expect(controllerRef.current.seq()).toBe(total);
    expect(renderCount.current).toBe(rendersAfterReady);
    view.unmount();
    await fixture.close();
});

test("an evicted sacred RPC Replay cursor becomes hook error instead of silently skipping", async () => {
    const fixture = await makeRpcFixture(3);
    await act(async () => { for (let value = 1; value <= 5; value++) fixture.emit(value); });
    const values: number[] = [];
    const errors: string[] = [];

    function EvictionProbe() {
        const controller = useReplaySubscribe(fixture.remote, value => values.push(value), {
            since: 0,
            policy: "queue",
            onError: error => errors.push(error instanceof Error ? error.message : String(error)),
        });
        return <>
            <output data-testid="rpc-eviction-ready">{String(controller.ready)}</output>
            <output data-testid="rpc-eviction-error">{controller.error instanceof Error ? controller.error.message : String(controller.error ?? "")}</output>
        </>;
    }

    const view = render(<StrictMode><EvictionProbe/></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("rpc-eviction-error").textContent).toContain("journal evicted"));
    expect(screen.getByTestId("rpc-eviction-ready").textContent).toBe("false");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("journal evicted");
    expect(values).toEqual([]);
    view.unmount();
    await fixture.close();
});