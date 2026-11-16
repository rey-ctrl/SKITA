/**
 * Haversine formula calculation for distance between two points in km
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format meters/km to human readable Indonesian string
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

/**
 * Estimate road driving and walking route based on urban winding factor
 * ponytail: Mock routing engine replaces Directions API for offline calculation.
 */
export function estimateRoadTravel(haversineKm: number) {
  const roadFactor = 1.28;
  const roadDistanceKm = haversineKm * roadFactor;
  const roadDistanceM = Math.round(roadDistanceKm * 1000);

  // Motor / mobil average speed in Indonesian city: 25 km/h + 2 min traffic overhead
  const motorMinutes = Math.max(3, Math.round((roadDistanceKm / 25) * 60 + 2));

  // Walking speed: 4.5 km/h
  const walkMinutes = Math.max(2, Math.round((roadDistanceKm / 4.5) * 60));

  return {
    roadDistanceM,
    motorMinutes,
    walkMinutes,
  };
}
