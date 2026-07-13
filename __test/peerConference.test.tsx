import React from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {createFakeRtcNet} from "../src/common/demo/fakeRtcLoopback";
import {ConfFrame, ConferenceCallDemo, createConferenceWorld} from "../src/common/demo/peerConference";

const cheapFrame = (account: string, n: number): ConfFrame => ({n, at: 1000 + n, image: account + "#" + n});

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function until(label: string, cond: () => boolean, tries = 300) {
    for (let i = 0; i < tries; i++) {
        if (cond()) return;
        await sleep(10);
    }
    throw new Error("timeout: " + label);
}

function makeWorld() {
    const net = createFakeRtcNet();
    const world = createConferenceWorld({rtc: net.pc, killTransport: net.killLiveChannels, fps: 0, frame: cheapFrame});
    return {net, world};
}

/** Host rings a member and the member auto-accepts — the star-join used by most tests. */
async function join(world: ReturnType<typeof createConferenceWorld>, member: string) {
    const offRing = world.managers.get(member)!.rings.on(handle => handle.accept());
    world.ring(member);
    await until(`${member} joins`, () => world.inRoster(member));
    offRing();
}

test("host star: one manager holds concurrent outgoing calls and the roster follows accept/hangup", async () => {
    const {world} = makeWorld();
    try {
        expect(world.roster()).toEqual(["conf-a"]);
        const accepts = new Map<string, () => void>();
        for (const member of ["conf-b", "conf-c"]) {
            world.managers.get(member)!.rings.on(handle => accepts.set(member, () => handle.accept()));
        }
        // both star calls ring CONCURRENTLY from the single host manager
        world.ring("conf-b");
        world.ring("conf-c");
        await until("both rings arrive", () => accepts.size === 2);
        accepts.get("conf-b")!();
        await until("b active", () => world.inRoster("conf-b"));
        expect(world.roster()).toEqual(["conf-a", "conf-b"]);
        accepts.get("conf-c")!();
        await until("c active", () => world.inRoster("conf-c"));
        expect(world.roster()).toEqual(["conf-a", "conf-b", "conf-c"]);
        // leave = hangup from either side; only that member drops
        world.hostCalls.get("conf-b")!.hangup();
        await until("b left", () => !world.inRoster("conf-b"));
        expect(world.roster()).toEqual(["conf-a", "conf-c"]);
        // re-join works (a fresh call handle replaces the ended one)
        await join(world, "conf-b");
        expect(world.roster()).toEqual(["conf-a", "conf-b", "conf-c"]);
    } finally { world.close(); }
});

test("relay grid ACL follows room membership: leaving freezes only that seat, re-joining resumes", async () => {
    const {world} = makeWorld();
    try {
        await join(world, "conf-b");
        await join(world, "conf-c");
        const seen: Record<string, number[]> = {b: [], c: []};
        (world.relay.watchOf("conf-a") as any)["conf-b"].cam.on((frame: ConfFrame) => seen.b.push(frame.n));
        (world.relay.watchOf("conf-a") as any)["conf-c"].cam.on((frame: ConfFrame) => seen.c.push(frame.n));
        world.tick();
        expect(seen.b).toEqual([1]);
        expect(seen.c).toEqual([1]);
        world.hostCalls.get("conf-b")!.hangup();
        await until("b out", () => !world.inRoster("conf-b"));
        world.tick();
        // b's painter is gated by membership AND the relay ACL would gate an external
        // publisher; prove the ACL leg separately with a direct publish bypassing tick()
        world.relay.publishOf("conf-b")("cam", cheapFrame("conf-b", 99), 99);
        expect(seen.b).toEqual([1]);
        expect(seen.c).toEqual([1, 2]);
        await join(world, "conf-b");
        world.tick();
        expect(seen.b).toEqual([1, 2]);
        expect(seen.c).toEqual([1, 2, 3]);
    } finally { world.close(); }
});

test("focus link on the relay route: the serveReplayChannel hop preserves the owner seq authority", async () => {
    const {world} = makeWorld();
    try {
        await join(world, "conf-b");
        world.tick();
        world.tick();
        const got: ConfFrame[] = [];
        const link = world.focus("conf-b");
        const sub = link.subscribe(frame => got.push(frame));
        await sub.ready;
        // history catch-up from the owner journal (keyframe = last event with current:"last")
        await until("catch-up arrives", () => got.length >= 1);
        world.tick();
        await until("live frame over the hop", () => got.some(frame => frame.n === 3));
        expect(link.state()).toBe("relay");
        expect(sub.seq()).toBe(world.lineOf("conf-b").head());
        sub();
    } finally { world.close(); }
});

