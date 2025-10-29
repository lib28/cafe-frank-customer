import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BASE_URL } from '../../config/api';

const c = { brand:'#2DAA63', text:'#0f172a', sub:'#334155', border:'#e2e8f0', bg:'#fff' };

export default function DriverLoginScreen({ navigation }) {
  const [pin, setPin] = useState('');

  const login = async () => {
    try {
      const r = await fetch(`${BASE_URL}/driver/login`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ pin, driverId: 'driver-001' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'login failed');
      global.__DRIVER_TOKEN__ = data.token;
      global.__DRIVER_ID__ = data.driverId;
      navigation.replace('DriverJobs');
    } catch (e) {
      Alert.alert('Login', e.message);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Driver Login</Text>
      <Text style={s.sub}>Enter your PIN</Text>
      <TextInput
        style={s.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        placeholder="••••"
        placeholderTextColor="#94a3b8"
      />
      <TouchableOpacity style={[s.btn,s.primary]} onPress={login}>
        <Text style={s.btnText}>Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor:c.bg, padding:16, justifyContent:'center' },
  title:{ fontSize:22, fontWeight:'800', color:c.text },
  sub:{ color:c.sub, marginTop:6, marginBottom:10 },
  input:{ borderWidth:1, borderColor:c.border, borderRadius:10, paddingHorizontal:12, paddingVertical:12, color:c.text },
  btn:{ marginTop:12, paddingVertical:14, borderRadius:12, alignItems:'center', borderWidth:1, borderColor:c.brand },
  primary:{ backgroundColor:c.brand }, btnText:{ color:'#fff', fontWeight:'700' },
});
