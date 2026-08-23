import {tokens} from '../styles/tokens.js';

/** The `var(--logs-*, fallback)` form of tokens.logs. The fallbacks used to be a second,
 *  hand-written copy of the same nine colours - editing tokens.logs recoloured the objects
 *  exported from tokens but not what the logs actually painted. They are derived now, so the
 *  values live in exactly one place; the rendered strings are unchanged. */
const withVar = (name: string, fallback: string) => `var(${name}, ${fallback})`;

export const logStyleTokens = {
    text: withVar('--logs-notification-text', tokens.logs.notificationText),
    accent: withVar('--logs-notification-accent', tokens.logs.notificationAccent),
    toggleBg: withVar('--logs-toggle-bg', tokens.logs.toggleBg),
    toggleOffBg: withVar('--logs-toggle-off-bg', tokens.logs.toggleOffBg),
    divider: withVar('--logs-divider', tokens.logs.divider),
    tabNavBg: withVar('--logs-tab-nav-bg', tokens.logs.tabNavBg),
    tabBg: withVar('--logs-tab-bg', tokens.logs.tabBg),
    tabActiveBg: withVar('--logs-tab-active-bg', tokens.logs.tabActiveBg),
    tabText: withVar('--logs-tab-text', tokens.logs.tabText),
} as const;

export function logSeverityBackground(importance = 0) {
    const level = Number.isFinite(importance) ? Math.max(0, importance) : 0;
    return `rgb(${Math.min(255, level * 10)}, 73, 35)`;
}

export function logDividerGradient() {
    return `linear-gradient(to right, transparent, ${logStyleTokens.divider}, transparent)`;
}