// TS mirror of design tokens (src/style/tokens.css). Values must match CSS.
// For inline styles, ag-grid themes (styleGrid.ts, grid/agGrid4/theme.ts), and layers (z-index).

export const tokens = {
    color: {
        bgDark: '#131821',
        bgLight: '#17202e',
        scrollbarTrack: 'rgba(255, 255, 255, 0)',
        scrollbarThumb: '#1d262c',
        scrollbarThumbAlt: '#4c4562',
        textBase: '#c4c4c4',
        textTheme: '#5D9FFA',
        borderCommon: 'rgb(50, 62, 71)',
    },
    menu: {
        bgColor: 'rgba(12, 12, 12, 0.91)',
        blur: '10px',
        border: '1px solid rgba(255, 255, 255, 0.41)',
        activeBackground: 'rgba(255, 255, 255, 0.23)',
        itemColor: '#fff',
        itemHoverColor: '#101010',
        itemHoverBgColor: '#fff',
    },
    font: {
        family: 'Roboto',
        sizeBase: '12px',
    },
    zIndex: {
        /** CSS variable --wenay-z-modal; fallback in ModalProvider */
        modal: 9999,
    },
    /** ag-grid theme params shared by GridStyleDefault (legacy) and agGrid4 buildAgTheme */
    grid: {
        fontFamily: 'Roboto',
        textColor: 'rgba(214,214,214,0.9)',
        tabTextColor: 'rgba(227,227,227,0.9)',
        fontSize: '10px',
        spacing: '3px',
        backgroundColor: 'rgb(19,24,33)',
    },
} as const

export type Tokens = typeof tokens
