import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../context/CartContext';

const PINK = '#e83e8c';
const TEXT = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e5e7eb';
const SOFT = '#f9e3ee';

export default function CartScreen() {
  const { items, updateQty, remove, clearCart, total } = useCart();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const amount = useMemo(() => Number(total || 0), [total]);

  const onCheckout = () => {
    if (!items.length) {
      Alert.alert('Cart is empty', 'Please add some items from the Live Menu first.');
      return;
    }
    navigation.navigate('Checkout');
  };

  const renderItem = ({ item }) => (
    <View style={styles.line}>
      {/* Icon circle with initials */}
      <View style={styles.thumb}>
        <Text style={styles.thumbTxt}>{initials(item.name)}</Text>
      </View>

      {/* Name + price */}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.muted}>R {(item.price || 0).toFixed(2)} ea</Text>
      </View>

      {/* Qty controls */}
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, Math.max(1, (item.qty || 1) - 1))}>
          <Text style={styles.qtyBtnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyVal}>{item.qty || 1}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, (item.qty || 1) + 1)}>
          <Text style={styles.qtyBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Line total + remove */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.lineTotal}>R {((item.qty || 1) * (item.price || 0)).toFixed(2)}</Text>
        <TouchableOpacity onPress={() => remove(item.id)} style={styles.remove}>
          <Text style={styles.removeTxt}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <Text style={styles.h1}>Your Cart</Text>
        <Text style={styles.sub}>{items.length ? `${items.length} item${items.length > 1 ? 's' : ''}` : 'No items yet'}</Text>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>Browse the live menu to add something tasty.</Text>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => navigation.navigate('MenuFull')}>
              <Text style={[styles.btnGhostTxt]}>Go to Live Menu</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Sticky footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 10, 16) }]}>
        <View style={styles.sumRow}>
          <Text style={styles.totalLbl}>Total</Text>
          <Text style={styles.totalVal}>R {amount.toFixed(2)}</Text>
        </View>
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost, { flex: 1 }]}
            onPress={() => {
              if (!items.length) return;
              Alert.alert('Clear cart?', 'This will remove all items.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clearCart },
              ]);
            }}
            disabled={!items.length}
          >
            <Text style={[styles.btnGhostTxt, !items.length && { opacity: 0.5 }]}>Clear</Text>
          </TouchableOpacity>
          <View style={{ width: 10 }} />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
            onPress={onCheckout}
            disabled={!items.length}
          >
            <Text style={styles.btnPrimaryTxt}>Proceed to checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function initials(name = '') {
  const parts = name.split(' ').filter(Boolean);
  return (parts[0]?.[0] || 'F').toUpperCase();
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },

  headerCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1, borderColor: '#f3d1de',
    backgroundColor: '#fff',
  },
  h1: { fontSize: 18, fontWeight: '900', color: PINK },
  sub: { color: MUTED, marginTop: 4 },

  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  thumb: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: SOFT, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#f3d1de'
  },
  thumbTxt: { color: PINK, fontWeight: '900' },
  name: { color: TEXT, fontWeight: '900', maxWidth: 160 },
  muted: { color: MUTED, marginTop: 2 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt: { color: TEXT, fontWeight: '900', fontSize: 16 },
  qtyVal: { minWidth: 20, textAlign: 'center', color: TEXT, fontWeight: '900' },

  lineTotal: { color: TEXT, fontWeight: '900' },
  remove: { marginTop: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: LINE },
  removeTxt: { color: '#ef4444', fontWeight: '900' },

  empty: { alignItems: 'center', padding: 24, marginTop: 20, borderWidth: 1, borderColor: LINE, borderRadius: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: TEXT },
  emptyText: { color: MUTED, marginTop: 6 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, marginTop: 12, paddingHorizontal: 16 },
  btnGhostTxt: { color: TEXT, fontWeight: '900' },
  btnPrimary: { backgroundColor: PINK, paddingHorizontal: 18 },
  btnPrimaryTxt: { color: '#fff', fontWeight: '900' },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingHorizontal: 16, paddingTop: 12,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLbl: { color: TEXT, fontWeight: '900' },
  totalVal: { color: TEXT, fontWeight: '900', fontSize: 18 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
});
