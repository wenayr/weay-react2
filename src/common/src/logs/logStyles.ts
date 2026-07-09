export const logStyleTokens = {
    text: 'var(--logs-notification-text, #fff)',
    accent: 'var(--logs-notification-accent, #5D9FFA)',
    toggleBg: 'var(--logs-toggle-bg, rgb(58, 58, 58))',
    toggleOffBg: 'var(--logs-toggle-off-bg, rgb(144, 60, 60))',
    divider: 'var(--logs-divider, rgba(255, 255, 255, 1))',
    tabNavBg: 'var(--logs-tab-nav-bg, #333)',
    tabBg: 'var(--logs-tab-bg, #444)',
    tabActiveBg: 'var(--logs-tab-active-bg, #666)',
    tabText: 'var(--logs-tab-text, #fff)',
} as const;

export function logSeverityBackground(importance = 0) {
    const level = Number.isFinite(importance) ? Math.max(0, importance) : 0;
    return `rgb(${Math.min(255, level * 10)}, 73, 35)`;
}

export function logDividerGradient() {
    return `linear-gradient(to right, transparent, ${logStyleTokens.divider}, transparent)`;
}