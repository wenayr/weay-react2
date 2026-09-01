import React from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Peer} from "wenay-common2";
import {usePeerCalls, usePeerPresence} from "../src/internal/hooks/usePeerCall";

test("usePeerCalls follows the real in-process ring accept hangup lifecycle", async () => {
    const host = Peer.createPeerHost();
    const a = host.connection("call-a");
    const b = host.connection("call-b");
    const caller = Peer.createCallManager({port: Peer.callPortOf(a.fragment), self: "call-a"});
    const callee = Peer.createCallManager({port: Peer.callPortOf(b.fragment), self: "call-b"});
    await Promise.all([caller.ready, callee.ready]);
    function Probe() {
        const outgoing = usePeerCalls(caller);
        const incoming = usePeerCalls(callee);
        return <>
            <button onClick={() => outgoing.call("call-b")}>call</button>
            <output data-testid="incoming">{incoming.rings.length}</output>
            <output data-testid="active">{String(Boolean(incoming.active))}</output>
            <button onClick={() => incoming.rings[0]?.accept()}>accept</button>
            <button onClick={() => outgoing.active?.hangup()}>hangup</button>
        </>;
    }
    const view = render(<Probe />);
    fireEvent.click(screen.getByText("call"));
    await waitFor(() => expect(screen.getByTestId("incoming").textContent).toBe("1"));
    fireEvent.click(screen.getByText("accept"));
    await waitFor(() => expect(screen.getByTestId("active").textContent).toBe("true"));
    fireEvent.click(screen.getByText("hangup"));
    await waitFor(() => expect(screen.getByTestId("active").textContent).toBe("false"));
    view.unmount();
    await act(async () => { caller.close(); callee.close(); host.close(); });
});

test("usePeerPresence reads snapshot and online/offline edges from the host", async () => {
    const host = Peer.createPeerHost();
    const a = host.connection("presence-a");
    const b = host.connection("presence-b");
    function Probe() {
        const presence = usePeerPresence(a.fragment.presence);
        return <output data-testid="presence">{presence.accounts.join(",")}</output>;
    }
    const view = render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("presence").textContent).toContain("presence-b"));
    await act(async () => b.close());
    await waitFor(() => expect(screen.getByTestId("presence").textContent).not.toContain("presence-b"));
    view.unmount();
    await act(async () => { a.close(); host.close(); });
});

test("usePeerPresence reconciles edges received before a slow list snapshot", async () => {
    let emit!: (edge: {account: string, online: boolean}) => void;
    let resolveList!: (accounts: string[]) => void;
    const changes = {
        on(listener: typeof emit) {
            emit = listener;
            return () => { emit = () => {}; };
        },
    };
    const list = new Promise<string[]>(resolve => { resolveList = resolve; });
    const presence = {changes, list: () => list} as any;

    function Probe() {
        return <output data-testid="slow-presence">{usePeerPresence(presence).accounts.join(",")}</output>;
    }

    const view = render(<Probe/>);
    act(() => {
        emit({account: "stale-online", online: false});
        emit({account: "new-online", online: true});
    });
    await act(async () => resolveList(["stale-online", "snapshot-only"]));

    await waitFor(() => expect(screen.getByTestId("slow-presence").textContent)
        .toBe("new-online,snapshot-only"));
    view.unmount();
});

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });
    return {promise, resolve, reject};
}

function fakeListen<T extends unknown[]>() {
    let listener: ((...args: T) => void) | null = null;
    let subscriptions = 0;
    return {
        listen: {
            on(next: (...args: T) => void) {
                listener = next;
                subscriptions++;
                return () => {
                    if (listener === next) listener = null;
                    subscriptions--;
                };
            },
        },
        emit(...args: T) { listener?.(...args); },
        count() { return subscriptions; },
    };
}

