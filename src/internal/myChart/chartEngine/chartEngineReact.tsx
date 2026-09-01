/*************************************************************
 * chartEngine.tsx
 * Updated example where:
 *  - Panel width = 100% of Canvas
 *  - Panel height is defined in percent (heightPct)
 *  - The last panel always fills up to 100%
 *
 * Re-export barrel: the implementation lives in the sibling modules below, this file
 * keeps the public surface (src/api.tsx re-exports it, the QA stand imports it).
 *************************************************************/
export * from './dataSet.js';
export * from './panels.js';
export * from './renderer.js';
export * from './interaction.js';
export * from './engine.js';
