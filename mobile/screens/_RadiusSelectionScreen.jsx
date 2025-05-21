import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
// import RadiusSelectionScreen from './screens/RadiusSelectionScreen';
// import InterestSelectionScreen from './screens/InterestSelectionScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        {/* <Stack.Screen name="RadiusSelection" component={RadiusSelectionScreen} />
        <Stack.Screen name="InterestSelection" component={InterestSelectionScreen} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
