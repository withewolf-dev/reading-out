import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ReaderView } from '../../../modules/speech-engine/src/ReaderView';
import { mark, sinceStart } from '@/lib/perf';

/**
 * Cover, title and a loading indicator while the book is read off the bundle;
 * the native ReaderView takes the screen the moment the text lands.
 *
 * Everything the screen needs arrives as route params, so the first frame draws
 * with no lookup and no storage — only the text is fetched, and that is the one
 * thing that cannot be carried in a URL.
 */
export default function ReaderScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    cover?: string;
    text?: string;
    bodyOffset?: string;
  }>();

  // Params are serialised, so asset handles arrive as strings; the asset
  // registry still resolves them once they are numbers again.
  const cover = params.cover ? Number(params.cover) : null;
  const textAsset = params.text ? Number(params.text) : null;
  const startOffset = params.bodyOffset ? Number(params.bodyOffset) : 0;

  const [text, setText] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const logged = useRef(false);
  if (!logged.current) {
    logged.current = true;
    mark(`reader first render (${params.id})`);
  }

  useEffect(() => {
    if (textAsset == null || !Number.isFinite(textAsset)) return;
    let cancelled = false;

    (async () => {
      try {
        // The cover resolves to a file:// path first — the native view derives
        // the page tint from it, and it is far smaller than the book.
        if (cover != null && Number.isFinite(cover)) {
          const art = Asset.fromModule(cover);
          if (!art.localUri) await art.downloadAsync();
          if (!cancelled) setCoverPath(art.localUri ?? art.uri);
        }

        const asset = Asset.fromModule(textAsset);
        if (!asset.localUri) await asset.downloadAsync();
        const body = await new File(asset.localUri ?? asset.uri).text();
        if (cancelled) return;

        mark(`text loaded (${body.length} chars)`);
        setText(body);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cover, textAsset]);

  if (text != null) {
    return (
      <ReaderView
        style={styles.reader}
        text={text}
        fontSize={19}
        active={false}
        startOffset={startOffset}
        hue={210}
        coverPath={coverPath}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.middle}>
        {cover != null && Number.isFinite(cover) ? (
          <Image source={cover} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.coverEmpty]} />
        )}
        <Text style={styles.title}>{params.title ?? params.id}</Text>
      </View>

      <View style={styles.footer}>
        {failed ? (
          <Text style={styles.loading}>This book could not be opened.</Text>
        ) : (
          <>
            <ActivityIndicator color="#8A8A8E" />
            <Text style={styles.loading}>Loading the book…</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  reader: { flex: 1 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  cover: { width: 210, height: 305, borderRadius: 10, backgroundColor: '#E5E5EA' },
  coverEmpty: { backgroundColor: '#D1D1D6' },
  title: { marginTop: 28, fontSize: 22, fontWeight: '600', color: '#000000', textAlign: 'center' },
  footer: { alignItems: 'center', gap: 10, paddingBottom: 56 },
  loading: { fontSize: 14, color: '#8A8A8E' },
});
