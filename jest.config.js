const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  // Router's CommonJS decoder adapter delegates to this patched ESM package.
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('/node_modules/(?!(', '/node_modules/(?!(decode-uri-component-patched|'),
  ),
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
};
