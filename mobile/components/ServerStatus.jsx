// mobile/components/ServerStatus.jsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import axiosInstance from '../src/api/axios';

export default function ServerStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await axiosInstance.get('/ping'); // 👉 wir brauchen eine /ping Route im Backend
        if (res.status === 200) {
          setOnline(true);
        } else {
          setOnline(false);
        }
      } catch (err) {
        setOnline(false);
      }
    };

    checkServer(); // Erstprüfung beim Start

    const interval = setInterval(checkServer, 30000); // Alle 30 Sekunden neu prüfen

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: online ? '#22c55e' : '#ef4444' }]} />
      <Text style={{ color: online ? '#22c55e' : '#ef4444', marginLeft: 6 }}>
        {online ? 'Server online' : 'Server offline'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
