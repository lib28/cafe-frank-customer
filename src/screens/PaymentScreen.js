// File: src/screens/PaymentScreen.js
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';
import { BASE_URL } from '../api/base';

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';

export default function PaymentScreen() {
  const { items, total, clearCart } = useCart();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [provider, setProvider] = useState('yoco'); // 'yoco' | 'mpgs'
  const [starting, setStarting] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [payUrl, setPayUrl] = useState(null);
  const [checking, setChecking] = useState(false);
  const [webVisible, setWebVisible] = useState(false);

  const amount = useMemo(() => Number(total || 0), [total]);
  const amountCents = useMemo(() => Math.max(1, Math.round(amount * 100)), [amount]);

  const startHostedCheckout = useCallback(async () => {
    if (!items.length) { Alert.alert('Cart empty', 'Add items first'); return; }
    setStarting(true);
    try {
      // 1) create local order
      const r1 = await fetch(`${BASE_URL}/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty || 1 })),
          notes: '', customer: { name: 'Guest' },
          delivery: { address: null, fee: 0, tipPercent: 0, tipAmount: 0 },
        }),
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1?.error || 'Order create failed');
      setOrderId(j1.orderId);

      // 2) ask backend for hosted checkout URL
      const r2 = await fetch(`${BASE_URL}/pay/${provider}/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: j1.orderId, amount: amountCents, currency: 'ZAR' }),
      });
      const j2 = await r2.json();
      if (!r2.ok || !j2?.url) throw new Error(j2?.error || 'Payment start failed');

      setPayUrl(j2.url);
      setWebVisible(true);
    } catch (e) {
      Alert.alert('Payment error', e.message || 'Could not start payment');
    } finally {
      setStarting(false);
    }
  }, [items, amountCents, provider]);

  const checkStatus = useCallback(async () => {
    if (!orderId) return;
    setChecking(true);
    try {
      for (let i = 0; i < 12; i++) {
        const r = await fetch(`${BASE_URL}/orders/${orderId}`);
        const j = await r.json();
        if (j?.status === 'paid') {
          clearCart();
          Alert.alert('Payment successful', 'Thanks! Your order is confirmed.', [
            { text: 'Track order', onPress: () => navigation.navigate('Track', { orderId }) },
          ]);
          return;
        }
        await new Promise(res => setTimeout(res, 1000));
      }
      Alert.alert('Still processing', 'We’re waiting for confirmation. You can check again from Track.');
    } catch (e) {
      Alert.alert('Status error', e.message || 'Could not verify payment');
    } finally {
      setChecking(false);
    }
  }, [orderId, navigation, clearCart]);

  const bottom = Math.max(24, insets.bottom + 12);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.h1}>Pay securely</Text>
        <Text style={styles.line}>Total: <Text style={styles.bold}>R {amount.toFixed(2)}</Text></Text>

        <Text style={[styles.sub, { marginTop: 10 }]}>Choose provider:</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => setProvider('yoco')} style={[styles.pill, provider==='yoco' && styles.pillActive]}>
            <Text style={[styles.pillTxt, provider==='yoco' && styles.pillTxtActive]}>Yoco</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setProvider('mpgs')} style={[styles.pill, provider==='mpgs' && styles.pillActive]}>
            <Text style={[styles.pillTxt, provider==='mpgs' && styles.pillTxtActive]}>Mastercard Gateway</Text>
          </TouchableOpacity>
        </View>

        <Pressable onPress={startHostedCheckout} style={styles.primaryBtn} disabled={starting}>
          {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Proceed to pay</Text>}
        </Pressable>

        {orderId && (
          <TouchableOpacity onPress={checkStatus} style={[styles.btn, styles.secondary]}>
            {checking ? <ActivityIndicator /> : <Text style={styles.secondaryTxt}>Refresh payment status</Text>}
          </TouchableOpacity>
        )}
      </View>

      {webVisible && !!payUrl && (
        <View style={[styles.webWrap, { bottom }]}>
          <View style={styles.webHeader}>
            <Text style={styles.webTitle}>Secure payment</Text>
            <TouchableOpacity onPress={() => { setWebVisible(false); checkStatus(); }}>
              <Text style={styles.close}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.webBody}>
            <WebView
              source={{ uri: payUrl }}
              onNavigationStateChange={(ev) => {
                if (ev.url.includes('/pay/return/success')) {
                  setWebVisible(false);
                  checkStatus();
                }
              }}
              startInLoadingState
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 14, backgroundColor: '#fff' },
  h1: { fontSize: 18, fontWeight: '900', color: TEXT },
  line: { color: TEXT, marginTop: 8 }, bold: { fontWeight: '900' },
  sub: { color: MUTED },

  row: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: LINE },
  pillActive: { backgroundColor: '#f9e3ee', borderColor: '#f3d1de' },
  pillTxt: { color: '#e83e8c', fontWeight: '800' },
  pillTxtActive: { color: '#e83e8c', fontWeight: '900' },

  primaryBtn: { marginTop: 10, backgroundColor: PINK, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '900' },
  btn: { marginTop: 10, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondary: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryTxt: { color: TEXT, fontWeight: '900' },

  webWrap: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#fff' },
  webHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: LINE, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  webTitle: { fontWeight: '900', color: TEXT },
  close: { color: PINK, fontWeight: '900' },
  webBody: { height: '85%' },
});
