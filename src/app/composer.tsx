import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { insertReading } from '@/db';
import { normalize } from '@/lib/import';
import { countWords, groupThousands, inferTitle, makeSnippet } from '@/lib/text';
import { Colors, Fonts, Reader, Screen, Space } from '@/theme';

export default function ComposerScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();

  async function save() {
    if (trimmed.length === 0) return;
    const text = normalize(draft);
    const id = await insertReading(
      db,
      { title: inferTitle(text), text },
      { charCount: text.length, wordCount: countWords(text), snippet: makeSnippet(text) }
    );
    router.dismissTo(`/reader/${id}`);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={60}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={styles.action}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} hitSlop={10} disabled={trimmed.length === 0}>
              <Text style={[styles.action, styles.save, trimmed.length === 0 && styles.disabled]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        autoFocus
        placeholder="Paste anything here."
        placeholderTextColor={Colors.faint}
        style={styles.input}
        keyboardAppearance="dark"
        textAlignVertical="top"
      />
      <Text style={styles.hint}>
        {trimmed.length === 0
          ? 'The first line becomes the title.'
          : `${groupThousands(countWords(trimmed))} words · “${inferTitle(draft)}”`}
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ground, padding: Screen.margin, gap: Space.m },
  input: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: Reader.defaultFontSize,
    lineHeight: Reader.defaultFontSize * (1 + Reader.lineSpacing),
    color: Colors.primary,
  },
  hint: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.inactive, paddingBottom: Space.s },
  action: { fontFamily: Fonts.sans, fontSize: 17, color: Colors.accent },
  save: { fontWeight: '600' },
  disabled: { color: Colors.faint },
});
