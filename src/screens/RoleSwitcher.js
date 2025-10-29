import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const colors = { brand:'#2DAA63', text:'#0f172a', sub:'#334155', bg:'#fff', border:'#e2e8f0' };

export default function RoleSwitcher({ navigation }) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>Choose a mode</Text>
      <Text style={s.hint}>One app, three roles</Text>

      <TouchableOpacity style={[s.btn,s.primary]} onPress={() => navigation.replace('CustomerStack')}>
        <Text style={s.primaryText}>Customer</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn,s.ghost]} onPress={() => navigation.replace('DriverStack')}>
        <Text style={s.ghostText}>Driver</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn,s.ghost]} onPress={() => navigation.replace('ShopStack')}>
        <Text style={s.ghostText}>Shop (Admin)</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor: colors.bg, padding:16, justifyContent:'center' },
  title:{ fontSize:22, fontWeight:'800', color:colors.text, textAlign:'center' },
  hint:{ color:colors.sub, textAlign:'center', marginBottom:18, marginTop:6 },
  btn:{ paddingVertical:14, borderRadius:12, alignItems:'center', marginTop:12, borderWidth:1, borderColor:colors.brand },
  primary:{ backgroundColor:colors.brand }, ghost:{ backgroundColor:'#f8fafc' },
  primaryText:{ color:'#fff', fontWeight:'700' }, ghostText:{ color:colors.text, fontWeight:'700' },
});
