import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SpeechVoice } from '../../modules/speech-engine/src/SpeechEngine.types';
import { putSetting } from '@/db';
import { prefs, previewVoice, RATE, usePrefs, type Prefs } from '@/speech/engine';
import { Colors, Fonts, Radius, Reader, Screen, Space } from '@/theme';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const PREVIEW = 'This is how the voice will sound while it reads to you.';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const current = usePrefs();
  // Fetching the installed voices needed an effect, and there are no effects
  // left in this app, so the list stays empty. Rate, pitch and font size are
  // unaffected.
  const voices: SpeechVoice[] = [];

  function update(next: Partial<Prefs>) {
    prefs.set(next);
    for (const [key, value] of Object.entries(next)) {
      putSetting(db, key, String(value)).catch(() => {});
    }
  }

  const multiplier = Math.round((current.rate / RATE.default) * 100) / 100;

  /**
   * The good voices first. iOS ships a long tail of compact and novelty voices
   * ("Bad News", "Bubbles"), and burying Enhanced ones under them is why people
   * think the app sounds cheap (§POC critique 10).
   */
  const { better, standard, novelty } = useMemo(() => {
    const rank = (voice: SpeechVoice) =>
      voice.quality === 'premium' ? 0 : voice.quality === 'enhanced' ? 1 : 2;
    const sorted = [...voices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return {
      better: sorted.filter((v) => !v.isNovelty && v.quality !== 'default'),
      standard: sorted.filter((v) => !v.isNovelty && v.quality === 'default'),
      novelty: sorted.filter((v) => v.isNovelty),
    };
  }, [voices]);

  return (
    /* A form sheet lays out exactly two subviews: a header and the scroll view.
       The header must be `collapsable={false}` or React Native flattens it away
       and the sheet mis-measures the top — which is what buried the first
       section behind the title. */
    <>
      <View style={styles.sheetHeader} collapsable={false}>
        <Text style={styles.sheetTitle}>Voice &amp; Text</Text>
        <Pressable onPress={() => router.back()} hitSlop={14} accessibilityRole="button">
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        <Section title="Speed">
          <View style={styles.chips}>
            {SPEEDS.map((speed) => (
              <Chip
                key={speed}
                label={`${speed}×`}
                selected={Math.abs(multiplier - speed) < 0.01}
                onPress={() =>
                  update({ rate: Math.min(RATE.max, Math.max(RATE.min, speed * RATE.default)) })
                }
              />
            ))}
          </View>
        </Section>

        <Section title="Text size">
          <View style={styles.sizeRow}>
            <Stepper
              label="Smaller"
              symbol="minus"
              disabled={current.fontSize <= Reader.minFontSize}
              onPress={() => update({ fontSize: Math.max(Reader.minFontSize, current.fontSize - 1) })}
            />
            <Text numberOfLines={1} style={[styles.sizeSample, { fontSize: current.fontSize }]}>
              The quick brown fox
            </Text>
            <Stepper
              label="Bigger"
              symbol="plus"
              disabled={current.fontSize >= Reader.maxFontSize}
              onPress={() => update({ fontSize: Math.min(Reader.maxFontSize, current.fontSize + 1) })}
            />
          </View>
        </Section>

        <Section
          title="Voice"
          action={
            <Pressable
              onPress={() => previewVoice(current.voice, PREVIEW)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Hear the current voice">
              <Text style={styles.sectionAction}>Hear it</Text>
            </Pressable>
          }>
          <Group>
            <VoiceRow
              name="System default"
              detail="Whatever iOS is set to"
              selected={current.voice == null}
              first
              last
              onPress={() => {
                update({ voice: null });
                previewVoice(null, PREVIEW);
              }}
            />
          </Group>

          {better.length > 0 ? (
            <>
              <Text style={styles.groupLabel}>Downloaded — the ones worth using</Text>
              <Group>
                {better.map((voice, index) => (
                  <VoiceRow
                    key={voice.identifier}
                    name={voice.name}
                    detail={`${voice.language} · ${voice.quality === 'premium' ? 'Premium' : 'Enhanced'}`}
                    selected={current.voice === voice.identifier}
                    first={index === 0}
                    last={index === better.length - 1}
                    onPress={() => {
                      update({ voice: voice.identifier });
                      previewVoice(voice.identifier, PREVIEW);
                    }}
                  />
                ))}
              </Group>
            </>
          ) : (
            <Text style={styles.footnote}>
              You have no Enhanced voices installed, which is why speech sounds thin. Get one in
              iOS Settings → Accessibility → Spoken Content → Voices, and it appears here.
            </Text>
          )}

          <Text style={styles.groupLabel}>Standard</Text>
          <Group>
            {standard.map((voice, index) => (
              <VoiceRow
                key={voice.identifier}
                name={voice.name}
                detail={voice.language}
                selected={current.voice === voice.identifier}
                first={index === 0}
                last={index === standard.length - 1}
                onPress={() => {
                  update({ voice: voice.identifier });
                  previewVoice(voice.identifier, PREVIEW);
                }}
              />
            ))}
          </Group>
          {novelty.length > 0 ? (
            <>
              <Text style={styles.groupLabel}>Novelty</Text>
              <Group>
                {novelty.map((voice, index) => (
                  <VoiceRow
                    key={voice.identifier}
                    name={voice.name}
                    detail={voice.language}
                    selected={current.voice === voice.identifier}
                    first={index === 0}
                    last={index === novelty.length - 1}
                    onPress={() => {
                      update({ voice: voice.identifier });
                      previewVoice(voice.identifier, PREVIEW);
                    }}
                  />
                ))}
              </Group>
            </>
          ) : null}
        </Section>

        <Section title="About">
          <Text style={styles.footnote}>
            ReadingLoud {Constants.expoConfig?.version ?? '1.0.0'}
            {'\n'}Everything stays on this device. No account, no network, no analytics.
          </Text>
        </Section>
      </ScrollView>
    </>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A grouped-list card, the way iOS Settings shapes a run of rows. */
function Group({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  symbol,
  onPress,
  disabled,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.stepper, disabled && styles.stepperDisabled]}>
      <SymbolView
        name={symbol as never}
        size={18}
        tintColor={disabled ? Colors.faint : Colors.primary}
        fallback={<Text style={styles.stepperFallback}>{symbol === 'plus' ? '+' : '−'}</Text>}
      />
    </Pressable>
  );
}

function VoiceRow({
  name,
  detail,
  selected,
  onPress,
  first,
  last,
}: {
  name: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.voiceRow,
        !last && styles.voiceRowDivider,
        pressed && styles.voiceRowPressed,
      ]}>
      <View style={styles.voiceText}>
        <Text style={styles.voiceName}>{name}</Text>
        <Text style={styles.voiceDetail}>{detail}</Text>
      </View>
      {selected ? (
        <SymbolView
          name="checkmark"
          size={15}
          tintColor={Colors.accent}
          fallback={<Text style={{ color: Colors.accent }}>✓</Text>}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ground },
  list: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.ground,
    paddingHorizontal: Screen.margin,
    paddingTop: 22,
    paddingBottom: Space.m,
  },
  sheetTitle: { fontFamily: Fonts.sans, fontSize: 20, fontWeight: '700', color: Colors.primary },
  content: { paddingHorizontal: Screen.margin, paddingTop: 18, paddingBottom: 56, gap: 28 },
  done: { fontFamily: Fonts.sans, fontSize: 17, fontWeight: '600', color: Colors.accent },

  section: { gap: Space.m },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionAction: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: '600', color: Colors.accent },

  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  groupLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.inactive,
    marginTop: Space.s,
    marginBottom: -Space.xs,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s },
  chip: {
    paddingHorizontal: Space.ms,
    paddingVertical: Space.s,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  chipSelected: { backgroundColor: Colors.primary },
  chipLabel: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.secondary },
  chipLabelSelected: { color: Colors.ground, fontWeight: '600' },

  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.l,
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Space.m,
  },
  sizeSample: { flex: 1, fontFamily: Fonts.serif, color: Colors.primary, textAlign: 'center' },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceStrong,
  },
  stepperDisabled: { opacity: 0.4 },
  stepperFallback: { fontFamily: Fonts.sans, fontSize: 20, color: Colors.primary },

  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.m,
    paddingHorizontal: Space.l,
    minHeight: 56,
  },
  voiceRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.stroke,
  },
  voiceRowPressed: { backgroundColor: Colors.surface },
  voiceText: { flex: 1, gap: 2 },
  voiceName: { fontFamily: Fonts.sans, fontSize: 16, color: Colors.primary },
  voiceDetail: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.inactive },

  footnote: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: Colors.inactive },
});
