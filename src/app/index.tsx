import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATALOG } from '@/lib/catalog';
import { mark, markStart } from '@/lib/perf';

/**
 * A plain list of the 50 catalogue titles. No images, no gradients, no theme,
 * no horizontal shelves, no components — one `Text` per row. If tapping is fast
 * here but slow on the real library, the cost was in drawing those cards, not
 * in navigating.
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
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.author} · {item.minutes} min
          </Text>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.rule} />}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 17, color: '#000000' },
  meta: { fontSize: 13, color: '#8A8A8E', marginTop: 2 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#D1D1D6', marginLeft: 20 },
});
