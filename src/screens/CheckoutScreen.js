import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert,
  ActivityIndicator, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from '../context/CartContext';
import { getBaseUrl } from '../api/base';  // ✅ dynamic base

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0', ERR = '#ef4444';
const SOFT = '#f9e3ee';

/* ------------ Demo card helpers ------------ */
const BRANDS = [
  { key: 'visa', pattern: /^4\d{0,}$/ },
  { key: 'mc', pattern: /^(5[1-5]\d{0,}|2(2[2-9]\d{0,}|[3-6]\d{0,}|7[01]\d{0,}|720\d{0,}))$/ },
  { key: 'amex', pattern: /^3[47]\d{0,}$/ },
];
function detectBrand(digits){ if(!digits) return null; const s=String(digits); return BRANDS.find(b=>b.pattern.test(s))?.key||null; }
function luhnOk(num){ const s=(num||'').replace(/\D/g,''); let sum=0,alt=false; for(let i=s.length-1;i>=0;i--){ let n=parseInt(s[i],10); if(alt){ n*=2; if(n>9)n-=9;} sum+=n; alt=!alt;} return (sum%10)===0 && s.length>=12; }
function formatCard(num,brand){ const d=(num||'').replace(/\D/g,''); return brand==='amex' ? d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*$/,(_,a,b,c)=>[a,b,c].filter(Boolean).join(' ')) : d.replace(/(\d{4})/g,'$1 ').trim(); }
function formatExpiry(v){ const d=(v||'').replace(/\D/g,'').slice(0,4); return d.length<=2?d:d.slice(0,2)+'/'+d.slice(2); }
function validExpiry(mmYY){ const m=(mmYY||'').replace(/\D/g,''); if(m.length!==4) return false; const mm=+m.slice(0,2), yy=+m.slice(2); if(mm<1||mm>12) return false; const now=new Date(); const year=2000+yy; const expEnd=new Date(year,mm,0,23,59,59); return expEnd>=now; }
function validCvc(cvc,brand){ const d=(cvc||'').replace(/\D/g,''); return brand==='amex'? d.length===4 : d.length===3; }

