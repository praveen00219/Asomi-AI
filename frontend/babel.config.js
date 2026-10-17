/**
 * Babel config.
 *
 * Two things are load-bearing here:
 *
 * 1. `jsxImportSource: 'nativewind'` - this is what lets `className` work on
 *    React Native components at all. Without it NativeWind silently does
 *    nothing: styles just never apply, with no error to explain why.
 *
 * 2. `react-native-worklets/plugin` must be LAST in the plugin list. Reanimated
 *    4 moved its Babel plugin into react-native-worklets, so the old
 *    `react-native-reanimated/plugin` entry you may see in older guides is
 *    wrong for this version and will fail to resolve.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
