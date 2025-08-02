import { Redirect } from 'expo-router';

export default function Index() {
  // Sofortige Weiterleitung zu deinem Tab-Navigator
  return <Redirect href="/(tabs)" />;
}
