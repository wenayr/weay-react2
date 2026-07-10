import React from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Peer} from "wenay-common2";
import {usePeerCalls, usePeerPresence} from "../src/common/src/hooks/usePeerCall";

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