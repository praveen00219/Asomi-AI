import type { TextStyle } from 'react-native';
import tokens from './tokens';

/**
 * Typed theme for StyleSheet use.
 *
 * The values come from tokens.js (the single source of truth, also read by
 * tailwind.config.js). This file adds the types and composes the seven named
 * text styles from the design doc's table.
 *
 * Use Tailwind classes for layout and one-off styling; reach for these objects
 * when a value has to be computed, animated, or passed to a native prop that
 * className cannot reach (Reanimated styles, gradient color arrays, StatusBar).
 */

export interface AsomiColors {
  base: string;
  surface: string;
  elevated: string;
  subtle: string;
  ivory: string;
  muted: string;
  signal: { DEFAULT: string; light: string };
  gold: string;
  success: string;
  warning: string;
  danger: string;
}

export const colors: AsomiColors = tokens.colors;

/** Text color for content sitting on solid signal teal. Dark, never Ivory. */
export const onSignal: string = tokens.onSignal;

/** Brand gradient stops, ready for expo-linear-gradient's `colors` prop. */
export const gradient: { brand: readonly [string, string] } = {
  brand: [colors.signal.DEFAULT, colors.signal.light] as const,
};

export interface AsomiRadius {
  screen: number;
  card: number;
  input: number;
  pill: number;
}

export const radius: AsomiRadius = tokens.radius;

/**
 * 4-point spacing helper. `space(5)` is 20px, the screen side padding.
 * Prefer Tailwind's `p-5` / `gap-4` in markup; this is for computed values.
 */
export const space = (steps: number): number => steps * 4;

export const screenPadding: number = tokens.spacing.screenPadding;

/** The seven text styles from docs/13-design-and-brand.md, verbatim. */
export type TypographyStyle =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption';

const px = (value: string): number => Number.parseInt(value, 10);

function style(
  family: readonly string[],
  size: readonly [string, string]
): TextStyle {
  return {
    fontFamily: family[0],
    fontSize: px(size[0]),
    lineHeight: px(size[1]),
  };
}

const f = tokens.fontFamily;
const s = tokens.fontSize;

export const typography: Record<TypographyStyle, TextStyle> = {
  display: style(f.display, s.display), // Sora Light 34/40
  title: style(f.title, s.title), // Sora Regular 22/30
  heading: style(f.heading, s.heading), // DM Sans SemiBold 17/24
  body: style(f.body, s.body), // DM Sans Regular 15/22
  bodyStrong: style(f.strong, s.body), // DM Sans Medium 15/22
  label: style(f.strong, s.label), // DM Sans Medium 13/18
  caption: style(f.strong, s.caption), // DM Sans Medium 11/16
};

/**
 * Status colors paired with the word that must always accompany them.
 *
 * The design doc is firm about this: "Never color alone: always a word too."
 * Pairing them here means a component cannot show the amber dot without also
 * having the label to render next to it.
 */
export const statusMeaning = {
  done: { color: colors.success, label: 'Done' },
  check: { color: colors.warning, label: 'Needs your check' },
  failed: { color: colors.danger, label: 'Failed' },
} as const;

export type StatusKey = keyof typeof statusMeaning;
