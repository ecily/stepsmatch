import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LocationAccessScreen from './screens/LocationAccessScreen';
import InterestSelectionScreen from './screens/InterestSelectionScreen';
import HomeScreen from './screens/HomeScreen';
import OfferDetailsScreen from './screens/OfferDetailsScreen'; // 🆕

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="LocationAccess" component={LocationAccessScreen} />
        <Stack.Screen name="InterestSelection" component={InterestSelectionScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="OfferDetails" component={OfferDetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
