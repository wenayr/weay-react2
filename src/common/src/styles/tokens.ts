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
        shadow: '0 0 20px 14px rgba(34, 60, 80, 0.2)',
    },
    /** DivRnd3 window chrome (--wnd-*). Defaults = legacy look; apps re-skin via :root[data-theme].
     *  --wnd-header-height/color/font-size/letter-spacing/transform are intentionally undeclared
     *  (inherit/auto) until a theme sets them. */
    wnd: {
        bg: 'transparent',
        border: 'none',
        radius: '0',
        shadow: 'none',
        headerBg: 'transparent',
        headerStripes: 'repeating-linear-gradient(139deg, hsla(0, 0%, 100%, 0.1), hsla(0, 0%, 100%, 0.1) 15px, transparent 0, transparent 30px)',
        headerBorder: 'none',
        headerPadding: '0',
        closeSize: '28px',
        closeTop: '-12px',
        closeRight: '-12px',
        /** var(--color-bg-light) in CSS */
        closeBg: '#17202e',
        /** var(--color-border-common) in CSS */
        closeBorder: '1px solid rgb(50, 62, 71)',
        closeShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
        /** var(--color-text-base) in CSS */
        closeColor: '#c4c4c4',
        closeHover: '#fff',
        closeHoverBg: '#e5484d',
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
