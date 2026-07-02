// jest.config.ts
import { createDefaultPreset, type JestConfigWithTsJest } from 'ts-jest'

const presetConfig = createDefaultPreset({
  // compiler: "ttypescript"
  //...options
})

const jestConfig: JestConfigWithTsJest = {
  ...presetConfig,
  verbose: true,
  testEnvironment: 'jsdom',
  // fakeTimers: {legacyFakeTimers: true},
  rootDir: './__test',
  // roots: ['<rootDir>/__test'],
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$', // selected folders and files for tests
  // testRegex: '^.+\\test\\.(t|j)sx?$', // Pattern for finding test files
  testRegex: '^.+.(t|j)sx?$', // Pattern for finding test files
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}

export default jestConfig
