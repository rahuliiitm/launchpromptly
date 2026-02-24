import type { Config } from 'jest';
import path from 'path';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  setupFiles: ['reflect-metadata'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      tsconfig: path.resolve(__dirname, 'tsconfig.json'),
      isolatedModules: false,
    }],
  },
  collectCoverageFrom: ['**/*.ts', '!main.ts', '!**/*.spec.ts', '!**/*.module.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
