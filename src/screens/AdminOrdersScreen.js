// File: src/screens/AdminOrdersScreen.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import io from 'socket.io-client';

const BASE_URL = Platform.select({
  ios: 'http://localhost:3000',
  android: 'http://10.0.2.2:3000',
  default: 'http://192.168.1.149:3000',
});

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // In-memory demo has no list endpoint; fetch a few known IDs if you store them
      // For demo, we’ll assume none; show empty until a new order arrives via socket
      setOrders((o) => o); // no-op
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    const socket = io(BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('admin:order_new', (order) => {
      setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
    });
    socket.on('order:status', ({ orderId, status, driver }) => {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status, driver } : o)));
    });

    return () => socket.disconnect();
  }, [load]);

  const markPreparing = (id) => socketRef.current?.emit('order:update', { orderId: id, status: 'preparing' });
  const markOutForDelivery = (id) => socketRef.current?.emit('order:update', { orderId: id, status: 'out_for_delivery' });
  const markDelivered = (id) => socketRef.current?.emit('order:update', { orderId: id, status: 'delivered' });

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.id}>#{item.id.slice(0, 8)}</Text>
        <Text style={styles.status}>{item.status}</Text>
      </View>
      <Text style={styles.amount}>R {Number(item.amount || 0).toFixed(2)}</Text>
      <View style={styles.lines}>
        {(item.lines || []).map((l) => (
          <Text key={l.id} style={styles.lineTxt}>• {l.qty} × {l.name} — R {Number(l.unitPrice).toFixed(2)}</Text>
        ))}
      </View>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => markPreparing(item.id)} style={[styles.btn, styles.idle]}>
          <Text style={styles.btnIdleTxt}>Preparing</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => markOutForDelivery(item.id)} style={[styles.btn, styles.primary]}>
          <Text style={styles.btnPrimaryTxt}>Out for delivery</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => markDelivered(item.id)} style={[styles.btn, styles.success]}>
          <Text style={styles.btnSuccessTxt}>Delivered</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>No orders yet.</Text>}
    />
  );
}

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: MUTED },

  card: { borderWidth: 1, borderColor: LINE, borderRadius: 16, backgroundColor: '#fff', padding: 12 },
  id: { color: TEXT, fontWeight: '900' },
  status: { color: PINK, fontWeight: '900' },
  amount: { color: TEXT, fontWeight: '900', marginTop: 6 },
  lines: { marginTop: 8 },
  lineTxt: { color: TEXT },

  row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },

  idle: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb' },
  btnIdleTxt: { color: TEXT, fontWeight: '900' },

  primary: { backgroundColor: PINK },
  btnPrimaryTxt: { color: '#fff', fontWeight: '900' },

  success: { backgroundColor: '#10b981' },
  btnSuccessTxt: { color: '#fff', fontWeight: '900' },

  sep: { height: 12 },
});
