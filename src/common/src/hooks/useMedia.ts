import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Media} from "wenay-common2";

export type UseMediaSourceController = {
    source: Media.MediaSource;
    listen: Media.MediaAnyListen;
    state: Media.MediaSourceState;
    start(): Promise<Media.MediaSourceState>;
    stop(): void;
    setDevice(id: string): Promise<Media.MediaSourceState>;
    listDevices(): Promise<Media.MediaSourceDevice[]>;
    stats(): Media.MediaStats;
};

/** React lifecycle adapter for a common2 Media source. Frames stay on `listen`:
 * draw/play them through a canvas or AudioContext, never through React state. */
export function useMediaSource(
    kind: "audio" | "video",
    options: Media.AudioSourceOpts | Media.VideoSourceOpts = {},
): UseMediaSourceController {
    const sourceRef = useRef<Media.MediaSource | null>(null);
    if (!sourceRef.current)
        sourceRef.current = kind == "video"
            ? Media.createVideoSource(options as Media.VideoSourceOpts)
            : Media.createAudioSource(options as Media.AudioSourceOpts);
    const source = sourceRef.current;
    const [state, setState] = useState<Media.MediaSourceState>(source.state);
    const sync = useCallback(() => setState(source.state), [source]);
    const start = useCallback(async () => {
        const pending = source.start();
        // common2 changes state to "requesting" synchronously, before the
        // permission/device promise settles. Publish that control-plane state
        // without polling while keeping media frames outside React state.
        sync();
        const next = await pending;
        setState(next);
        return next;
    }, [source, sync]);
    const stop = useCallback(() => {
        source.stop();
        sync();
    }, [source, sync]);
    const setDevice = useCallback(async (id: string) => {
        const next = await source.setDevice(id);
        setState(next);
        return next;
    }, [source]);

    useEffect(() => () => source.stop(), [source]);

    return useMemo(() => ({
        source,
        listen: source[1],
        state,
        start,
        stop,
        setDevice,
        listDevices: () => source.listDevices(),
        stats: () => source.getStats(),
    }), [source, state, start, stop, setDevice]);
}
