// jest.config.ts
import type { Config } from 'jest'

const jestConfig: Config = {
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
  moduleNameMapper: {'^(\\.{1,2}/.*)\\.js$': '$1'},
}

export default jestConfig
