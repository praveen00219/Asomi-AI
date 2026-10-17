const tokens = require('./src/theme/tokens');

/**
 * Tailwind config for NativeWind.
 *
 * Every value is required from src/theme/tokens.js rather than written here, so
 * Tailwind classes and StyleSheet objects can never disagree about what
 * "signal teal" means. Add new tokens there, not in this file.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      borderRadius: {
        screen: `${tokens.radius.screen}px`,
        card: `${tokens.radius.card}px`,
        input: `${tokens.radius.input}px`,
        pill: `${tokens.radius.pill}px`,
      },
      // Tailwind's default numeric scale is already the 4-point grid the design
      // doc asks for, so it is extended rather than replaced - only the named
      // screen-padding value is added.
      spacing: {
        screen: `${tokens.spacing.screenPadding}px`,
      },
    },
  },
  plugins: [],
};