test("promoteDirect over the loopback RTC is gap-free by seq, and reinterposeRelay returns cleanly", async () => {
    const {net, world} = makeWorld();
    try {
        await join(world, "conf-b");
        world.tick();
        const got: number[] = [];
        const hops: string[] = [];
        world.coordinator.onRoute(event => hops.push(event.from + ">" + event.to));
        const link = world.focus("conf-b");
        const sub = link.subscribe(frame => got.push(frame.n));
        await sub.ready;
        await until("baseline", () => got.length >= 1);
        const promoted = await link.promoteDirect({timeoutMs: 4000});
        expect(promoted.ok).toBe(true);
        expect(link.state()).toBe("direct");
        expect(net.stats.channels).toBe(1);
        world.tick();
        world.tick();
        await until("frames over the datachannel", () => got.includes(3));
        // strictly monotonic +1 across the hand-off: no gap, no duplicate
        expect(got).toEqual(got.map((_, index) => got[0] + index));
        const back = await link.reinterposeRelay("manual");
        expect(back.ok).toBe(true);
        expect(link.state()).toBe("relay");
        world.tick();
        await until("frames after demote", () => got.includes(4));
        expect(got).toEqual(got.map((_, index) => got[0] + index));
        expect(hops).toContain("relay>direct:connecting");
        expect(hops).toContain("direct:connecting>direct");
        sub();
    } finally { world.close(); }
});

test("policy gates deny loudly and recover: mustRelay, then endpoint refusal at the host", async () => {
    const {world} = makeWorld();
    try {
        await join(world, "conf-b");
        world.tick();
        const link = world.focus("conf-b");
        const got: number[] = [];
        const sub = link.subscribe(frame => got.push(frame.n));
        await sub.ready;
        world.setForceRelay(true);
        const denied = await link.promoteDirect({timeoutMs: 2000});
        expect(denied.ok).toBe(false);
        expect(String(denied.reason)).toContain("mustRelay");
        expect(link.state()).toBe("relay");
        world.setForceRelay(false);
        world.setAllowEndpoint(false);
        const refused = await link.promoteDirect({timeoutMs: 2000});
        expect(refused.ok).toBe(false);
        expect(String(refused.reason)).toContain("endpoint");
        // the failed promote lands in fallback but the relay hop keeps delivering
        const before = got.length;
        world.tick();
        await until("relay frames after refusal", () => got.length > before);
        world.setAllowEndpoint(true);
        const retry = await link.promoteDirect({timeoutMs: 4000});
        expect(retry.ok).toBe(true);
        expect(link.state()).toBe("direct");
        sub();
    } finally { world.close(); }
});

test("server revoke and transport death both auto-fall back without losing frames", async () => {
    const {world} = makeWorld();
    try {
        await join(world, "conf-b");
        world.tick();
        const link = world.focus("conf-b");
        const got: number[] = [];
        const sub = link.subscribe(frame => got.push(frame.n));
        await sub.ready;
        expect((await link.promoteDirect({timeoutMs: 4000})).ok).toBe(true);
        world.revokeDirect("conf-b");
        await until("revoke fallback", () => link.state() === "fallback");
        world.tick();
        await until("relay resumes after revoke", () => got.includes(2));
        expect(got).toEqual(got.map((_, index) => got[0] + index));
        // recover into direct, then kill the transport itself
        expect((await link.promoteDirect({timeoutMs: 4000})).ok).toBe(true);
        world.killDirect();
        await until("transport-death fallback", () => link.state() === "fallback");
        world.tick();
        await until("relay resumes after kill", () => got.includes(3));
        expect(got).toEqual(got.map((_, index) => got[0] + index));
        sub();
    } finally { world.close(); }
});

test("late joiner catches up from the owner journal and still promotes gap-free", async () => {
    const {world} = makeWorld();
    try {
        await join(world, "conf-b");
        for (let i = 0; i < 12; i++) world.tick();
        const got: number[] = [];
        const link = world.focus("conf-b");
        const sub = link.subscribe(frame => got.push(frame.n));
        await sub.ready;
        await until("late catch-up", () => got.length >= 1);
        // current:"last" keyframe: the newest frame, not a replay of the whole history
        expect(got[0]).toBe(12);
        expect((await link.promoteDirect({timeoutMs: 4000})).ok).toBe(true);
        world.tick();
        await until("post-promote frame", () => got.includes(13));
        expect(got).toEqual(got.map((_, index) => got[0] + index));
        sub();
    } finally { world.close(); }
});

test("ConferenceCallDemo React flow: join via buttons, promote flips the chip, unmount is clean", async () => {
    // jsdom has no RTCPeerConnection, so the demo starts in simulate-RTC mode by itself
    const view = render(<ConferenceCallDemo />);
    expect(screen.getByText(/room: conf-a$/)).toBeTruthy();
    fireEvent.click(screen.getByText("ring conf-b"));
    await waitFor(() => expect(screen.getAllByText("accept").length).toBe(1));
    fireEvent.click(screen.getByText("accept"));
    await waitFor(() => expect(screen.getByText(/room: conf-a, conf-b/)).toBeTruthy());
    fireEvent.click(screen.getByText("go direct"));
    await waitFor(() => expect(screen.getByText("direct")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/promote: ok/)).toBeTruthy());
    // policy denial renders its reason
    fireEvent.click(screen.getByText("back to relay"));
    await waitFor(() => expect(screen.getByText("relay")).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/force relay/));
    fireEvent.click(screen.getByText("go direct"));
    await waitFor(() => expect(screen.getByText(/denied.*mustRelay/)).toBeTruthy());
    await act(async () => { view.unmount(); });
});
