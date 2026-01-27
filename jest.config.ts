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
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$', // выбранные папки и файлы для тестов
  // testRegex: '^.+\\test\\.(t|j)sx?$', // Шаблон для поиска тестовых файлов
  testRegex: '^.+.(t|j)sx?$', // Шаблон для поиска тестовых файлов
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}

export default jestConfig