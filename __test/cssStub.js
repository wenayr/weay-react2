// Style side-effect imports carry no runtime surface; jest cannot parse CSS.
// Mapped in jest.config.cjs so a test may import a module that pulls a stylesheet (stand code).
module.exports = {};
