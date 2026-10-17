import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, onSignal, statusMeaning, type StatusKey } from '@/theme';

/**
 * Theme proof sheet - a scaffold screen, not the real Home.
 *
 * Home (screen 03 "Home - Ready" with the mic orb and suggestion chips) is
 * Phase 6, step 38. This screen exists so the design system from
 * docs/13-design-and-brand.md can be checked the first time the app runs on a
 * device: every color token, all seven text styles, and each corner radius are
 * on screen at once. If NativeWind is misconfigured, this page renders as
 * unstyled black-on-white and says so immediately rather than failing subtly
 * three phases later.
 *
 * Delete it when step 38 lands.
 */

const SWATCHES: Array<{ name: string; className: string; hex: string }> = [
  { name: 'bg/base', className: 'bg-base', hex: colors.base },
  { name: 'bg/surface', className: 'bg-surface', hex: colors.surface },
  { name: 'bg/elevated', className: 'bg-elevated', hex: colors.elevated },
  { name: 'border/subtle', className: 'bg-subtle', hex: colors.subtle },
  { name: 'text/primary', className: 'bg-ivory', hex: colors.ivory },
  { name: 'text/muted', className: 'bg-muted', hex: colors.muted },
  { name: 'brand/signal', className: 'bg-signal', hex: colors.signal.DEFAULT },
  { name: 'brand/signal-light', className: 'bg-signal-light', hex: colors.signal.light },
  { name: 'brand/gold', className: 'bg-gold', hex: colors.gold },
  { name: 'status/success', className: 'bg-success', hex: colors.success },
  { name: 'status/warning', className: 'bg-warning', hex: colors.warning },
  { name: 'status/danger', className: 'bg-danger', hex: colors.danger },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-8">
      <Text className="font-strong text-caption uppercase text-muted tracking-widest">
        {title}
      </Text>
      <View className="mt-3">{children}</View>
    </View>
  );
}

export default function ThemeProof() {
  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-screen pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Wordmark and hero line, in the brand's own type. */}
        <View className="mt-6">
          <Text className="font-display text-display text-ivory">Asomi</Text>
          <Text className="mt-1 font-body text-body text-signal">Your voice, in action.</Text>
          <Text className="mt-4 font-title text-title text-ivory">
            Just say it. Consider it done.
          </Text>
        </View>

        <Section title="Type scale">
          <Text className="font-display text-display text-ivory">Display · Sora Light 34</Text>
          <Text className="mt-2 font-title text-title text-ivory">Title · Sora Regular 22</Text>
          <Text className="mt-2 font-heading text-heading text-ivory">
            Heading · DM Sans SemiBold 17
          </Text>
          <Text className="mt-2 font-body text-body text-ivory">Body · DM Sans Regular 15</Text>
          <Text className="mt-2 font-strong text-body text-ivory">
            Body Strong · DM Sans Medium 15
          </Text>
          <Text className="mt-2 font-strong text-label text-muted">Label · DM Sans Medium 13</Text>
          <Text className="mt-2 font-strong text-caption text-muted">
            Caption · DM Sans Medium 11
          </Text>
        </Section>

        <Section title="Colors">
          <View className="flex-row flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <View
                key={swatch.name}
                className="overflow-hidden rounded-input border border-subtle bg-surface"
                style={{ width: '48%' }}
              >
                <View className={`h-12 w-full ${swatch.className}`} />
                <View className="p-3">
                  <Text className="font-strong text-label text-ivory">{swatch.name}</Text>
                  <Text className="font-strong text-caption text-muted">{swatch.hex}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Surfaces and radii">
          <View className="rounded-card border border-subtle bg-surface p-4">
            <Text className="font-heading text-heading text-ivory">Card · radius 20</Text>
            <Text className="mt-1 font-body text-body text-muted">
              bg/surface on bg/base, with a border/subtle hairline.
            </Text>
            <View className="mt-3 flex-row gap-2">
              <View className="rounded-pill bg-elevated px-4 py-2">
                <Text className="font-strong text-label text-ivory">Chip · pill</Text>
              </View>
              <View className="rounded-pill bg-elevated px-4 py-2">
                <Text className="font-strong text-label text-ivory">Try saying…</Text>
              </View>
            </View>
          </View>
        </Section>

        <Section title="One teal action per screen">
          {/*
            Dark text on teal, per the design doc - Ivory here would fail
            contrast. The color comes from the `onSignal` token via style rather
            than a class: `text-base` would resolve to Tailwind's built-in 16px
            font SIZE, not the Midnight color.
          */}
          <View className="items-center rounded-input bg-signal px-5 py-4">
            <Text className="font-heading text-heading" style={{ color: onSignal }}>
              Confirm
            </Text>
          </View>
          <View className="mt-2 items-center rounded-input border border-subtle bg-elevated px-5 py-4">
            <Text className="font-heading text-heading text-ivory">Cancel</Text>
          </View>
        </Section>

        <Section title="Status · never color alone">
          {(Object.keys(statusMeaning) as StatusKey[]).map((key) => (
            <View key={key} className="mt-2 flex-row items-center gap-3">
              <View
                className="h-2.5 w-2.5 rounded-pill"
                style={{ backgroundColor: statusMeaning[key].color }}
              />
              <Text className="font-body text-body text-ivory">{statusMeaning[key].label}</Text>
            </View>
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
