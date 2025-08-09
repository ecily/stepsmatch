import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="OffersScreen" />
      <Tabs.Screen name="NavigationScreen" />
      <Tabs.Screen name="ProfileScreen" />
    </Tabs>
  );
}
