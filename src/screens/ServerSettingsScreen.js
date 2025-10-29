// File: src/screens/ServerSettingsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, setBaseUrlManual, clearBaseUrlManual, initApiBase } from '../api/base';

const PINK = '#e83e8c', TEXT = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0';

async function ping(url, path = '/health', timeoutMs = 2500) {
  if (!url) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${url}${path}`, { signal: ctrl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function ServerSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [value, setValue] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const base = getBaseUrl();
    setCurrent(base || '');
    setValue(base || '');
  }, []);

  const onTest = async () => {
    if (!value) return;
    setTesting(true);
    const ok = await ping(value);
    setTesting(false);
    Alert.alert(ok ? 'Reachable ✅' : 'Unreachable ❌', ok ? 'The server responded to /health.' : 'Cannot reach /health. Check the URL and your tunnel.');
  };

  const onSave = async () => {
    if (!value) {
      Alert.alert('URL required', 'Please enter a server URL');
      return;
    }
    setSaving(true);
    const ok = await ping(value);
    if (!ok) {
      setSaving(false);
      Alert.alert('Unreachable', 'The URL did not respond to /health. Save anyway?', [
        { text: 'Cancel' },
        { text: 'Save', style: 'destructive', onPress: async () => { await setBaseUrlManual(value); await initApiBase(); setCurrent(value); setSaving(false); Alert.alert('Saved', 'Base URL updated'); navigation.goBack(); } }
      ]);
      return;
    }
    await setBaseUrlManual(value);
    await initApiBase();
    setCurrent(value);
    setSaving(false);
    Alert.alert('Saved', 'Base URL updated');
    navigation.goBack();
  };

  const onClear = async () => {
    await clearBaseUrlManual();
    await initApiBase();
    const base = getBaseUrl();
    setCurrent(base || '');
    setValue(base || '');
    Alert.alert('Cleared', 'Manual override removed. Using auto-detect.');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.wrap, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <Text style={styles.h1}>Server settings</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Current base URL</Text>
          <Text style={styles.mono}>{current || '— not set —'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>New base URL</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="https://quiet-taxis-brake.loca.lt"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={onTest} style={[styles.btn, styles.secondary]} disabled={testing}>
              {testing ? <ActivityIndicator /> : <Text style={styles.secondaryTxt}>Test /health</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={[styles.btn, styles.primary]} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Save & use</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClear} style={[styles.btn, { marginTop: 10, borderColor: '#ef4444', borderWidth: 1 }]}>
            <Text style={{ color: '#ef4444', fontWeight: '900' }}>Clear override</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Tip: Start your tunnel first (LocalTunnel / Cloudflared), paste the URL here, tap “Test”, then “Save & use”.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { fontSize: 18, fontWeight: '900', color: TEXT, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12, backgroundColor: '#fff', marginBottom: 12 },
  label: { color: TEXT, fontWeight: '800', marginBottom: 6 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), color: MUTED },
  input: { borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 12, height: 48, color: TEXT },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  primary: { backgroundColor: PINK },
  primaryTxt: { color: '#fff', fontWeight: '900' },
  secondary: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryTxt: { color: TEXT, fontWeight: '900' },
  hint: { color: MUTED, marginTop: 6 },
});