/* ---- tiny fetch helper with JSON + timeouts ---- */
const fetchJson = async (url, { method='GET', body, timeoutMs=9000, headers={} } = {}) => {
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(url, {
      method,
      headers: { Accept:'application/json', ...(body?{'Content-Type':'application/json'}:{}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const ct = res.headers.get('content-type')||'';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if(!res.ok){
      const msg = typeof data==='string'?data:(data?.error||JSON.stringify(data||{}));
      const err = new Error(`HTTP ${res.status} ${res.statusText} — ${String(msg).slice(0,140)}`); err.status=res.status; err.data=data; throw err;
    }
    return data;
  } finally { clearTimeout(t); }
};

// Try multiple endpoints (matches your Profile screen behaviour)
const tryPaths = async ({ base, method='GET', paths=[], body }) => {
  let last;
  for(const p of paths){
    const url = `${base}${p.startsWith('/')?p:`/${p}`}`;
    try{ const data = await fetchJson(url,{method,body}); return { path:p, data }; }
    catch(e){ console.warn(`[CHECKOUT] ${method} ${p} -> ${e.message}`); last = e; }
  }
  throw last || new Error('No endpoints succeeded');
};

/* ------------ Screen ------------ */
export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const BASE = getBaseUrl();            // ✅ dynamic base
  const { items, total, clearCart, updateQty, remove } = useCart();

  const [fulfillment, setFulfillment] = useState('delivery'); // 'delivery' | 'collect'
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // card form state (demo)
  const [name, setName] = useState('');
  const [card, setCard] = useState('');
  const [brand, setBrand] = useState(null);
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveCard, setSaveCard] = useState(true);

  // 🔄 fetch profile (on mount AND whenever the screen regains focus)
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const getCandidates = ['/users/me', '/user/me', '/profile', '/user', '/me'];
      const { data, path } = await tryPaths({ base: BASE, method: 'GET', paths: getCandidates });
      console.log('[CHECKOUT] profile from', path);
      const u = data?.user ?? data?.profile ?? data ?? {};
      setProfile(u || {});
      if (u?.deliveryPreference) setFulfillment(u.deliveryPreference);
      if (u?.payment?.savedCard) {
        const sc = u.payment.savedCard;
        setBrand(sc.brand || null);
        if (sc.mask) setCard(sc.mask);
        if (sc.expiry) setExpiry(sc.expiry);
        if (sc.name) setName(sc.name);
      }
      return u || {};
    } catch {
      setProfile({});
      return {};
    } finally {
      setLoadingProfile(false);
    }
  }, [BASE]);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));  // ✅ refresh after returning from Profile

  const destOK = fulfillment === 'collect' || !!profile?.lat;

  const lineTotal = (it) => Number((it.qty || 1) * (it.price || 0));
  const bottom = Math.max(24, insets.bottom + 12);

  // merge + save back to profile (same endpoint set as Profile)
  const mergeAndSaveProfile = useCallback(async (patch) => {
    try {
      const getCandidates = ['/users/me', '/user/me', '/profile', '/user', '/me'];
      const { data: curData } = await tryPaths({ base: BASE, method: 'GET', paths: getCandidates });
      const cur = curData?.user || curData?.profile || curData || {};
      const next = { ...(cur || {}), ...patch, payment: { ...(cur?.payment || {}), ...(patch?.payment || {}) } };

      const putCandidates = ['/users/me', '/user/me', '/profile', '/me'];
      const postCandidates = ['/users', '/user', '/profile'];
      try {
        const { path } = await tryPaths({ base: BASE, method: 'PUT', paths: putCandidates, body: next });
        console.log('[CHECKOUT] profile saved via PUT', path);
      } catch {
        const { path } = await tryPaths({ base: BASE, method: 'POST', paths: postCandidates, body: next });
        console.log('[CHECKOUT] profile saved via POST', path);
      }

      setProfile(next);
      return next;
    } catch (e) {
      console.warn('[CHECKOUT] merge/save profile failed:', e.message);
      return null;
    }
  }, [BASE]);

  /* ---------- Form helpers ---------- */
  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name required';
    const digits = card.replace(/\D/g, '');
    if (!luhnOk(digits)) errs.card = 'Card number invalid';
    if (!validExpiry(expiry)) errs.expiry = 'Invalid expiry';
    if (!validCvc(cvc, brand)) errs.cvc = 'Invalid CVC';
    if (fulfillment === 'delivery' && !destOK) errs.address = 'Delivery address required (or switch to Collect)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onChangeCard = (v) => {
    const digits = v.replace(/\D/g, '');
    const b = detectBrand(digits);
    setBrand(b);
    setCard(formatCard(digits, b));
  };
  const onChangeExpiry = (v) => setExpiry(formatExpiry(v));
  const onChangeCvc = (v) => setCvc(v.replace(/\D/g, '').slice(0, 4));

  /* ---------- Autofill demo → Pay ---------- */
  const autofillDemo = () => {
    setName('Alex Johnson');
    const digits = '4242424242424242';
    setBrand('visa');
    setCard(formatCard(digits, 'visa'));
    setExpiry('12/29');
    setCvc('123');
    Alert.alert('Demo details filled', 'Tap “Pay” to simulate a successful payment.');
  };

  const payDemo = useCallback(async () => {
    if (!items.length) { Alert.alert('Cart empty', 'Add items first'); return; }

    // 🔁 make sure we have the latest profile before validating address
    const freshProfile = await loadProfile();

    const hasDest = fulfillment === 'collect' || !!freshProfile?.lat;
    if (fulfillment === 'delivery' && !hasDest) {
      Alert.alert('Delivery address needed', 'Please add your address in Profile, or switch to Collect.', [
        { text: 'Go to Profile', onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }

    if (!validate()) return;

    setProcessing(true);
    try {
      // 1) Create order
      const orderRes = await fetchJson(`${BASE}/orders`, {
        method: 'POST',
        body: {
          lines: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty || 1 })),
          notes: '',
          customer: { name },
          delivery: {
            mode: fulfillment,
            address: fulfillment === 'delivery' ? {
              label: freshProfile?.address,
              lat: freshProfile?.lat,
              lng: freshProfile?.lng,
            } : null,
            fee: 0, tipPercent: 0, tipAmount: 0,
          },
        },
      });
      const newOrderId = orderRes.orderId || orderRes.id || `${Date.now()}`;
      const orderTotal = Number(total || 0);

      // 2) Enqueue for drivers (best-effort; safe to fail silently)
      const enqueueBody = {
        orderId: newOrderId,
        address: freshProfile?.address || null,
        lat: freshProfile?.lat ?? null,
        lng: freshProfile?.lng ?? null,
        mode: fulfillment,
        total: orderTotal,
        createdAt: new Date().toISOString(),
      };
      const tryEnqueue = async (p) => {
        try {
          const r = await fetch(`${BASE}${p}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enqueueBody),
          });
          return r.ok;
        } catch { return false; }
      };
      await (tryEnqueue('/drivers/inbox')
        || tryEnqueue('/drivers/queue')
        || tryEnqueue('/driver/inbox')
        || tryEnqueue('/drivers/demo/enqueue')
        || Promise.resolve(false));

      // 3) Save preference + (demo) saved card
      if (saveCard) {
        const digits = card.replace(/\D/g, '');
        const last4 = digits.slice(-4);
        const mask = '**** **** **** ' + last4;
        await mergeAndSaveProfile({
          deliveryPreference: fulfillment,
          payment: { savedCard: { brand, last4, mask, expiry, name, demo: true, savedAt: new Date().toISOString() } },
        });
      } else {
        await mergeAndSaveProfile({ deliveryPreference: fulfillment });
      }

      await new Promise(res => setTimeout(res, 500));

      clearCart();
      Alert.alert('Payment successful (demo)', 'Your order is confirmed.', [
        { text: 'Track order', onPress: () => navigation.navigate('Track', { orderId: newOrderId }) },
      ]);
    } catch (e) {
      Alert.alert('Payment failed (demo)', e.message || 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  }, [items, fulfillment, name, card, brand, expiry, saveCard, mergeAndSaveProfile, navigation, BASE, loadProfile, total]);

  /* ---------- UI ---------- */
  const renderItem = ({ item }) => (
    <View style={styles.lineRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.linePrice}>R {(item.price || 0).toFixed(2)} ea</Text>
      </View>

      <View style={styles.qtyRow}>
        <TouchableOpacity onPress={() => updateQty(item.id, Math.max(1, (item.qty || 1) - 1))} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{item.qty || 1}</Text>
        <TouchableOpacity onPress={() => updateQty(item.id, (item.qty || 1) + 1)} style={styles.qtyBtn}>
          <Text style={styles.qtyBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.lineTotal}>R {lineTotal(item).toFixed(2)}</Text>
        <TouchableOpacity onPress={() => remove(item.id)} style={styles.removePill}>
          <Text style={styles.removeTxt}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const amount = useMemo(() => Number(total || 0), [total]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Fulfillment */}
        <View style={styles.card}>
          <Text style={styles.h1}>Fulfillment</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => setFulfillment('delivery')} style={[styles.pill, fulfillment==='delivery' && styles.pillActive]}>
              <Text style={[styles.pillTxt, fulfillment==='delivery' && styles.pillTxtActive]}>Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFulfillment('collect')} style={[styles.pill, fulfillment==='collect' && styles.pillActive]}>
              <Text style={[styles.pillTxt, fulfillment==='collect' && styles.pillTxtActive]}>Collect</Text>
            </TouchableOpacity>
          </View>

          {fulfillment === 'delivery' && (
            <View style={{ marginTop: 10 }}>
              {loadingProfile ? (
                <ActivityIndicator />
              ) : profile?.address ? (
                <Text style={styles.muted}>Deliver to: <Text style={styles.bold}>{profile.address}</Text></Text>
              ) : (
                <Text style={[styles.muted, { color: ERR }]}>No address saved. Add one in Profile.</Text>
              )}
              <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.btn, styles.secondary, { marginTop: 8 }]}>
                <Text style={styles.secondaryTxt}>Edit address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Cart */}
        <View style={styles.card}>
          <Text style={styles.h1}>Your cart</Text>
          {!items.length ? (
            <Text style={[styles.muted, { marginTop: 8 }]}>No items.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              contentContainerStyle={{ paddingTop: 6 }}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.h1}>Summary</Text>
          <View style={styles.sumRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.bold}>R {amount.toFixed(2)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.muted}>{fulfillment === 'delivery' ? 'Delivery' : 'Collect'}</Text>
            <Text style={styles.bold}>{fulfillment === 'delivery' ? 'R 0.00' : '—'}</Text>
          </View>
          <View style={[styles.sumRow, { marginTop: 8 }]}>
            <Text style={styles.totalLbl}>Total</Text>
            <Text style={styles.totalVal}>R {amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Card form (Demo) */}
        <View style={styles.card}>
          <Text style={styles.h1}>Card details (Demo)</Text>

          <View style={styles.demoRow}>
            <TouchableOpacity onPress={autofillDemo} style={[styles.btn, styles.demoBtn]}>
              <Text style={styles.demoBtnTxt}>Autofill demo card</Text>
            </TouchableOpacity>
            <Text style={styles.demoNote}>No real charge will be made.</Text>
          </View>

          <Text style={styles.label}>Name on card</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Alex Johnson"
            placeholderTextColor="#94a3b8"
            style={[styles.input, errors.name && styles.inputErr]}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errTxt}>{errors.name}</Text>}

          <Text style={styles.label}>Card number</Text>
          <TextInput
            value={card}
            onChangeText={onChangeCard}
            placeholder="1234 5678 9012 3456"
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
            style={[styles.input, errors.card && styles.inputErr]}
            maxLength={brand === 'amex' ? 17 : 19}
          />
          <View style={styles.brandRow}>
            <BrandDot active={brand === 'visa'} label="VISA" />
            <BrandDot active={brand === 'mc'} label="MC" />
            <BrandDot active={brand === 'amex'} label="AMEX" />
          </View>
          {errors.card && <Text style={styles.errTxt}>{errors.card}</Text>}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Expiry</Text>
              <TextInput
                value={expiry}
                onChangeText={onChangeExpiry}
                placeholder="MM/YY"
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                style={[styles.input, errors.expiry && styles.inputErr]}
                maxLength={5}
              />
              {errors.expiry && <Text style={styles.errTxt}>{errors.expiry}</Text>}
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>CVC</Text>
              <TextInput
                value={cvc}
                onChangeText={onChangeCvc}
                placeholder={brand === 'amex' ? '4 digits' : '3 digits'}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                style={[styles.input, errors.cvc && styles.inputErr]}
                maxLength={brand === 'amex' ? 4 : 3}
                secureTextEntry
              />
              {errors.cvc && <Text style={styles.errTxt}>{errors.cvc}</Text>}
            </View>
          </View>

          {/* Save card (demo) */}
          <View style={styles.saveRow}>
            <Text style={styles.muted}>Save this card in profile (demo)</Text>
            <Switch value={saveCard} onValueChange={setSaveCard} thumbColor={saveCard ? PINK : '#e5e7eb'} />
          </View>

          {fulfillment === 'delivery' && !destOK && (
            <Text style={[styles.errTxt, { marginTop: 4 }]}>
              Delivery address required. Tap “Edit address” in Fulfillment or switch to Collect.
            </Text>
          )}

          <Pressable
            onPress={payDemo}
            disabled={!items.length || processing}
            style={[styles.payBtn, (!items.length || processing) && { opacity: 0.6 }]}
          >
            {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.payTxt}>Pay R {amount.toFixed(2)}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ------------ Small brand chip ------------ */
function BrandDot({ active, label }) {
  return (
    <View style={[brandStyles.dot, active && brandStyles.dotActive]}>
      <Text style={[brandStyles.dotTxt, active && brandStyles.dotTxtActive]}>{label}</Text>
    </View>
  );
}
const brandStyles = StyleSheet.create({
  dot: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', marginRight: 6, backgroundColor: '#fff' },
  dotActive: { backgroundColor: SOFT, borderColor: '#f3d1de' },
  dotTxt: { fontSize: 11, color: MUTED, fontWeight: '800' },
  dotTxtActive: { color: PINK },
});

/* -------------- Styles -------------- */
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 14, backgroundColor: '#fff', marginBottom: 12 },
  h1: { fontSize: 16, fontWeight: '900', color: TEXT },

  // lines
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineName: { color: TEXT, fontWeight: '800', maxWidth: 160 },
  linePrice: { color: MUTED, marginTop: 2 },
  lineTotal: { color: TEXT, fontWeight: '900' },
  removePill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 6 },
  removeTxt: { color: '#ef4444', fontWeight: '900' },
  sep: { height: 10 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt: { color: TEXT, fontWeight: '900', fontSize: 16 },
  qtyValue: { minWidth: 20, textAlign: 'center', color: TEXT, fontWeight: '900' },

  // summary
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  bold: { color: TEXT, fontWeight: '900' },
  totalLbl: { color: TEXT, fontWeight: '900' },
  totalVal: { color: TEXT, fontWeight: '900', fontSize: 16 },

  // mode
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: LINE },
  pillActive: { backgroundColor: SOFT, borderColor: '#f3d1de' },
  pillTxt: { color: PINK, fontWeight: '800' },
  pillTxtActive: { color: PINK, fontWeight: '900' },

  // inputs
  label: { color: TEXT, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 12, color: TEXT, backgroundColor: '#fff' },
  inputErr: { borderColor: ERR },
  errTxt: { color: ERR, marginTop: 4 },

  // save row
  saveRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // buttons
  payBtn: { marginTop: 14, backgroundColor: PINK, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  payTxt: { color: '#fff', fontWeight: '900' },

  btn: { marginTop: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondary: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryTxt: { color: TEXT, fontWeight: '900' },

  demoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  demoBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f3d1de', paddingHorizontal: 12 },
  demoBtnTxt: { color: PINK, fontWeight: '900' },
  demoNote: { color: MUTED, fontSize: 12 },
});
