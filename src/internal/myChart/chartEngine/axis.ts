/** Shared axis geometry: the right Y-axis gutter and the world-X window it leaves for data.
 *  Lives apart from the renderer because the interaction layer (hit-testing the axis strip)
 *  and the engine (vertical auto-focus over the visible range) need the same numbers.
 *  Internal: not re-exported from the chartEngineReact barrel. */
import type { Transform } from './renderer.js';

// Right Y-axis width, a single file-level constant
export const AXIS_THICKNESS = 40;

// Visible world-X range for a drawing area of the given pixel width
export function visibleXRange(width: number, transform: Transform): [number, number] {
    return [transform.offsetX, transform.offsetX + (width - AXIS_THICKNESS) / transform.scaleX];
}
