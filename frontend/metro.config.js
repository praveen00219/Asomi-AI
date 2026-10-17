const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * Metro config.
 *
 * `withNativeWind` compiles global.css through Tailwind and injects the result
 * into the bundle. The `input` path must point at the file holding the
 * @tailwind directives, or no utility classes are generated.
 */
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
