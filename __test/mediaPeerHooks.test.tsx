import React from "react";

jest.mock("wenay-common2", () => {
    const actual = jest.requireActual("wenay-common2");
    return {...actual, Media: {...actual.Media, createVideoSource: jest.fn()}};
});
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Media, Observe, Peer} from "wenay-common2";
import {useMediaSource} from "../src/common/src/hooks/useMedia";
import {usePeer} from "../src/common/src/hooks/usePeer";

function fakeMedia() {
    const source: any = [() => {}, {on: () => () => {}}];
    source.state = "idle";
    source.start = jest.fn(async () => { source.state = "live"; return source.state; });
    source.stop = jest.fn(() => { source.state = "idle"; });
    source.setDevice = jest.fn(async () => source.state);
    source.listDevices = jest.fn(async () => []);
    source.getStats = jest.fn(() => ({state: source.state, frames: 0}));
    return source;
}

test("useMediaSource owns control lifecycle but leaves frames on the source listen", async () => {
    const source = fakeMedia();
    let finishStart: (() => void) | undefined;
    source.start = jest.fn(() => {
        source.state = "requesting";
        return new Promise<Media.MediaSourceState>(resolve => {
            finishStart = () => {
                source.state = "live";
                resolve("live");
            };
        });
    });
    (Media.createVideoSource as jest.Mock).mockReturnValue(source);
    function Probe() {
        const media = useMediaSource("video", {replay: true});
        return <><output data-testid="state">{media.state}</output><button onClick={() => void media.start()}>start</button></>;
    }
    const view = render(<Probe />);
    fireEvent.click(screen.getByText("start"));
    expect(screen.getByTestId("state").textContent).toBe("requesting");
    await act(async () => finishStart?.());
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("live"));
    expect(source.start).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(source.stop).toHaveBeenCalledTimes(1);
});

test("usePeer mirrors SDK route state and exposes its controls without owning transport", async () => {
    let onRoute: (() => void) | undefined;
    const peer: any = {
        store: {state: {}}, ready: Promise.resolve(), route: () => "relay", state: () => "relay", seq: () => 7,
        promoteDirect: jest.fn(), reinterposeRelay: jest.fn(), fallback: jest.fn(), block: jest.fn(), close: jest.fn(),
    };
    const client: any = {peer: () => peer, onRoute: (cb: () => void) => { onRoute = cb; return () => { onRoute = undefined; }; }, resync: jest.fn()};
    function Probe() {
        const value = usePeer(client, "other");
        return <><output data-testid="ready">{String(value.ready)}</output><output data-testid="seq">{value.seq()}</output><button onClick={() => value.resync()}>resync</button></>;
    }
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("seq").textContent).toBe("7");
    fireEvent.click(screen.getByText("resync"));
    expect(client.resync).toHaveBeenCalledTimes(1);
    await act(async () => { onRoute?.(); });
});
test("Peer SDK mirrors an in-process peer store and usePeer reads that store", async () => {
    const host = Peer.createPeerHost();
    const a = Peer.createPeerClient<{value: number}>({remote: host.connection("a").fragment, account: "a", initial: {value: 0}});
    const b = Peer.createPeerClient<{value: number}>({remote: host.connection("b").fragment, account: "b", initial: {value: 0}});
    function Probe() {
        const remote = usePeer(b, "a");
        return <output data-testid="peer-value">{String(remote.store.state.value)}</output>;
    }
    render(<Probe />);
    a.store.state.value = 42;
    await act(async () => { await Observe.flushReactive(a.store.state); });
    await waitFor(() => expect(screen.getByTestId("peer-value").textContent).toBe("42"));
    await act(async () => { a.close(); b.close(); });
});
