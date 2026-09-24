/** @type {import('jest').Config} */
const jestConfig = {
  verbose: true,
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/__test/setup.ts'],
  // fakeTimers: {legacyFakeTimers: true},
  rootDir: '.',
  roots: ['<rootDir>/__test'],
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$', // selected folders and files for tests
  // testRegex: '^.+\\test\\.(t|j)sx?$', // Pattern for finding test files
  testRegex: '^.+\\.test\\.(t|j)sx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '\\.css$': '<rootDir>/__test/cssStub.js',
    // packages/wenay-calls resolves by its public name, straight from source
    '^wenay-calls$': '<rootDir>/packages/wenay-calls/src/index.ts',
    '^wenay-calls/styles$': '<rootDir>/__test/cssStub.js',
    '^wenay-calls/demo/peer-media$': '<rootDir>/packages/wenay-calls/src/demo/peerMedia.tsx',
    '^wenay-calls/demo/peer-conference$': '<rootDir>/packages/wenay-calls/src/demo/peerConference.tsx',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['@swc/jest', {
      jsc: {
        parser: {syntax: 'typescript', tsx: true},
        transform: {react: {runtime: 'automatic'}},
      },
      module: {type: 'commonjs'},
    }],
  },
}

module.exports = jestConfig
