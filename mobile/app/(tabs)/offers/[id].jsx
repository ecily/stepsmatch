import { Redirect, useLocalSearchParams } from 'expo-router';

export default function OfferRedirect() {
  const { id } = useLocalSearchParams();

  // Kein UI rendern → vermeidet native addViewAt-Fehler
  if (!id) return null;

  // Weiterleitung auf deinen echten Screen: "/(tabs)/OfferScreen?id=<id>"
  return (
    <Redirect
      href={{ pathname: '/(tabs)/OfferScreen', params: { id: String(id) } }}
    />
  );
}
