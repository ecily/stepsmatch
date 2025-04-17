import React from 'react';
import { SafeAreaView } from 'react-native';
import NearbyTest from './components/NearbyTest';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <NearbyTest />
    </SafeAreaView>
  );
}

