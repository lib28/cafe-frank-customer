// File: src/screens/ItemScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useCart } from '../context/CartContext';
import { BASE_URL } from '../config/api';

export default function ItemScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  // You can navigate here with either { item } or { id }
  const initialItem = route?.params?.item || null;
  const itemId = route?.params?.id || initialItem?.id;

  const [item, setItem] = useState(initialItem);
  const [loading, setLoading] = useState(!initialItem);
  const [qty, setQty] = useState(1);
  const { add } = useCart();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (item || !itemId) return;
      try {
        setLoading(true);
        const r = await fetch(`${BASE_URL}/menu/items/${encodeURIComponent(itemId)}`);
        if (!r.ok) throw new Error(`Item fetch failed: ${r.status}`);
        const data = await r.json();
        if (!cancelled) setItem(data);
      } catch (e) {
        console.log('[ItemScreen] fetch error', e);
        if (!cancelled) Alert.alert('Error', 'Could not load item.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [itemId]);

  const price = useMemo(() => Number(item?.price || 0), [item]);
  const total = useMemo(() => (price * qty).toFixed(2), [price, qty]);

  const handleAdd = () => {
    if (!item) return;
    add({ id: item.id, name: item.name, price: price, image: item.image }, qty);
    Alert.alert('Added to cart', `${qty} × ${item.name}`, [
      { text: 'Keep browsing', onPress: () => navigation.goBack() },
      { text: 'Go to cart', onPress: () => navigation.navigate('Cart') },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: '#64748b' }}>Loading item…</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#ef4444', fontWeight: '700' }}>Item not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]}><Text style={{ color: '#94a3b8', fontWeight: '800' }}>CF</Text></View>
      )}

      <Text style={styles.title}>{item.name}</Text>
      {!!item.desc && <Text style={styles.desc}>{item.desc}</Text>}

      <View style={styles.priceRow}>
        <Text style={styles.price}>R {price.toFixed(2)}</Text>

        <View style={styles.qtyWrap}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qty}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
        <Text style={styles.addBtnText}>Add to cart • R {total}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Cart')}>
        <Text style={styles.secondaryBtnText}>Go to cart</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  hero: { width: '100%', height: 220, borderRadius: 14, backgroundColor: '#f1f5f9' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 12, fontSize: 22, fontWeight: '900', color: '#0f172a' },
  desc: { marginTop: 6, color: '#334155' },

  priceRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 20, fontWeight: '900', color: '#0f172a' },

  qtyWrap: {
    flexDirection: 'row', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, alignItems: 'center', overflow: 'hidden'
  },
  qtyBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f8fafc' },
  qtyBtnText: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  qty: { minWidth: 30, textAlign: 'center', fontWeight: '800', color: '#0f172a' },

  addBtn: {
    marginTop: 14, backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 12, alignItems: 'center'
  },
  addBtnText: { color: '#fff', fontWeight: '900' },

  secondaryBtn: {
    marginTop: 10, backgroundColor: '#e2e8f0', paddingVertical: 12, borderRadius: 10, alignItems: 'center'
  },
  secondaryBtnText: { color: '#0f172a', fontWeight: '800' },
});
