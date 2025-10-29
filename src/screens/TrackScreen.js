import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Image, Switch, Modal, FlatList } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl } from '../api/base';

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';

const CF_LAT = -33.9249;   // Café Frank approx
const CF_LNG = 18.4241;

// ---- geo helpers ----
const toRad = (x) => (x * Math.PI) / 180;
const toDeg = (x) => (x * 180) / Math.PI;
const EARTH_R = 6371e3;

function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2 +
             Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
             Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return EARTH_R * c; // meters
}

function bearing(a, b) {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng), λ2 = toRad(b.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

function moveTowards(start, dest, meters) {
  const dist = Math.max(0, meters);
  const brng = toRad(bearing(start, dest));
  const δ = dist / EARTH_R;
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lng);

  const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ), cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(brng);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(brng) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

function buildRoute(a, b) {
  // subtle S curve so it feels real
  const mid = {
    lat: (a.lat + b.lat) / 2 + 0.01 * Math.sign(b.lat - a.lat),
    lng: (a.lng + b.lng) / 2 + 0.01 * Math.sign(b.lng - a.lng),
  };
  return [a, mid, b];
}

export default function TrackScreen({ route }) {
  const { orderId, driverId, driverName, autoStart } = route?.params || {};
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const BASE = getBaseUrl();

  const [profile, setProfile] = useState(null);
  const [dest, setDest] = useState(null);

  const [driver, setDriver] = useState({
    id: driverId || 'drv_demo',
    name: driverName || 'Assigned driver',
    vehicle: 'Bike',
    plate: 'CA DEMO',
  });

  // sim state
  const [phase, setPhase] = useState('preparing'); // preparing -> picked_up -> delivering -> arrived
  const [pos, setPos] = useState({ lat: CF_LAT, lng: CF_LNG });
  const [routePts, setRoutePts] = useState(buildRoute({ lat: CF_LAT, lng: CF_LNG }, { lat: CF_LAT, lng: CF_LNG }));
  const [routeIndex, setRouteIndex] = useState(0);
  const [path, setPath] = useState([{ latitude: CF_LAT, longitude: CF_LNG }]);

  const [running, setRunning] = useState(false);
  const [follow, setFollow] = useState(true);
  const [speed, setSpeed] = useState(10);    // m/s
  const [tickMs, setTickMs] = useState(250);
  const [trafficUntil, setTrafficUntil] = useState(0);

  // keep pin visible above sheet
  const [sheetH, setSheetH] = useState(220);

  // Delivery log modal
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [timeline, setTimeline] = useState([]);

  // load destination
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BASE}/user`);
        const j = await r.json();
        const u = j?.user || j?.profile || {};
        setProfile(u);
        const target = (u?.lat && u?.lng) ? { lat: u.lat, lng: u.lng } : { lat: CF_LAT, lng: CF_LNG };
        setDest(target);
        setRoutePts(buildRoute({ lat: CF_LAT, lng: CF_LNG }, target));
      } catch {
        const target = { lat: CF_LAT, lng: CF_LNG };
        setDest(target);
        setRoutePts(buildRoute({ lat: CF_LAT, lng: CF_LNG }, target));
      }
    })();
  }, [BASE]);

  useEffect(() => {
    if (driverId || driverName) {
      setDriver(d => ({ ...d, id: driverId || d.id, name: driverName || d.name }));
    }
  }, [driverId, driverName]);

  const region = useMemo(() => ({
    latitude: pos.lat, longitude: pos.lng, latitudeDelta: 0.03, longitudeDelta: 0.03
  }), [pos]);

  const remainingMeters = useMemo(() => (dest ? haversine(pos, dest) : 0), [pos, dest]);
  const etaText = useMemo(() => {
    if (!dest) return '—';
    const v = Math.max(1, speed);
    const minutes = Math.max(0, Math.round((remainingMeters / v) / 60));
    if (phase === 'preparing') return 'Preparing order…';
    if (phase === 'picked_up' || phase === 'delivering') return minutes <= 1 ? '~1 min' : `~${minutes} min`;
    if (phase === 'arrived') return 'Arrived';
    return '—';
  }, [phase, remainingMeters, speed, dest]);

  const startSimulation = useCallback(({ fast=false } = {}) => {
    setSpeed(fast ? 18 : 10);
    setTickMs(fast ? 160 : 250);
    setPos({ lat: CF_LAT, lng: CF_LNG });
    setPath([{ latitude: CF_LAT, longitude: CF_LNG }]);
    setRouteIndex(0);
    setPhase('preparing');
    setRunning(true);
    setTrafficUntil(0);

    setTimeout(() => setPhase('picked_up'), 2000);
    setTimeout(() => setPhase('delivering'), 3500);

    setTimeout(() => {
      // frame route with bottom padding so the pin doesn't hide under the sheet
      mapRef.current?.fitToCoordinates(
        routePts.map(p => ({ latitude: p.lat, longitude: p.lng })),
        {
          edgePadding: { top: 60, bottom: sheetH + 40, left: 60, right: 60 },
          animated: true
        }
      );
    }, 300);
  }, [routePts, sheetH]);

  // auto-start if coming from DriverProfile assign action
  useEffect(() => {
    if (autoStart) {
      const t = setTimeout(() => startSimulation({ fast: true }), 300);
      return () => clearTimeout(t);
    }
  }, [autoStart, startSimulation]);

  const maybeTraffic = useCallback(() => {
    if (!running) return;
    if (Date.now() < trafficUntil) return;
    if (Math.random() < 0.08) {
      const pauseMs = 2000 + Math.random() * 4000;
      setTrafficUntil(Date.now() + pauseMs);
    }
  }, [running, trafficUntil]);

  // main movement loop
  useEffect(() => {
    if (!running || !dest || phase === 'arrived') return;
    const id = setInterval(() => {
      maybeTraffic();
      if (Date.now() < trafficUntil) return;

      setPos((cur) => {
        const segA = routePts[routeIndex];
        const segB = routePts[routeIndex + 1] || routePts[routePts.length - 1];
        if (!segA || !segB) return cur;

        const metersPerTick = speed * (tickMs / 1000);

        if (haversine(cur, dest) < 20) {
          setPhase('arrived'); setRunning(false);
          Alert.alert('Delivered', 'Driver reached destination.');
          return dest;
        }

        if (haversine(cur, segB) < Math.max(15, metersPerTick) && routeIndex < routePts.length - 2) {
          setRouteIndex(routeIndex + 1);
        }

        const next = moveTowards(cur, segB, metersPerTick);
        setPath((p) => [...p, { latitude: next.lat, longitude: next.lng }]);

        if (follow) {
          mapRef.current?.animateCamera({ center: { latitude: next.lat, longitude: next.lng } }, { duration: 220 });
        }
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [running, routeIndex, routePts, dest, speed, tickMs, follow, phase, maybeTraffic, trafficUntil]);

  // open delivery log
  const openLog = useCallback(async () => {
    if (!orderId) { setTimeline([]); setLogOpen(true); return; }
    setLogLoading(true);
    setLogOpen(true);
    try {
      const r = await fetch(`${BASE}/orders/${orderId}`);
      const j = await r.json();
      const t = j?.order?.timeline || [];
      setTimeline(t.slice().reverse());
    } catch {
      setTimeline([]);
    } finally {
      setLogLoading(false);
    }
  }, [BASE, orderId]);

  const cafeLogo = require('../../assets/cafefrank-icon.png');

  if (!dest) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PINK} />
        <Text style={{ color: MUTED, marginTop: 8 }}>Preparing live map…</Text>
      </View>
    );
  }

  const distanceLabel = remainingMeters < 1000
    ? `${Math.round(remainingMeters)} m`
    : `${(remainingMeters / 1000).toFixed(1)} km`;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{ latitude: dest.lat, longitude: dest.lng, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
        mapPadding={{ top: 10, left: 0, right: 0, bottom: sheetH + 10 }}
      >
        <Marker coordinate={{ latitude: CF_LAT, longitude: CF_LNG }} title="Café Frank" description="Order origin">
          <View style={styles.pillPin}><Text style={styles.pillPinTxt}>CF</Text></View>
        </Marker>

        <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} title="Your address" description={profile?.address || 'Destination'} />

        <Marker coordinate={{ latitude: pos.lat, longitude: pos.lng }} title="Driver" description="On the way" anchor={{ x: 0.5, y: 0.5 }}>
          <Image source={cafeLogo} style={{ width: 36, height: 36, borderRadius: 18 }} />
        </Marker>

        {/* planned route */}
        <Polyline
          coordinates={routePts.map(p => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor="#9ca3af"
          strokeWidth={3}
          lineDashPattern={[8, 6]}
        />

        {/* actual path */}
        {path.length > 1 && (
          <Polyline coordinates={path} strokeColor={PINK} strokeWidth={5} />
        )}
      </MapView>

      {/* overlay */}
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 10, 14) }]}
        onLayout={e => setSheetH(e.nativeEvent.layout.height)}
      >
        <Text style={styles.h1}>
          {phase === 'preparing' && 'Preparing your order'}
          {phase === 'picked_up' && 'Picked up'}
          {phase === 'delivering' && 'On the way'}
          {phase === 'arrived' && 'Delivered'}
        </Text>

        <Text style={styles.muted}>
          ETA: <Text style={styles.bold}>{etaText}</Text>
          {orderId ? <> • Order <Text style={styles.bold}>#{orderId}</Text></> : null}
          {' '}• Distance: <Text style={styles.bold}>{distanceLabel}</Text>
        </Text>

        {/* tap to open Delivery Log */}
        <TouchableOpacity style={{ flexDirection: 'row', gap: 10, marginTop: 10 }} onPress={openLog} activeOpacity={0.85}>
          <View style={[styles.kv, { flex: 1 }]}>
            <Text style={styles.kLbl}>Driver</Text>
            <Text style={styles.kVal}>{driver?.name || '—'}</Text>
          </View>
          <View style={[styles.kv, { flex: 1 }]}>
            <Text style={styles.kLbl}>Vehicle</Text>
            <Text style={styles.kVal}>{driver?.vehicle || '—'}</Text>
          </View>
          <View style={[styles.kv, { flex: 1 }]}>
            <Text style={styles.kLbl}>Plate</Text>
            <Text style={styles.kVal}>{driver?.plate || '—'}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {running ? (
            <TouchableOpacity onPress={() => setRunning(false)} style={[styles.btn, styles.btnPrimary, { flex: 1 }]}>
              <Text style={styles.btnPrimaryTxt}>Pause</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => startSimulation({ fast: false })} style={[styles.btn, styles.btnPrimary, { flex: 1 }]}>
              <Text style={styles.btnPrimaryTxt}>{phase === 'arrived' ? 'Start again' : 'Start'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setTrafficUntil(Date.now() + 5000)}
            style={[styles.btn, styles.btnGhost, { flex: 1 }]}
          >
            <Text style={styles.btnGhostTxt}>Simulate traffic</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={styles.muted}>Follow driver</Text>
          <Switch value={follow} onValueChange={setFollow} thumbColor={follow ? PINK : '#e5e7eb'} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => { setPhase('arrived'); setRunning(false); setPos(dest); setPath(p => [...p, { latitude: dest.lat, longitude: dest.lng }]); }}
            style={[styles.btn, styles.btnGhost, { flex: 1 }]}
          >
            <Text style={styles.btnGhostTxt}>Skip to drop-off</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Delivery Log modal */}
      <Modal visible={logOpen} transparent animationType="slide" onRequestClose={() => setLogOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.h1}>Delivery log {orderId ? `#${orderId}` : ''}</Text>
            {logLoading ? (
              <View style={[styles.center, { paddingVertical: 20 }]}>
                <ActivityIndicator color={PINK} />
                <Text style={{ color: MUTED, marginTop: 8 }}>Loading timeline…</Text>
              </View>
            ) : !timeline.length ? (
              <Text style={[styles.muted, { marginTop: 8 }]}>No events yet.</Text>
            ) : (
              <FlatList
                data={timeline}
                keyExtractor={(_, i) => 'ev-' + i}
                renderItem={({ item }) => (
                  <View style={styles.logRow}>
                    <Text style={styles.logTime}>{new Date(item.at).toLocaleTimeString()}</Text>
                    <Text style={styles.logTxt}>{item.event}</Text>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={{ paddingTop: 10 }}
                style={{ maxHeight: 280 }}
              />
            )}

            <TouchableOpacity onPress={() => setLogOpen(false)} style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}>
              <Text style={styles.btnPrimaryTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },

  sheet: {
    position: 'absolute', left: 12, right: 12, bottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: LINE,
    padding: 12,
  },
  h1: { color: TEXT, fontWeight: '900', fontSize: 16, marginBottom: 6 },
  muted: { color: MUTED },
  bold: { color: TEXT, fontWeight: '900' },

  kv: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 12, padding: 10 },
  kLbl: { color: MUTED, fontSize: 12 },
  kVal: { color: TEXT, fontWeight: '900', marginTop: 2 },

  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  btnGhostTxt: { color: TEXT, fontWeight: '900' },
  btnPrimary: { backgroundColor: PINK },
  btnPrimaryTxt: { color: '#fff', fontWeight: '900' },

  pillPin: {
    backgroundColor: '#111827',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1, borderColor: '#00000020',
  },
  pillPinTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },

  // modal
  modalWrap: { flex: 1, backgroundColor: '#00000055', alignItems: 'center', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, borderTopWidth: 1, borderColor: LINE },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#f1f5f9', padding: 10, borderRadius: 10 },
  logTime: { color: MUTED, width: 84 },
  logTxt: { color: TEXT, fontWeight: '800', flex: 1 },
});
