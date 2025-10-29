import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, FlatList, Modal, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getBaseUrl } from '../api/base';

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';

const fetchJson = async (url, opts = {}) => {
  const { method='GET', body, headers={}, timeoutMs=10000 } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? {'Content-Type':'application/json'} : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = typeof data === 'string' ? data : (data?.error || JSON.stringify(data||{}));
      const e = new Error(`HTTP ${res.status} — ${msg.slice(0,160)}`);
      e.status = res.status; e.data = data; throw e;
    }
    return data;
  } finally { clearTimeout(t); }
};

export default function DriverProfile() {
  const navigation = useNavigation();
  const BASE = getBaseUrl();

  // lists
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // selection
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [busyIds, setBusyIds] = useState({}); // {driverId: true}

  // add driver modal
  const [addOpen, setAddOpen] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', vehicle: '', plate: '' });

  // driver orders modal
  const [ordersModal, setOrdersModal] = useState({ open: false, driverId: null });

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ drivers: dList }, { orders: oList }] = await Promise.all([
        fetchJson(`${BASE}/drivers`),
        fetchJson(`${BASE}/orders`),
      ]);
      setDrivers(Array.isArray(dList) ? dList : []);
      setOrders(Array.isArray(oList) ? oList.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)) : []);
    } catch (e) {
      console.warn('[DriverProfile] refresh failed:', e.message);
      Alert.alert('Load failed', 'Could not load drivers or orders.');
    } finally {
      setLoading(false);
    }
  }, [BASE]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // helpers
  const orderStatus = (o) => o?.status || 'pending';
  const unassignedOrders = useMemo(() => orders.filter(o => !o.assignedDriverId), [orders]);

  const addDriver = useCallback(async () => {
    if (!newDriver.name || !newDriver.phone) {
      Alert.alert('Missing info', 'Name and phone are required.');
      return;
    }
    try {
      await fetchJson(`${BASE}/drivers`, { method:'POST', body: newDriver });
      setAddOpen(false);
      setNewDriver({ name:'', phone:'', vehicle:'', plate:'' });
      await refreshAll();
    } catch (e) {
      Alert.alert('Add failed', e.message);
    }
  }, [BASE, newDriver, refreshAll]);

  const removeDriver = useCallback(async (id) => {
    // for demo we’ll just filter locally (no backend delete route here)
    Alert.alert('Remove driver?', 'This only removes the driver from the local list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setDrivers(list => list.filter(d => d.id !== id)) }
    ]);
  }, []);

  const setAvailability = useCallback(async (id, available) => {
    try {
      await fetchJson(`${BASE}/drivers/${id}/availability`, { method:'POST', body:{ available } });
      await refreshAll();
    } catch (e) {
      Alert.alert('Update failed', e.message);
    }
  }, [BASE, refreshAll]);

  const assignToDriver = useCallback(async (driverId) => {
    if (!selectedOrderId) { Alert.alert('Select an order', 'Choose an order to assign.'); return; }
    setBusyIds(x => ({ ...x, [driverId]: true }));
    try {
      await fetchJson(`${BASE}/drivers/${driverId}/assign`, { method:'POST', body: { orderId: selectedOrderId } });
      await refreshAll();
      // take you straight into tracking
      const driver = drivers.find(d => d.id === driverId);
      navigation.navigate('Track', { orderId: selectedOrderId, driverId, driverName: driver?.name, autoStart: true });
    } catch (e) {
      Alert.alert('Assign failed', e.message);
    } finally {
      setBusyIds(x => { const y = { ...x }; delete y[driverId]; return y; });
    }
  }, [BASE, selectedOrderId, drivers, navigation, refreshAll]);

  const deleteOrder = useCallback(async (id) => {
    Alert.alert('Delete order?', `Remove order #${id}`, [
      { text: 'Cancel', style:'cancel' },
      { text: 'Delete', style:'destructive', onPress: async () => {
        try {
          await fetchJson(`${BASE}/orders/${id}`, { method:'DELETE' });
          await refreshAll();
        } catch (e) {
          Alert.alert('Delete failed', e.message);
        }
      }}
    ]);
  }, [BASE, refreshAll]);

  const markDelivered = useCallback(async (id) => {
    try {
      await fetchJson(`${BASE}/orders/${id}/delivered`, { method:'POST' });
      await refreshAll();
    } catch (e) {
      Alert.alert('Mark delivered failed', e.message);
    }
  }, [BASE, refreshAll]);

  // -------- renderers --------
  const renderOrderItem = ({ item }) => {
    const selected = selectedOrderId === item.id;
    return (
      <TouchableOpacity
        onPress={() => setSelectedOrderId(item.id)}
        style={[styles.card, selected && { borderColor: PINK }]}
        activeOpacity={0.85}
      >
        <Text style={styles.rowTitle}>#{item.id}</Text>
        <Text style={styles.rowSub}>{item.lines?.map(l => `${l.qty}× ${l.name}`).join(', ') || '—'}</Text>
        <Text style={styles.rowMeta}>
          {new Date(item.createdAt).toLocaleString()} • {orderStatus(item)} • R {(item.amount||0).toFixed(2)}
        </Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
          {!item.assignedDriverId && (
            <View style={[styles.badge, { borderColor:'#3b82f6' }]}>
              <Text style={[styles.badgeTxt, { color:'#2563eb' }]}>Unassigned</Text>
            </View>
          )}
          {item.assignedDriverId && (
            <View style={[styles.badge, { borderColor:'#10b981' }]}>
              <Text style={[styles.badgeTxt, { color:'#059669' }]}>Driver: {item.assignedDriverId}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection:'row', gap:8, marginTop:10 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Track', { orderId: item.id, autoStart: true })} style={[styles.pill, { borderColor: PINK, flex:1 }]}>
            <Text style={[styles.pillTxt, { color: PINK }]}>Open tracker</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => markDelivered(item.id)} style={[styles.pill, { borderColor:'#10b981', flex:1 }]}>
            <Text style={[styles.pillTxt, { color:'#059669' }]}>Delivered</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteOrder(item.id)} style={[styles.pill, { borderColor:'#ef4444' }]}>
            <Text style={[styles.pillTxt, { color:'#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDriverItem = ({ item }) => {
    const busy = !!busyIds[item.id];
    const driverOrders = orders.filter(o => o.assignedDriverId === item.id);

    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {item.phone} • {item.vehicle || '—'} {item.plate ? `(${item.plate})` : ''}
          </Text>
          <Text style={styles.rowMeta}>
            {item.status || 'offline'} {item.assignedOrderId ? `• #${item.assignedOrderId}` : ''}
          </Text>

          <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
            <TouchableOpacity
              onPress={() => setAvailability(item.id, !item.available)}
              style={[styles.pill, { borderColor: item.available ? '#ef4444' : '#10b981' }]}
            >
              <Text style={[styles.pillTxt, { color: item.available ? '#ef4444' : '#059669' }]}>
                {item.available ? 'Go offline' : 'Go online'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ gap: 8, alignItems: 'flex-end' }}>
          <TouchableOpacity
            onPress={() => assignToDriver(item.id)}
            disabled={busy || !selectedOrderId}
            style={[styles.pill, { borderColor: selectedOrderId ? PINK : LINE, opacity: selectedOrderId ? 1 : 0.5 }]}
          >
            {busy ? <ActivityIndicator /> : <Text style={[styles.pillTxt, { color: PINK }]}>Assign selected</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setOrdersModal({ open: true, driverId: item.id })}
            style={[styles.pill, { borderColor: '#3b82f6' }]}
          >
            <Text style={[styles.pillTxt, { color: '#2563eb' }]}>Orders ({driverOrders.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => removeDriver(item.id)}
            style={[styles.pill, { borderColor: '#9ca3af' }]}
          >
            <Text style={[styles.pillTxt, { color: '#6b7280' }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------- UI --------
  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:'#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding:12, paddingBottom:24 }}>
        <Text style={styles.h1}>Driver console</Text>

        <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
          <TouchableOpacity onPress={refreshAll} style={[styles.btn, styles.btnGhost, { flex:1 }]}>
            <Text style={styles.btnGhostTxt}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddOpen(true)} style={[styles.btn, styles.btnPrimary, { flex:1 }]}>
            <Text style={styles.btnPrimaryTxt}>Add driver</Text>
          </TouchableOpacity>
        </View>

        {/* Orders */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.sectionH}>Orders</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : !orders.length ? (
            <Text style={[styles.muted, { marginTop: 8 }]}>No orders yet.</Text>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(it) => it.id}
              renderItem={renderOrderItem}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              scrollEnabled={false}
              contentContainerStyle={{ paddingTop: 8 }}
            />
          )}
        </View>

        {/* Drivers */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.sectionH}>Drivers</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : !drivers.length ? (
            <Text style={[styles.muted, { marginTop: 8 }]}>No drivers yet.</Text>
          ) : (
            <FlatList
              data={drivers}
              keyExtractor={(it) => it.id}
              renderItem={renderDriverItem}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              scrollEnabled={false}
              contentContainerStyle={{ paddingTop: 8 }}
            />
          )}
        </View>
      </ScrollView>

      {/* Add driver modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.h1}>Add driver</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={newDriver.name} onChangeText={(v)=>setNewDriver(d=>({...d, name:v}))} placeholder="e.g. Alex" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={newDriver.phone} onChangeText={(v)=>setNewDriver(d=>({...d, phone:v}))} placeholder="e.g. 082 123 4567" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
            <Text style={styles.label}>Vehicle</Text>
            <TextInput style={styles.input} value={newDriver.vehicle} onChangeText={(v)=>setNewDriver(d=>({...d, vehicle:v}))} placeholder="e.g. Bike" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>Plate</Text>
            <TextInput style={styles.input} value={newDriver.plate} onChangeText={(v)=>setNewDriver(d=>({...d, plate:v}))} placeholder="e.g. CA 123 456" placeholderTextColor="#94a3b8" />

            <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
              <TouchableOpacity onPress={()=>setAddOpen(false)} style={[styles.btn, styles.btnGhost, { flex:1 }]}>
                <Text style={styles.btnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addDriver} style={[styles.btn, styles.btnPrimary, { flex:1 }]}>
                <Text style={styles.btnPrimaryTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Orders modal */}
      <Modal
        visible={ordersModal.open}
        transparent
        animationType="slide"
        onRequestClose={() => setOrdersModal({ open: false, driverId: null })}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.h1}>Driver orders</Text>
            {(() => {
              const list = orders.filter(o => o.assignedDriverId === ordersModal.driverId);
              if (!list.length) return <Text style={[styles.muted, { marginTop: 8 }]}>No orders for this driver yet.</Text>;
              return (
                <FlatList
                  data={list}
                  keyExtractor={(it) => it.id}
                  renderItem={({ item }) => (
                    <View style={{ borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, padding: 10, marginTop: 8 }}>
                      <Text style={styles.rowTitle}>#{item.id}</Text>
                      <Text style={styles.rowSub}>{item.lines?.map(l => `${l.qty}× ${l.name}`).join(', ') || '—'}</Text>
                      <Text style={styles.rowMeta}>
                        {new Date(item.createdAt).toLocaleString()} • {item.status} • R {(item.amount||0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                />
              );
            })()}

            <TouchableOpacity
              onPress={() => setOrdersModal({ open: false, driverId: null })}
              style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
            >
              <Text style={styles.btnPrimaryTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  h1: { color: TEXT, fontWeight: '900', fontSize: 18 },
  sectionH: { color: TEXT, fontWeight: '900', fontSize: 16 },

  card: { borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, backgroundColor: '#fff' },
  row: { borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, backgroundColor: '#fff', flexDirection:'row', gap:10 },

  rowTitle: { color: TEXT, fontWeight: '900' },
  rowSub: { color: MUTED, marginTop: 2 },
  rowMeta: { color: MUTED, marginTop: 2, fontSize: 12 },

  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, backgroundColor:'#fff' },
  badgeTxt: { fontSize: 12, fontWeight: '800' },

  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems:'center', justifyContent:'center' },
  pillTxt: { fontWeight: '900' },

  btn: { paddingVertical: 12, borderRadius: 12, alignItems:'center', justifyContent:'center' },
  btnGhost: { backgroundColor:'#fff', borderWidth:1, borderColor: LINE },
  btnGhostTxt: { color: TEXT, fontWeight:'900' },
  btnPrimary: { backgroundColor: PINK },
  btnPrimaryTxt: { color: '#fff', fontWeight:'900' },

  // inputs
  label: { color: TEXT, fontWeight:'800', marginTop:10, marginBottom:6 },
  input: { height: 46, borderWidth:1, borderColor: LINE, borderRadius:12, paddingHorizontal:12, color: TEXT, backgroundColor:'#fff' },

  // modal
  modalWrap: { flex:1, backgroundColor:'#00000055', alignItems:'center', justifyContent:'flex-end' },
  modalCard: { backgroundColor:'#fff', width:'100%', borderTopLeftRadius:18, borderTopRightRadius:18, padding:16, borderTopWidth:1, borderColor: LINE },
});
