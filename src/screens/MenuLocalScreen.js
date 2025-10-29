// File: src/screens/MenuLocalScreen.js
import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchMenu } from '../api/menu';
import { useCart } from '../context/CartContext';

export default function MenuLocalScreen() {
  const navigation = useNavigation();
  const { add, items } = useCart();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Header cart button with badge
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <CartButton count={items.reduce((s, it) => s + (it.qty || 1), 0)} onPress={() => navigation.navigate('Cart')} />,
    });
  }, [navigation, items]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const cats = await fetchMenu(); // expects [{id,name,items:[{id,name,price,image,desc}]}]
      const mapped = (cats || []).map(c => ({
        key: c.id,
        title: c.name,
        data: c.items || [],
      }));
      setSections(mapped);
    } catch (e) {
      console.log('[MenuLocalScreen] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImg} />
      ) : (
        <View style={[styles.cardImg, styles.cardImgPlaceholder]}><Text style={{ color: '#94a3b8', fontWeight: '800' }}>CF</Text></View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
        {!!item.desc && <Text style={styles.cardDesc} numberOfLines={2}>{item.desc}</Text>}
        <Text style={styles.cardPrice}>R {Number(item.price || 0).toFixed(2)}</Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate('Item', { item })}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => add({ id: item.id, name: item.name, price: Number(item.price || 0), image: item.image }, 1)}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: '#64748b' }}>Loading menu…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', marginTop: 24 }}>No items available.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

function CartButton({ count, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <View style={{ position: 'relative' }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a' }}>🛒</Text>
        {!!count && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  sectionHeader: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },

  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardImg: { width: 90, height: 70, borderRadius: 10, backgroundColor: '#f1f5f9' },
  cardImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  cardDesc: { color: '#475569', marginTop: 2 },
  cardPrice: { marginTop: 6, fontWeight: '900', color: '#0f172a' },

  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  viewBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewBtnText: { color: '#0f172a', fontWeight: '800' },
  addBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  addBtnText: { color: '#ffffff', fontWeight: '800' },

  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
