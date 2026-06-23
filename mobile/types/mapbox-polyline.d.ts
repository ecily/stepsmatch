declare module '@mapbox/polyline' {
  const polyline: {
    decode(points: string): Array<[number, number]>;
  };

  export default polyline;
}
