/** The canvas plumbing all three renderers need: device pixel ratio, a container-size
 *  subscription, and sizing the bitmap for a CSS box.
 *
 *  Sparkline solved this properly, chartEngineReact solved half of it (ResizeObserver, no DPR),
 *  and myChart solved none of it - it measured the container once at creation and never again,
 *  so a chart in a resizable panel kept its original bitmap forever. Three copies of the same
 *  concern is also why DPR support could never be rolled out consistently.
 *
 *  Internal: not re-exported from any barrel. */

/** Never 0 or NaN: a bad ratio would collapse the bitmap. 1 on the server. */
export function currentDevicePixelRatio(): number {
    return typeof window == "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
}

/** Observe an element's content box. No-op (returns a no-op disposer) without a DOM or when
 *  ResizeObserver is unavailable, so callers need no environment checks of their own. */
export function observeElementBox(
    element: Element | null | undefined,
    onResize: (size: {width: number; height: number}) => void,
): () => void {
    if (!element || typeof ResizeObserver == "undefined") return () => {};
    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            if (entry.target !== element) continue;
            const box = entry.contentRect;
            onResize({width: box.width, height: box.height});
        }
    });
    observer.observe(element);
    return () => observer.disconnect();
}

/** Point the canvas bitmap at a CSS box. With `dpr` > 1 the bitmap is scaled up and the context
 *  transform set so drawing code keeps working in CSS pixels. Returns true when the bitmap
 *  actually changed - assigning width/height clears the canvas, so callers should redraw. */
export function sizeCanvasToBox(
    canvas: HTMLCanvasElement,
    cssWidth: number,
    cssHeight: number,
    dpr = 1,
): boolean {
    const width = Math.max(0, Math.round(cssWidth * dpr));
    const height = Math.max(0, Math.round(cssHeight * dpr));
    if (canvas.width == width && canvas.height == height) return false;
    canvas.width = width;
    canvas.height = height;
    if (dpr != 1) canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
}