test("usePeerCalls owns incoming and outgoing subscriptions and derives ready only from manager.ready", async () => {
    const readyA = deferred<void>();
    const readyB = deferred<void>();
    const endedA = deferred<void>();
    const endedB = deferred<void>();
    const ringsA = fakeListen<[any]>();
    const ringsB = fakeListen<[any]>();
    const changedA = fakeListen<[]>();
    const changedB = fakeListen<[]>();
    const handleA = {
        id: "same-id",
        changed: changedA.listen,
        ended: endedA.promise,
        state: () => "ringing",
    } as any;
    const handleB = {
        id: "same-id",
        changed: changedB.listen,
        ended: endedB.promise,
        state: () => "ringing",
    } as any;
    const managerA = {
        ready: readyA.promise,
        rings: ringsA.listen,
        active: () => null,
        call: jest.fn(() => handleA),
    } as any;
    const managerB = {
        ready: readyB.promise,
        rings: ringsB.listen,
        active: () => null,
        call: jest.fn(() => handleB),
    } as any;

    const renderedReadiness: Array<{manager: any, ready: boolean}> = [];
    function Probe({manager}: {manager: any}) {
        const controller = usePeerCalls(manager);
        renderedReadiness.push({manager, ready: controller.ready});
        return <>
            <output data-testid="calls-ready">{String(controller.ready)}</output>
            <output data-testid="calls-count">{controller.calls.length}</output>
            <button onClick={() => controller.call("other")}>mock call</button>
        </>;
    }

    const view = render(<Probe manager={managerA}/>);
    fireEvent.click(screen.getByText("mock call"));
    await waitFor(() => expect(screen.getByTestId("calls-count").textContent).toBe("1"));
    expect(screen.getByTestId("calls-ready").textContent).toBe("false");
    expect(changedA.count()).toBe(1);

    await act(async () => readyA.resolve());
    await waitFor(() => expect(screen.getByTestId("calls-ready").textContent).toBe("true"));

    view.rerender(<Probe manager={managerB}/>);
    expect(renderedReadiness.find(entry => entry.manager === managerB)?.ready).toBe(false);
    await waitFor(() => expect(screen.getByTestId("calls-count").textContent).toBe("0"));
    expect(screen.getByTestId("calls-ready").textContent).toBe("false");
    expect(changedA.count()).toBe(0);
    expect(ringsA.count()).toBe(0);
    expect(ringsB.count()).toBe(1);

    fireEvent.click(screen.getByText("mock call"));
    await waitFor(() => expect(screen.getByTestId("calls-count").textContent).toBe("1"));
    expect(changedB.count()).toBe(1);

    // A rejected old lifecycle is consumed and cannot remove a replacement handle
    // that happens to reuse the same public id.
    await act(async () => endedA.reject(new Error("old call ended with transport error")));
    expect(screen.getByTestId("calls-count").textContent).toBe("1");
    expect(changedB.count()).toBe(1);
    await act(async () => readyB.reject(new Error("manager failed to initialize")));
    expect(screen.getByTestId("calls-ready").textContent).toBe("false");

    view.unmount();
    expect(ringsB.count()).toBe(0);
    expect(changedB.count()).toBe(0);
    await act(async () => endedB.reject(new Error("settled after unmount")));
});
test("media relay filters an already-open viewer after ACL revocation", () => {
    let permitted = true;
    const relay = Peer.createMediaRelay({lines: {cam: "video"}, canWatch: () => permitted});
    const publish = relay.publishOf("owner");
    const viewer: any = relay.watchOf("watcher");
    const received: string[] = [];
    const off = viewer.owner.cam.on((frame: string) => received.push(frame));
    publish("cam", "first", 1);
    expect(received).toEqual(["first"]);
    permitted = false;
    publish("cam", "blocked", 2);
    expect(received).toEqual(["first"]);
    expect(viewer.owner).toBeUndefined();
    off();
    relay.close();
});
test("audio relay forwards PCM frames only while its ACL is granted", () => {
    let permitted = true;
    const relay = Peer.createMediaRelay({lines: {mic: "audio"}, canWatch: () => permitted});
    const publish = relay.publishOf("speaker");
    const viewer: any = relay.watchOf("listener");
    const frames: Uint8Array[] = [];
    const off = viewer.speaker.mic.on((frame: Uint8Array) => frames.push(frame));
    const first = new Uint8Array([1, 2, 3]);
    publish("mic", first, 1);
    expect(frames).toEqual([first]);
    permitted = false;
    publish("mic", new Uint8Array([4]), 2);
    expect(frames).toEqual([first]);
    off();
    relay.close();
});
