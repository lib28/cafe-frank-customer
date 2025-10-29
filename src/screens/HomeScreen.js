import React, { useLayoutEffect, useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';

// ✅ import backend ping (no other screens need changes yet)
import { pingServer } from '../api/http';

const PINK = '#e83e8c';
const TEXT = '#0f172a';
const MUTED = '#6b7280';
const LINE = '#f3d1de';

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { items } = useCart();

  const [apiOk, setApiOk] = useState(null); // null = unknown, true = ok, false = down
  const [apiMsg, setApiMsg] = useState('Checking…');

  const count = useMemo(
    () => items.reduce((n, it) => n + (it.qty || 1), 0),
    [items]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Café Frank',
      headerTitleStyle: { fontWeight: '900', color: PINK },
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('DriverProfile')} style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontWeight: '900', color: PINK }}>Drivers</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontWeight: '900', color: PINK }}>Profile</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  // 🔌 backend reachability check (uses EXPO_PUBLIC_API_URL)
  useEffect(() => {
    (async () => {
      try {
        const res = await pingServer(); // GET /health
        setApiOk(true);
        setApiMsg('Online');
        if (__DEV__) console.log('Health:', res);
      } catch (e) {
        setApiOk(false);
        setApiMsg('Offline');
      }
    })();
  }, []);

  // Optional: disable menu button if API is offline
  const menuDisabled = apiOk === false;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        {/* Hero / Brand */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/cafefrank-icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* tiny status pill */}
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View style={[styles.statusPill, apiOk === true ? styles.ok : apiOk === false ? styles.bad : styles.unknown]}>
              <View style={[styles.dot, apiOk === true ? styles.okBg : apiOk === false ? styles.badBg : styles.unknownBg]} />
              <Text style={styles.statusTxt}>
                API: {apiMsg}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>Café Frank</Text>
            <Text style={styles.subtitle}>Fresh • Honest • Seasonal</Text>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[styles.cta, styles.ctaPrimary, menuDisabled && styles.disabledBtn]}
              onPress={() => !menuDisabled && navigation.navigate('MenuFull')}
              disabled={menuDisabled}
            >
              <Text style={[styles.ctaPrimaryTxt, menuDisabled && styles.disabledTxt]}>
                View Live Menu
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cta, styles.ctaSecondary]}
              onPress={() => navigation.navigate('Cart')}
            >
              <Text style={styles.ctaSecondaryTxt}>Your Cart</Text>
              {!!count && <View style={styles.badge}><Text style={styles.badgeTxt}>{count}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Feature cards */}
        <View style={styles.cardGrid}>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Track')}>
            <Text style={styles.cardTitle}>Track Order</Text>
            <Text style={styles.cardText}>Live driver ETA and route once your order is on the way.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.cardTitle}>Address & Preferences</Text>
            <Text style={styles.cardText}>Save your delivery address and default options for quicker checkout.</Text>
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <Text style={styles.footer}>Made for Café Frank • Cape Town</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, alignItems: 'stretch' },

  hero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#fff',
    overflow: 'hidden',
    padding: 18,
    alignItems: 'center',
    marginTop: 6,
  },
  logoWrap: {
    width: 100, height: 100, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff5f9',
    borderWidth: 1, borderColor: LINE,
    marginBottom: 8,
  },
  logo: { width: 72, height: 72 },

  // status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusTxt: { fontSize: 12, fontWeight: '700' },
  ok: { borderColor: '#c6f6d5', backgroundColor: '#f0fff4' },
  okBg: { backgroundColor: '#22c55e' },
  bad: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  badBg: { backgroundColor: '#ef4444' },
  unknown: { borderColor: '#fde68a', backgroundColor: '#fffbeb' },
  unknownBg: { backgroundColor: '#f59e0b' },

  title: { fontSize: 28, fontWeight: '900', color: PINK },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 4 },

  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctaPrimary: { backgroundColor: PINK, borderColor: PINK },
  ctaPrimaryTxt: { color: '#fff', fontWeight: '900' },
  ctaSecondary: { backgroundColor: '#fff', borderColor: LINE },
  ctaSecondaryTxt: { color: TEXT, fontWeight: '900' },
  badge: {
    marginLeft: 8, minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: PINK, alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 12, fontWeight: '900', paddingHorizontal: 6 },

  disabledBtn: { opacity: 0.6 },
  disabledTxt: { color: '#f8fafc' },

  cardGrid: { gap: 12, marginTop: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: PINK },
  cardText: { fontSize: 13, color: MUTED, marginTop: 6 },

  footer: { textAlign: 'center', color: MUTED, marginTop: 18, fontSize: 12 },
});
