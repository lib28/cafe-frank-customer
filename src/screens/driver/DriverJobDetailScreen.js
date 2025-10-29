import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Location from 'expo-location';
import { BASE_URL } from '../../config/api';

const c = { brand:'#2DAA63', red:'#ef4444', text:'#0f172a', sub:'#334155', border:'#e2e8f0', bg:'#fff', off:'#f8fafc' };

export default function DriverJobDetailScreen({ route, navigation }) {
  const orderId = route?.params?.orderId;
  const [status, setStatus] = useState('preparing');
  const watcherRef = useRef(null);
  const [streaming, setStreaming] = useState(false);

  const postStatus = async (s) => {
    try {
      const r = await fetch(`${BASE_URL}/driver/jobs/${encodeURIComponent(orderId)}/status`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${global.__DRIVER_TOKEN__||''}` },
        body: JSON.stringify({ status: s }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'status failed');
      setStatus(s);
    } catch (e) {
      Alert.alert('Status', e.message);
    }
  };

  const send = async (lat, lng) => {
    try {
      await fetch(`${BASE_URL}/orders/${encodeURIComponent(orderId)}/loc`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${global.__DRIVER_TOKEN__||''}` },
        body: JSON.stringify({ lat, lng }),
      });
    } catch {}
  };

  const startStreaming = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission', 'Location is required');
      const cur = await Location.getCurrentPositionAsync({});
      await send(cur.coords.latitude, cur.coords.longitude);
      watcherRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 8 },
        ({ coords }) => send(coords.latitude, coords.longitude)
      );
      setStreaming(true);
    } catch (e) {
      Alert.alert('Location', e.message);
    }
  };
  const stopStreaming = async () => {
    try { await watcherRef.current?.remove(); } catch {}
    watcherRef.current = null;
    setStreaming(false);
  };
  useEffect(() => () => { try { watcherRef.current?.remove(); } catch {} }, []);

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Order {orderId}</Text>
      <Text style={s.sub}>Status: {status}</Text>

      <View style={s.row}>
        <TouchableOpacity style={[s.btn,s.primary]} onPress={() => postStatus('preparing')}>
          <Text style={s.btnText}>Preparing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn,s.primary]} onPress={() => postStatus('out_for_delivery')}>
          <Text style={s.btnText}>Out for delivery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn,s.primary]} onPress={() => postStatus('delivered')}>
          <Text style={s.btnText}>Delivered</Text>
        </TouchableOpacity>
      </View>

      {!streaming ? (
        <TouchableOpacity style={[s.wideBtn,s.primary]} onPress={startStreaming}>
          <Text style={s.btnText}>Start GPS streaming</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[s.wideBtn,s.stop]} onPress={stopStreaming}>
          <Text style={s.stopText}>Stop GPS streaming</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[s.wideBtn]} onPress={() => navigation.goBack()}>
        <Text style={s.ghostText}>Back to jobs</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor:c.bg, padding:16 },
  h1:{ fontSize:20, fontWeight:'800', color:c.text, marginBottom:6 },
  sub:{ color:c.sub, marginBottom:12 },
  row:{ flexDirection:'row', gap:10, marginBottom:12 },
  btn:{ flex:1, paddingVertical:12, borderRadius:10, borderWidth:1, borderColor:c.brand, alignItems:'center' },
  primary:{ backgroundColor:c.brand },
  btnText:{ color:'#fff', fontWeight:'700' },
  wideBtn:{ paddingVertical:14, borderRadius:12, alignItems:'center', borderWidth:1, borderColor:c.brand, marginTop:10 },
  stop:{ backgroundColor:'#fee2e2', borderColor:'#fecaca' },
  stopText:{ color:c.red, fontWeight:'800' },
  ghostText:{ color:c.text, fontWeight:'700' },
});
