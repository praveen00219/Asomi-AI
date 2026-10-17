import { useFonts } from 'expo-font';
import { Sora_300Light, Sora_400Regular } from '@expo-google-fonts/sora';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';

/**
 * Font loading, isolated to one file.
 *
 * Five faces cover all seven text styles in docs/13-design-and-brand.md:
 * Sora Light and Regular for Display and Title, DM Sans Regular / Medium /
 * SemiBold for everything else. Loading more than the app uses costs startup
 * time for nothing, so this list stays minimal.
 *
 * The keys MUST match the fontFamily strings in tokens.js. Keeping both the
 * imports and the key names here means a mismatch is a one-line fix in a single
 * file rather than a hunt through components - and it shows up as a TypeScript
 * error the moment dependencies are installed, not as invisibly-wrong rendering
 * at runtime.
 */
export function useAsomiFonts(): { loaded: boolean; error: Error | null } {
  const [loaded, error] = useFonts({
    Sora_300Light,
    Sora_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  return { loaded, error: error ?? null };
}
