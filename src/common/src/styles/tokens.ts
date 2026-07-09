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
        bgColor: '#0c0c0c',
        blur: '0px',
        border: '1px solid rgba(255, 255, 255, 0.41)',
        activeBackground: '#262626',
        itemColor: '#fff',
        itemActiveBgColor: '#262626',
        itemActiveColor: '#fff',
        itemHoverColor: '#101010',
        itemHoverBgColor: '#fff',
        itemPressedColor: '#101010',
        itemPressedBgColor: '#f2c94c',
        outlineColor: '#007bff',
        shadow: '0 0 20px 14px rgba(34, 60, 80, 0.2)',
    },    /** FloatingWindow window chrome (--wnd-*). Defaults = legacy look; apps re-skin via :root[data-theme].
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
    /** SettingsDialog chrome (--dlg-*). Dark defaults; apps re-skin via :root[data-theme]. */
    dlg: {
        scrim: 'rgba(0, 0, 0, 0.5)',
        /** var(--color-bg-dark) in CSS */
        bg: '#131821',
        /** var(--color-border-common) in CSS */
        border: '1px solid rgb(50, 62, 71)',
        radius: '10px',
        shadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        /** var(--color-bg-light) in CSS */
        navBg: '#17202e',
        navWidth: '220px',
    },
    /** Toolbar (createToolbar) chrome (--tb-*). Dark defaults; apps re-skin via :root[data-theme]. */
    tb: {
        bg: 'transparent',
        border: 'none',
        radius: '6px',
        gap: '2px',
        /** var(--color-text-base) in CSS */
        itemColor: '#c4c4c4',
        itemHoverBg: 'rgba(255, 255, 255, 0.08)',
        itemRadius: '6px',
        /** var(--color-bg-dark) in CSS */
        popBg: '#131821',
        /** var(--color-border-common) in CSS */
        popBorder: '1px solid rgb(50, 62, 71)',
        popRadius: '8px',
        popShadow: '0 8px 28px rgba(0, 0, 0, 0.5)',
    },
    /** Column-state compact menu (ColumnsMenu/MenuStrip) chrome (--cols-menu-*). */
    colsMenu: {
        gap: '6px',
        btnGap: '4px',
        btnPadding: '3px 9px',
        btnRadius: '6px',
        btnFontSize: '12px',
        btnLineHeight: '16px',
        onBorder: '1px solid #24292f',
        onBg: '#24292f',
        onColor: '#fff',
        offBorder: '1px solid #d0d7de',
        offBg: '#fff',
        offColor: '#8c959f',
        disabledBorder: '1px dashed #d0d7de',
        disabledBg: '#f6f8fa',
        disabledColor: '#c4ccd4',
        fixedShadow: '0 0 0 2px #eaeef2',
        dragShadow: '0 3px 10px rgba(0, 0, 0, 0.35)',
        divider: '#d0d7de',
        abbrFontSize: '10px',
        abbrFontWeight: 700,
        abbrLetterSpacing: '0.5px',
        marksFontSize: '9px',
        marksOpacity: 0.9,
    },
    /** ColumnDots chrome (--cols-dots-*). Defaults preserve restored card-29 look. */
    colsDots: {
        text: '#24292f',
        headGap: '10px',
        headMarginBottom: '6px',
        headFontSize: '12px',
        metaColor: '#57606a',
        sortBorder: '1px solid #6e7781',
        sortRadius: '6px',
        sortPadding: '2px 8px',
        sortFontSize: '12px',
        sortBg: '#fff',
        trackHeight: '56px',
        trackMargin: '0 14px',
        rail: '#d0d7de',
        markWidth: '44px',
        markHeight: '56px',
        markMarginLeft: '-22px',
        sortMarkColor: '#0969da',
        sortMarkFontSize: '11px',
        pin: '#afb8c1',
        labelColor: '#8c959f',
        labelActiveColor: '#24292f',
        labelFontSize: '10px',
        dotSize: '18px',
        dotRadius: '9px',
        dotBg: '#24292f',
        dotShadow: '0 3px 10px rgba(0, 0, 0, 0.35)',
        selectedBg: '#0969da',
        selectedBorder: '#b6d4fe',
        fixedBorder: '#afb8c1',
    },
    /** CardList chrome (--cols-card-*). Defaults preserve restored card-29 look. */
    colsCard: {
        gap: '8px',
        border: '1px solid #d0d7de',
        radius: '8px',
        padding: '8px 10px',
        bg: '#fff',
        headerGap: '8px',
        headerMarginBottom: '6px',
        titleFontSize: '14px',
        accentFontSize: '11px',
        accentPadding: '1px 8px',
        accentRadius: '10px',
        accentBg: '#ddf4ff',
        accentColor: '#0969da',
        fieldGap: '10px',
        fieldFontSize: '12px',
        fieldLineHeight: 1.7,
        labelColor: '#57606a',
        labelMinWidth: '72px',
    },    /** Logs chrome (--logs-*). Defaults preserve the old logger look; apps re-skin via CSS vars. */
    logs: {
        notificationText: '#fff',
        notificationAccent: '#5D9FFA',
        toggleBg: 'rgb(58, 58, 58)',
        toggleOffBg: 'rgb(144, 60, 60)',
        divider: 'rgba(255, 255, 255, 1)',
        tabNavBg: '#333',
        tabBg: '#444',
        tabActiveBg: '#666',
        tabText: '#fff',
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
