import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '@/lib/catalog';
import { mark, markStart } from '@/lib/perf';

/**
 * The plain list, plus each book's cover. Still no gradients, no theme, no
 * horizontal shelves, no components — the only thing added over the 5-14 ms
 * baseline is 50 images being resolved, decoded and drawn.
 */
export default function LibraryScreen() {
  const router = useRouter();

  return (
    <FlatList
      data={CATALOG}
      keyExtractor={(book) => book.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => {
            markStart('tap');
            router.push(`/reader/${item.id}`);
            mark('push returned');
          }}>
          {item.cover != null ? (
            <Image source={item.cover} style={styles.cover} contentFit="cover" />
          ) : (
            // Nine of the fifty have no cover in the bundle.
            <View style={[styles.cover, styles.coverEmpty]} />
          )}
          <View style={styles.text}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.author} · {item.minutes} min
            </Text>
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.rule} />}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  cover: { width: 44, height: 64, borderRadius: 4, backgroundColor: '#E5E5EA' },
  coverEmpty: { backgroundColor: '#D1D1D6' },
  text: { flex: 1 },
  title: { fontSize: 17, color: '#000000' },
  meta: { fontSize: 13, color: '#8A8A8E', marginTop: 2 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#D1D1D6', marginLeft: 76 },
});
