import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SpeechVoice } from '../../modules/speech-engine/src/SpeechEngine.types';
import { putSetting } from '@/db';
import { listVoices, prefs, previewVoice, RATE, usePrefs, type Prefs } from '@/speech/engine';
import { Colors, Fonts, Reader, Screen, Space } from '@/theme';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const PREVIEW = 'This is how the voice will sound while it reads to you.';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const current = usePrefs();
  const [voices, setVoices] = useState<SpeechVoice[]>([]);

  useEffect(() => {
    listVoices().then(setVoices).catch(() => setVoices([]));
  }, []);

  function update(next: Partial<Prefs>) {
    prefs.set(next);
    for (const [key, value] of Object.entries(next)) {
      putSetting(db, key, String(value)).catch(() => {});
    }
  }

  const multiplier = Math.round((current.rate / RATE.default) * 100) / 100;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Speed">
        <View style={styles.chips}>
          {SPEEDS.map((speed) => (
            <Chip
              key={speed}
              label={`${speed}×`}
              selected={Math.abs(multiplier - speed) < 0.01}
              onPress={() =>
                update({
                  rate: Math.min(RATE.max, Math.max(RATE.min, speed * RATE.default)),
                })
              }
            />
          ))}
        </View>
      </Section>

      <Section title="Text size">
        <View style={styles.row}>
          <Stepper
            label="Smaller"
            symbol="−"
            onPress={() => update({ fontSize: Math.max(Reader.minFontSize, current.fontSize - 1) })}
          />
          <Text style={[styles.sample, { fontSize: current.fontSize }]}>{current.fontSize}pt</Text>
          <Stepper
            label="Bigger"
            symbol="+"
            onPress={() => update({ fontSize: Math.min(Reader.maxFontSize, current.fontSize + 1) })}
          />
        </View>
      </Section>

      <Section title="Voice">
        <Pressable style={styles.previewButton} onPress={() => previewVoice(current.voice, PREVIEW)}>
          <Text style={styles.previewLabel}>Hear it</Text>
        </Pressable>
        <VoiceRow
          name="System default"
          detail="Whatever iOS is set to"
          selected={current.voice == null}
          onPress={() => {
            update({ voice: null });
            previewVoice(null, PREVIEW);
          }}
        />
        {voices.map((voice) => (
          <VoiceRow
            key={voice.identifier}
            name={voice.name}
            detail={`${voice.language}${voice.quality === 'enhanced' ? ' · Enhanced' : ''}`}
            selected={current.voice === voice.identifier}
            onPress={() => {
              update({ voice: voice.identifier });
              previewVoice(voice.identifier, PREVIEW);
            }}
          />
        ))}
        <Text style={styles.footnote}>
          Better voices live in iOS Settings → Accessibility → Spoken Content → Voices. Download one
          there and it shows up here.
        </Text>
      </Section>

      <Section title="About">
        <Text style={styles.footnote}>
          ReadingLoud {Constants.expoConfig?.version ?? '1.0.0'}
          {'\n'}Everything stays on this device. No account, no network, no analytics.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ label, symbol, onPress }: { label: string; symbol: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.stepper}>
      <Text style={styles.stepperLabel}>{symbol}</Text>
    </Pressable>
  );
}

function VoiceRow({
  name,
  detail,
  selected,
  onPress,
}: {
  name: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.voiceRow} accessibilityRole="button" accessibilityState={{ selected }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.voiceName}>{name}</Text>
        <Text style={styles.voiceDetail}>{detail}</Text>
      </View>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ground },
  content: { padding: Screen.margin, paddingBottom: 48, gap: Space.xl },
  section: { gap: Space.m },
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.s },
  chip: {
    paddingHorizontal: Space.ms,
    paddingVertical: Space.s,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.stroke,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipLabel: { fontFamily: Fonts.sans, fontSize: 15, color: Colors.secondary },
  chipLabelSelected: { color: Colors.ground, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.l },
  sample: { fontFamily: Fonts.serif, color: Colors.primary, flex: 1, textAlign: 'center' },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stepperLabel: { fontFamily: Fonts.sans, fontSize: 22, color: Colors.primary },
  previewButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Space.l,
    paddingVertical: Space.s,
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  previewLabel: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: '600', color: Colors.primary },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.stroke,
  },
  voiceName: { fontFamily: Fonts.sans, fontSize: 16, color: Colors.primary },
  voiceDetail: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.inactive, marginTop: 2 },
  check: { color: Colors.accent, fontSize: 17 },
  footnote: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, color: Colors.inactive },
});
