import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { getBaseUrl } from '../api/base';

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';

const fetchJson = async (url, { method = 'GET', body, timeoutMs = 9000, headers = {} } = {}) => {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${typeof data === 'string' ? data : data?.error || ''}`);
    return data;
  } finally { clearTimeout(t); }
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const BASE = getBaseUrl();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState({ name: '', phone: '', address: '', lat: null, lng: null, deliveryPreference: 'delivery' });

  const [q, setQ] = useState(''); const [suggestions, setSuggestions] = useState([]); const [searching, setSearching] = useState(false);

  const region = useMemo(() => ({ latitude: typeof me.lat === 'number' ? me.lat : -33.9249, longitude: typeof me.lng === 'number' ? me.lng : 18.4241, latitudeDelta: 0.012, longitudeDelta: 0.012 }), [me.lat, me.lng]);

  useEffect(() => {
    (async () => {
      try {
        const u = await fetchJson(`${BASE}/api/user`);
        setMe({
          name: u.name || '', phone: u.phone || '', address: u.address || '',
          lat: typeof u.lat === 'number' ? u.lat : null, lng: typeof u.lng === 'number' ? u.lng : null,
          deliveryPreference: u.deliveryPreference || 'delivery'
        });
      } catch (e) {
        console.warn('[PROFILE] load failed:', e.message);
      } finally { setLoading(false); }
    })();
  }, [BASE]);

  const onSearch = useCallback(async (text) => {
    setQ(text);
    if (!text || text.length < 2) { setSuggestions([]); return; }
    try {
      setSearching(true);
      const data = await fetchJson(`${BASE}/api/geo/search?q=${encodeURIComponent(text)}`, { timeoutMs: 7000 });
      setSuggestions(data?.results || []);
    } catch { setSuggestions([]); }
    finally { setSearching(false); }
  }, [BASE]);

  const applySuggestion = useCallback((sug) => {
    setSuggestions([]); setQ(sug.label || '');
    setMe(m => ({ ...m, address: sug.label || '', lat: sug.lat, lng: sug.lng }));
    if (mapRef.current && typeof sug.lat === 'number' && typeof sug.lng === 'number') {
      mapRef.current.animateToRegion({ latitude: sug.lat, longitude: sug.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    }
  }, []);

  const pinMoved = useCallback(async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMe(m => ({ ...m, lat: latitude, lng: longitude }));
    try {
      const data = await fetchJson(`${BASE}/api/geo/reverse?lat=${latitude}&lng=${longitude}`, { timeoutMs: 7000 });
      setMe(m => ({ ...m, address: data?.label || m.address })); setQ(data?.label || '');
    } catch {}
  }, [BASE]);

  const useMyLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Location permission is required.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setMe(m => ({ ...m, lat: latitude, lng: longitude }));
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
      try {
        const data = await fetchJson(`${BASE}/api/geo/reverse?lat=${latitude}&lng=${longitude}`, { timeoutMs: 7000 });
        setMe(m => ({ ...m, address: data?.label || m.address })); setQ(data?.label || '');
      } catch {}
    } catch (e) { Alert.alert('Location error', e.message || 'Could not get location'); }
  }, [BASE]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        name: me.name || '', phone: me.phone || '', address: me.address || '',
        lat: typeof me.lat === 'number' ? me.lat : null, lng: typeof me.lng === 'number' ? me.lng : null,
        deliveryPreference: me.deliveryPreference || 'delivery'
      };
      await fetchJson(`${BASE}/api/user`, { method: 'PUT', body: payload });
      Alert.alert('Saved', 'Profile updated.');
    } catch (e) {
      Alert.alert('Save failed', e?.message || 'Network request failed');
    } finally { setSaving(false); }
  }, [BASE, me]);

  if (loading) return (<View style={styles.center}><ActivityIndicator color={PINK} /><Text style={{ color: MUTED, marginTop: 8 }}>Loading profile…</Text></View>);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1 }}>
        <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={region} onPress={pinMoved}>
          {typeof me.lat === 'number' && typeof me.lng === 'number' &&
            <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} draggable onDragEnd={pinMoved} title="Delivery pin" description={me.address || 'Drag to adjust'} />}
        </MapView>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
          <Text style={styles.h1}>Your details</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput value={me.name} onChangeText={(v) => setMe(m => ({ ...m, name: v }))} placeholder="Your full name" placeholderTextColor="#94a3b8" style={styles.input} />

          <Text style={styles.label}>Phone</Text>
          <TextInput value={me.phone} onChangeText={(v) => setMe(m => ({ ...m, phone: v }))} keyboardType="phone-pad" placeholder="e.g. 082 123 4567" placeholderTextColor="#94a3b8" style={styles.input} />

          <Text style={styles.label}>Search address</Text>
          <TextInput value={q} onChangeText={onSearch} placeholder="Type a street or place" placeholderTextColor="#94a3b8" style={styles.input} />
          {searching && <ActivityIndicator style={{ marginTop: 6 }} />}

          {!!suggestions.length &&
            <FlatList data={suggestions} keyExtractor={(_, i) => 'sug-' + i}
              renderItem={({ item }) => (<TouchableOpacity style={styles.sugRow} onPress={() => applySuggestion(item)}><Text style={styles.sugTxt} numberOfLines={2}>{item.label}</Text></TouchableOpacity>)}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />} style={{ maxHeight: 120, marginTop: 6 }} />}

          {me.address
            ? <Text style={[styles.muted, { marginTop: 8 }]}>Selected: <Text style={styles.bold}>{me.address}</Text></Text>
            : <Text style={[styles.muted, { marginTop: 8 }]}>Tap the map, use “Use my location”, or pick from search.</Text>
          }

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={useMyLocation} style={[styles.btn, styles.btnGhost, { flex: 1 }]}><Text style={styles.btnGhostTxt}>Use my location</Text></TouchableOpacity>
            <TouchableOpacity onPress={saveProfile} disabled={saving} style={[styles.btn, styles.btnPrimary, { flex: 1, opacity: saving ? 0.6 : 1 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryTxt}>Save profile</Text>}</TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 12 },
  h1: { fontSize: 16, fontWeight: '900', color: TEXT, marginBottom: 6 },
  label: { color: TEXT, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: { height: 46, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 12, color: TEXT, backgroundColor: '#fff' },
  sugRow: { padding: 10, borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 10, backgroundColor: '#fff' },
  sugTxt: { color: TEXT },
  muted: { color: MUTED }, bold: { color: TEXT, fontWeight: '900' },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: LINE }, btnGhostTxt: { color: TEXT, fontWeight: '900' },
  btnPrimary: { backgroundColor: PINK }, btnPrimaryTxt: { color: '#fff', fontWeight: '900' }
});
