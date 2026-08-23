/** Moved to utils/floatingWindowTypes.ts so the persisted-state registry (a utils leaf) no
 *  longer has to reach up into the component layer for a type - the one edge that contradicted
 *  the "utils never looks up" note in persistedMaps.ts. This path is kept as a re-export
 *  because it is not public API but is imported across the Dnd folder. */
export type * from "../../utils/floatingWindowTypes.js";
