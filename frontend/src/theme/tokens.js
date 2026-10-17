/**
 * Asomi design tokens - THE SINGLE SOURCE OF TRUTH.
 *
 * Transcribed from project_planning/docs/13-design-and-brand.md (rebranded
 * 2026-10-15). If that doc changes, change this file and nothing else.
 *
 * WHY THIS IS PLAIN JAVASCRIPT
 * Two consumers need these values: `tailwind.config.js`, which is CommonJS and
 * is read by Metro before any TypeScript exists, and `src/theme/index.ts`,
 * which wraps them in types for StyleSheet use. If each kept its own copy, the
 * palette would drift - Tailwind classes rendering one teal and StyleSheet
 * another, with nothing to catch it. One .js file both can require removes that
 * failure mode entirely.
 *
 * It also means NativeWind is a *consumer* of the tokens, not their owner. If
 * NativeWind ever has to go, every value here survives untouched.
 *
 * Doc token -> Tailwind key mapping (kept explicit so it stays auditable):
 *   bg/base            -> base        bg-base
 *   bg/surface         -> surface     bg-surface
 *   bg/elevated        -> elevated    bg-elevated
 *   border/subtle      -> subtle      border-subtle
 *   text/primary       -> ivory       text-ivory
 *   text/muted         -> muted       text-muted
 *   brand/signal       -> signal      bg-signal
 *   brand/signal-light -> signal.light  text-signal-light
 *   brand/gold         -> gold        text-gold
 *   status/success     -> success
 *   status/warning     -> warning
 *   status/danger      -> danger
 */

/** The 12 color tokens. Asomi is dark-only; there is no light palette. */
const colors = {
  // Surfaces, darkest to lightest.
  base: '#0A0B12', // Midnight - screen background
  surface: '#11131E', // cards, sheets, tab bar
  elevated: '#191B29', // chips, secondary buttons
  subtle: '#262A3D', // borders and dividers

  // Text.
  ivory: '#F3EFE6', // main text
  muted: '#9A9DB0', // secondary text

  // Brand.
  signal: {
    DEFAULT: '#3DD6C4', // primary buttons, orb core, active tab
    light: '#8BEAE0', // links, highlights
  },
  gold: '#F2B84B', // Pro and offers

  // Status. Never used alone - the doc requires a word alongside the color.
  success: '#34D399', // done
  warning: '#FBBF24', // needs your check
  danger: '#F87171', // failed, listening dot
};

/**
 * Text on a solid teal button is dark, not white - the doc is explicit about
 * this, and teal is far too light to carry Ivory text at any size.
 *
 * Use this token (via the typed theme) rather than a `text-base` class: because
 * Tailwind resolves `text-*` against fontSize as well as colors, and `base` is
 * a built-in font SIZE, `text-base` would set 16px type instead of a color.
 */
const onSignal = colors.base;

/** Brand gradient, for progress and highlights only. */
const gradient = {
  brand: [colors.signal.DEFAULT, colors.signal.light],
};

/**
 * Corner radii. These are deliberately large and deliberately distinct per
 * surface type - mixing them is the fastest way to make the app look generic.
 */
const radius = {
  screen: 36,
  card: 20,
  input: 16,
  pill: 999,
};

/**
 * Spacing. The doc asks for a 4-point grid, which is exactly Tailwind's default
 * numeric scale (p-1 = 4px, p-2 = 8px, p-5 = 20px), so the scale is NOT
 * overridden - only the one named value the doc calls out is added.
 */
const spacing = {
  screenPadding: 20, // screen side padding
};

/**
 * Type scale as [fontSize, lineHeight] in px, matching Tailwind's tuple form.
 * Six entries, not seven: Body and Body Strong are both 15/22 and differ only
 * by font family, so they share a size.
 */
const fontSize = {
  display: ['34px', '40px'],
  title: ['22px', '30px'],
  heading: ['17px', '24px'],
  body: ['15px', '22px'],
  label: ['13px', '18px'],
  caption: ['11px', '16px'],
};

/**
 * Font families, named by role rather than by weight so a swap in the brand
 * doesn't require touching every component.
 *
 * These strings must match the export names from @expo-google-fonts/* exactly -
 * see src/theme/fonts.ts, which is the only place they are loaded.
 *
 * NOTE on the `strong` key: it holds DM Sans Medium, but it must NOT be named
 * `medium`. Tailwind resolves `font-*` against both fontFamily and fontWeight,
 * and `font-medium` is already a built-in weight utility - a fontFamily named
 * `medium` would collide with it and resolve unpredictably.
 */
const fontFamily = {
  display: ['Sora_300Light'], // Display - Sora Light
  title: ['Sora_400Regular'], // Title - Sora Regular
  heading: ['DMSans_600SemiBold'], // Heading - DM Sans SemiBold
  body: ['DMSans_400Regular'], // Body - DM Sans Regular
  strong: ['DMSans_500Medium'], // Body Strong, Label, Caption - DM Sans Medium
};

module.exports = {
  colors,
  onSignal,
  gradient,
  radius,
  spacing,
  fontSize,
  fontFamily,
};
