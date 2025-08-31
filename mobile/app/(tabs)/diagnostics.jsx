// stepsmatch/mobile/app/(tabs)/diagnostics.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { sendRoundtripTest } from '../../components/PushInitializer';

export default function Diagnostics() {
  const localNow = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'StepsMatch – Local Test',
        body: 'Sofortige Local-Notification',
        data: { offerId: 'LOCAL_TEST' },
        channelId: 'offers',
        categoryIdentifier: 'offer-go',
      },
      trigger: null,
    });
    console.log('[diag] scheduled local notification');
  };

  const roundtrip = async () => {
    await sendRoundtripTest({ offerId: 'ROUNDTRIP_TEST' });
  };

  return (
    <ScrollView contentContainerStyle={s.c}>
      <Text style={s.h}>Diagnostics</Text>

      <TouchableOpacity style={s.btn} onPress={localNow}>
        <Text style={s.bt}>Local Notification (sofort)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btn} onPress={roundtrip}>
        <Text style={s.bt}>Roundtrip an Backend</Text>
      </TouchableOpacity>

      <Text style={s.p}>Siehe adb-Logs: ReactNativeJS | [push] | [BGLOC] | [GEOFENCE]</Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  c: { padding: 16, gap: 12 },
  h: { fontSize: 22, fontWeight: '700' },
  btn: { backgroundColor: '#2c6bed', padding: 14, borderRadius: 12 },
  bt: { color: 'white', textAlign: 'center', fontWeight: '700' },
  p: { color: '#333' },
});
