import React from 'react';
import { SafeAreaView } from 'react-native';
import RadiusSelectionScreen from './screens/RadiusSelectionScreen';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <RadiusSelectionScreen />
    </SafeAreaView>
  );
}
