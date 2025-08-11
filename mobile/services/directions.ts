import polyline from '@mapbox/polyline';

export async function fetchRoute(
  origin,
  destination,
  apiKey,
  mode = 'walking'
) {
  const url =
    'https://maps.googleapis.com/maps/api/directions/json' +
    `?origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&mode=${mode}&key=${apiKey}`;

  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== 'OK' || !json.routes?.[0]?.overview_polyline?.points) {
    const message = json.error_message || json.status || 'Directions failed';
    throw new Error(`Google Directions: ${message}`);
  }

  const points = json.routes[0].overview_polyline.points;
  const decoded = polyline.decode(points); // [[lat, lng], ...]
  return decoded.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}
