import React, { useLayoutEffect, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList, SectionList, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from '../api/base';
import { useCart } from '../context/CartContext';

const BRAND = {
  accent: '#e83e8c', accentSoft: '#fff5f9', paper: '#ffffff', paperAlt: '#fafafa', paperSoft: '#f1f5f9',
  text: '#231f20', muted: '#6b7280', line: '#e5e7eb',
};

const CACHE_KEY = 'menu.cache.v5';
const CACHE_TTL_MS = 5 * 60 * 1000;

export default function MenuFullScreen() {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const listRef = useRef(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { addItem, items, total } = useCart();
  const count = useMemo(() => items.reduce((n, it) => n + (it.qty || 1), 0), [items]);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.headerCartBtn}>
          <Text style={styles.headerCartTxt}>Cart</Text>
          {!!count && <View style={styles.badge}><Text style={styles.badgeTxt}>{count}</Text></View>}
        </TouchableOpacity>
      ),
      headerTitle: 'Menu',
    });
  }, [navigation, count]);

  const toSections = (data) => {
    const mapItem = (it, cat, k) => ({
      id: it.id || `${cat?.id || 'cat'}-${k}`,
      name: it.name,
      desc: it.desc ?? it.description ?? '',
      price: Number(it.price || 0),
    });
    if (Array.isArray(data?.categories)) {
      return data.categories.map((c, idx) => ({
        key: c.id || `s${idx}`,
        title: c.name || 'Menu',
        data: (c.items || []).map((it, k) => mapItem(it, c, k)),
      }));
    }
    if (Array.isArray(data)) return [{ key: 'all', title: 'Menu', data: data.map((it, k) => mapItem(it, null, k)) }];
    if (Array.isArray(data?.items)) return [{ key: 'all', title: 'Menu', data: data.items.map((it, k) => mapItem(it, null, k)) }];
    return [];
  };

  const applyAndCache = async (data, shouldCache = true) => {
    const secs = toSections(data);
    setSections(secs);
    setActiveKey(secs[0]?.key || null);
    const now = new Date().toISOString();
    setLastUpdated(now);
    if (shouldCache) await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now, data }));
  };

  const readCacheOnce = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const { ts, data } = JSON.parse(raw);
      if (!data) return false;
      await applyAndCache(data, false);
      if (ts && Date.now() - new Date(ts).getTime() < CACHE_TTL_MS) { setLoading(false); return true; }
    } catch {}
    return false;
  }, []);

  const fetchMenu = useCallback(async ({ force = false } = {}) => {
    const BASE = getBaseUrl();
    setError(null);
    if (!force) setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/menu`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await applyAndCache(data);
    } catch (e) {
      setError('Could not load menu');
    } finally {
      if (force) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { (async () => { await readCacheOnce(); fetchMenu({ force: false }); })(); }, [readCacheOnce, fetchMenu]);

  const onSelectTab = (key) => {
    setActiveKey(key);
    const idx = sections.findIndex(s => s.key === key);
    if (idx > -1 && listRef.current) {
      try { listRef.current.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true, viewOffset: 6 }); } catch {}
    }
  };

  const onAdd = (item) => {
    addItem({ id: item.id, name: item.name, price: item.price, qty: 1 });
    Alert.alert('Added', `${item.name} added to cart`);
  };

  const renderItem = ({ item }) => {
    const inCart = items.some(i => i.id === item.id);
    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          {!!item.desc && <Text style={styles.itemDesc} numberOfLines={2}>{item.desc}</Text>}
          <Text style={styles.itemPrice}>R {item.price.toFixed(2)}</Text>
        </View>
        <TouchableOpacity onPress={() => onAdd(item)} activeOpacity={0.85} style={[styles.addBtn, inCart && styles.addBtnActive]}>
          <Text style={[styles.addTxt, inCart && styles.addTxtActive]}>{inCart ? 'Added' : 'Add'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) return (<View style={styles.center}><ActivityIndicator color={BRAND.accent} /><Text style={{ color: BRAND.muted, marginTop: 6 }}>Loading menu…</Text></View>);
  if (error) return (<View style={styles.center}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>{error}</Text><TouchableOpacity style={[styles.btn, styles.btnGhost, { marginTop: 10 }]} onPress={() => fetchMenu({ force: true })}><Text style={styles.btnGhostTxt}>Retry</Text></TouchableOpacity></View>);

  const tabs = sections.map(s => ({ key: s.key, title: s.title }));

  return (
    <View style={styles.wrap}>
      <FlatList
        data={tabs}
        keyExtractor={(t) => t.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}
        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        renderItem={({ item }) => {
          const active = item.key === activeKey;
          return (
            <TouchableOpacity onPress={() => onSelectTab(item.key)} activeOpacity={0.85} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabTxt, active && styles.tabTxtActive]} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.statusRow}><Text style={styles.statusTxt}>{lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Fresh'}</Text></View>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (<View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{section.title}</Text></View>)}
        stickySectionHeadersEnabled
        onViewableItemsChanged={({ viewableItems }) => {
          const firstHeader = viewableItems.find(v => v.section && v.index == null);
          if (firstHeader?.section?.key) setActiveKey(firstHeader.section.key);
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        contentContainerStyle={{ padding: 12, paddingBottom: Math.max(18, insets.bottom + 90) }}
        ItemSeparatorComponent={() => <View style={{ height: 10, backgroundColor: '#fff9fb' }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMenu({ force: true }); }} tintColor={BRAND.accent} colors={[BRAND.accent]} />}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 10, 14) }]}>
        <View style={styles.sumRow}><Text style={styles.totalLbl}>Cart</Text><Text style={styles.totalVal}>{count} item{count === 1 ? '' : 's'} • R {Number(total || 0).toFixed(2)}</Text></View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1 }]} onPress={() => navigation.navigate('Cart')}><Text style={styles.btnGhostTxt}>View cart</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, { flex: 2 }]} onPress={() => navigation.navigate('Checkout')} disabled={!count}><Text style={styles.btnPrimaryTxt}>Proceed to checkout</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const shadow = Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 2 } });

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BRAND.paper },
  headerCartBtn: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  headerCartTxt: { color: BRAND.text, fontWeight: '900' },
  badge: { marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: BRAND.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.paper, ...shadow },
  tabActive: { backgroundColor: BRAND.accentSoft, borderColor: '#f3d1de' },
  tabTxt: { color: BRAND.text, fontWeight: '800' },
  tabTxtActive: { color: BRAND.accent, fontWeight: '900' },
  statusRow: { paddingHorizontal: 14, paddingBottom: 6 },
  statusTxt: { color: BRAND.muted, fontSize: 12 },
  sectionHeader: { backgroundColor: BRAND.accentSoft, borderWidth: 1, borderColor: '#f3d1de', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, marginTop: 12, ...shadow },
  sectionTitle: { color: BRAND.accent, fontWeight: '900', fontSize: 16, letterSpacing: 0.4 },
  card: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: BRAND.paperSoft, borderRadius: 14, padding: 12, backgroundColor: BRAND.paper, ...shadow },
  itemName: { color: BRAND.text, fontWeight: '900' },
  itemDesc: { color: BRAND.muted, marginTop: 4 },
  itemPrice: { color: BRAND.text, fontWeight: '900', marginTop: 6 },
  addBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.paper },
  addBtnActive: { backgroundColor: BRAND.accentSoft, borderColor: '#f3d1de' },
  addTxt: { color: BRAND.text, fontWeight: '900' },
  addTxtActive: { color: BRAND.accent },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: BRAND.paper, borderTopWidth: 1, borderTopColor: BRAND.paperSoft, paddingHorizontal: 12, paddingTop: 10 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLbl: { color: BRAND.text, fontWeight: '900' },
  totalVal: { color: BRAND.text, fontWeight: '900' },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line },
  btnGhostTxt: { color: BRAND.text, fontWeight: '900' },
  btnPrimary: { backgroundColor: BRAND.accent, paddingHorizontal: 18 },
  btnPrimaryTxt: { color: '#fff', fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.paper }
});
