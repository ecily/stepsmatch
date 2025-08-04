// app/(tabs)/_layout.js
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'index') return <Ionicons name="home-outline" size={size} color={color} />;
          if (route.name === 'OffersScreen') return <Ionicons name="list-outline" size={size} color={color} />;
          if (route.name === 'ProfileScreen') return <Ionicons name="person-outline" size={size} color={color} />;
          return null;
        },
        tabBarActiveTintColor: '#0062FF',
        tabBarInactiveTintColor: '#888',
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Start' }} />
      <Tabs.Screen name="OffersScreen" options={{ title: 'Angebote' }} />
      <Tabs.Screen name="ProfileScreen" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
