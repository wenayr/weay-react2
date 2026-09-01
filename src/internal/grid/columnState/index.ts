// State-only barrel: createColumnState must stay importable without ag-grid runtime AND
// without the DOM renderers (mobile/card consumers, headless tests). The React views
// (ColumnsMenu / ColumnDots / CardList) ship from './ui', createColumnGrid (ag-grid runtime +
// Toolbar) from './columnGrid'; the root api re-exports all three.
export * from './columnState.js'
