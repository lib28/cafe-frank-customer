import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { BASE_URL } from '../../config/api';

const c = { brand:'#2DAA63', text:'#0f172a', sub:'#334155', border:'#e2e8f0', off:'#f8fafc', bg:'#fff' };

export default function DriverJobsScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setRefreshing(true);
      const r = await fetch(`${BASE_URL}/driver/jobs`, {
        headers:{ Authorization:`Bearer ${global.__DRIVER_TOKEN__||''}` }
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'failed');
      setJobs(data);
    } catch (e) {
      Alert.alert('Jobs', e.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const accept = async (orderId) => {
    try {
      const r = await fetch(`${BASE_URL}/driver/jobs/${encodeURIComponent(orderId)}/accept`, {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${global.__DRIVER_TOKEN__||''}` }
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'accept failed');
      load();
      navigation.navigate('DriverJobDetail', { orderId });
    } catch (e) {
      Alert.alert('Accept', e.message);
    }
  };

  const renderItem = ({ item: j }) => (
    <View style={s.card}>
      <View style={{ flex:1 }}>
        <Text style={s.title}>{j.orderId}</Text>
        <Text style={s.sub}>ZAR {Number(j.amount||0).toFixed(2)} · {j.status}</Text>
        <Text style={s.sub}>Assigned: {j.assignedTo || '—'}</Text>
      </View>
      <TouchableOpacity style={[s.btn,s.primary]} onPress={() => accept(j.orderId)}>
        <Text style={s.btnText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>Driver Jobs</Text>
      <FlatList
        data={jobs}
        keyExtractor={(i)=>i.orderId}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ItemSeparatorComponent={() => <View style={{ height:10 }} />}
        ListEmptyComponent={<Text style={s.sub}>No active orders.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{ flex:1, backgroundColor:c.bg, padding:16 },
  h1:{ fontSize:20, fontWeight:'800', color:c.text, marginBottom:12 },
  card:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:c.border, backgroundColor:c.off, borderRadius:12, padding:12 },
  title:{ fontWeight:'800', color:c.text },
  sub:{ color:c.sub, marginTop:4 },
  btn:{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor:c.brand, alignItems:'center' },
  primary:{ backgroundColor:c.brand }, btnText:{ color:'#fff', fontWeight:'700' },
});
