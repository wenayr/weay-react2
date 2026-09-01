import type { DataSet } from './dataSet.js';

/**
 * PanelManager
 * Use heightPct (percent) instead of pixel height.
 */
export interface Panel {
    id: string;
    left: number;       // px
    top: number;        // px (calculated)
    width: number;      // px (here = canvas.width)
    height: number;     // px (calculated)
    heightPct: number;  // share of 100 (except the last panel, which may fill the rest)
    dataSets: DataSet[];
    verticalRange: { minY: number; maxY: number };
    autoFocusY: boolean;
    resizable?: boolean;
}

export interface PanelConfig {
    id: string;
    /** Height percent: 0..100; the last panel fills the remainder */
    heightPct?: number;
    dataSets: DataSet[];
    autoFocusY?: boolean;
    resizable?: boolean;
}

export interface PanelManager {
    panels: Panel[];

    addPanel(config: PanelConfig): void;

    layoutPanels(containerWidth: number, containerHeight: number): void;
    resizePanel(panelId: string, deltaPx: number, containerHeight: number): void;
}

export function createPanelManager(): PanelManager {
    const panels: Panel[] = [];

    function addPanel(config: PanelConfig) {
        const p: Panel = {
            id: config.id,
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            heightPct: config.heightPct ?? 20, // default 20% (or any other value)
            dataSets: config.dataSets,
            verticalRange: { minY: 0, maxY: 1 },
            autoFocusY: config.autoFocusY !== false,
            resizable: config.resizable ?? false
        };
        panels.push(p);
    }

    /**
     * layoutPanels:
     *  - Sum heightPct for all panels except the last one.
     *  - Last panel = 100% - sum of previous panels (if the sum is below 100).
     *  - Convert percents to px and calculate top/height.
     */
    function layoutPanels(containerWidth: number, containerHeight: number) {
        // Percent sum for all panels except the last one
        if (panels.length === 0) return;

        // Calculate the sum of assigned percents (except the last one)
        let totalAssignedPct = 0;
        for (let i = 0; i < panels.length - 1; i++) {
            totalAssignedPct += panels[i].heightPct;
        }
        if (totalAssignedPct > 100) totalAssignedPct = 100; // clamp

        // Give the remaining space to the last panel
        const lastPanel = panels[panels.length - 1];
        lastPanel.heightPct = 100 - totalAssignedPct;

        // Now calculate top/height
        let currentTopPx = 0;
        for (const p of panels) {
            // Convert percent to px
            const hPx = (p.heightPct / 100) * containerHeight;
            p.left = 0;
            p.top = currentTopPx;
            p.width = containerWidth;
            p.height = hPx;

            currentTopPx += hPx;
        }
    }

    /**
     * resizePanel: change one panel height percent while dragging.
     * deltaPx is the height change in px, converted to percent.
     */
    function resizePanel(panelId: string, deltaPx: number, containerHeight: number) {
        const idx = panels.findIndex((p) => p.id === panelId);
        if (idx < 0) return;
        // A container that reports no height yet (the ResizeObserver has not fired, or the
        // chart collapsed mid-drag) turns the conversion below into Infinity, or NaN when
        // deltaPx is 0 - and NaN compares false against both clamps, so it would be written
        // to heightPct and then spread through every layoutPanels() pass for the life of the
        // chart. There is no percentage to compute against; skip the frame.
        if (!(containerHeight > 0)) return;
        const p = panels[idx];

        // Current percent
        const oldPct = p.heightPct;
        // px -> pct
        const deltaPct = (deltaPx / containerHeight) * 100;
        const newPct = p.heightPct + deltaPct;

        // Clamp to avoid negative values
        if (newPct < 5) { // Minimum 5% (arbitrary)
            p.heightPct = 5;
        } else if (newPct > 95) {
            p.heightPct = 95;
        } else {
            p.heightPct = newPct;
        }
    }

    return {
        panels,
        addPanel,
        layoutPanels,
        resizePanel
    };
}
