const expoConfig = require('eslint-config-expo/flat');

/**
 * ESLint config, matching the backend's flat-config setup.
 *
 * eslint-config-expo already covers React, React Hooks, React Native and the
 * Expo Router conventions, so this only adds the few project rules.
 */
module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**', 'expo-env.d.ts'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
];
