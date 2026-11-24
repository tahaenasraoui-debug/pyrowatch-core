import type { IncidentPhysicsSimulation, TriangulationSolution } from './types';

const EARTH_RADIUS_KM = 6371.0;

/**
 * Great-circle Haversine distance between two coordinates in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Destination coordinate given starting (lat, lon), bearing (deg), and distance (km).
 */
export function destinationCoordinate(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lon: number } {
  const d = distanceKm / EARTH_RADIUS_KM;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: ((((lon2 * 180) / Math.PI) + 540) % 360) - 180
  };
}

/**
 * Initial forward azimuth bearing (0..360 deg) from (lat1, lon1) to (lat2, lon2).
 */
export function computeAzimuthBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = (Math.atan2(y, x) * 180) / Math.PI;
  return (theta + 360) % 360;
}

function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function formatBearingDms(bearingDeg: number): string {
  const norm = normalizeDegrees(bearingDeg);
  let deg = Math.floor(norm);
  let min = Math.round((norm - deg) * 60);
  if (min === 60) {
    deg = (deg + 1) % 360;
    min = 0;
  }
  return `${deg.toString().padStart(3, '0')}° ${min.toString().padStart(2, '0')}'`;
}

export function formatBearingQuadrant(bearingDeg: number): string {
  const b = normalizeDegrees(bearingDeg);
  if (b >= 0 && b < 90) return `N ${formatBearingDms(b)} E`;
  if (b >= 90 && b < 180) return `S ${formatBearingDms(180 - b)} E`;
  if (b >= 180 && b < 270) return `S ${formatBearingDms(b - 180)} W`;
  return `N ${formatBearingDms(360 - b)} W`;
}

export function formatBearingMils(bearingDeg: number): number {
  return Math.round(normalizeDegrees(bearingDeg) * (6400 / 360));
}

/**
 * Formats latitude with N/S hemisphere indicator (no negative sign).
 */
export function formatLatitudeHemisphere(lat: number, decimals: number = 3): string {
  const hemi = lat < 0 ? 'S' : 'N';
  return `${Math.abs(lat).toFixed(decimals)}° ${hemi}`;
}

/**
 * Formats longitude with E/W hemisphere indicator (no negative sign).
 */
export function formatLongitudeHemisphere(lon: number, decimals: number = 3): string {
  const hemi = lon < 0 ? 'W' : 'E';
  return `${Math.abs(lon).toFixed(decimals)}° ${hemi}`;
}

/**
 * Formats a (lat, lon) coordinate pair with accurate N/S and E/W hemisphere suffixes.
 */
export function formatCoordinatesHemisphere(
  lat: number,
  lon: number,
  decimals: number = 3
): string {
  return `${formatLatitudeHemisphere(lat, decimals)}, ${formatLongitudeHemisphere(lon, decimals)}`;
}

/**
 * Spherical cross-bearing intersection from two lookout stations.
 * Returns null if stations are coincident or sightlines are parallel/diverging.
 */
export function computeTriangulation(
  t1: { latitude: number; longitude: number; elevationFt: number },
  b1Deg: number,
  t2: { latitude: number; longitude: number; elevationFt: number },
  b2Deg: number
): TriangulationSolution | null {
  const phi1 = (t1.latitude * Math.PI) / 180;
  const lambda1 = (t1.longitude * Math.PI) / 180;
  const theta1 = (b1Deg * Math.PI) / 180;

  const phi2 = (t2.latitude * Math.PI) / 180;
  const lambda2 = (t2.longitude * Math.PI) / 180;
  const theta2 = (b2Deg * Math.PI) / 180;

  const deltaPhi = phi2 - phi1;
  const deltaLambda = lambda2 - lambda1;

  const dist12 =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(deltaPhi / 2) ** 2 +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
      )
    );

  if (dist12 < 0.0001) return null;

  const thetaA = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (Math.sin(phi2) - Math.sin(phi1) * Math.cos(dist12)) /
          (Math.sin(dist12) * Math.cos(phi1))
      )
    )
  );
  const thetaB = Math.acos(
    Math.max(
      -1,
      Math.min(
        1,
        (Math.sin(phi1) - Math.sin(phi2) * Math.cos(dist12)) /
          (Math.sin(dist12) * Math.cos(phi2))
      )
    )
  );

  let theta12 = thetaA;
  let theta21 = 2 * Math.PI - thetaB;
  if (Math.sin(deltaLambda) <= 0) {
    theta12 = 2 * Math.PI - thetaA;
    theta21 = thetaB;
  }

  const alpha1 = theta1 - theta12;
  const alpha2 = theta21 - theta2;

  if (Math.sin(alpha1) === 0 && Math.sin(alpha2) === 0) return null;
  if (Math.sin(alpha1) * Math.sin(alpha2) < 0) return null;

  const cosA3 =
    -Math.cos(alpha1) * Math.cos(alpha2) +
    Math.sin(alpha1) * Math.sin(alpha2) * Math.cos(dist12);
  const alpha3 = Math.acos(Math.max(-1, Math.min(1, cosA3)));

  const dist13 = Math.atan2(
    Math.sin(dist12) * Math.sin(alpha1) * Math.sin(alpha2),
    Math.cos(alpha2) + Math.cos(alpha1) * Math.cos(alpha3)
  );

  const phi3 = Math.asin(
    Math.max(
      -1,
      Math.min(
        1,
        Math.sin(phi1) * Math.cos(dist13) +
          Math.cos(phi1) * Math.sin(dist13) * Math.cos(theta1)
      )
    )
  );
  const deltaLambda13 = Math.atan2(
    Math.sin(theta1) * Math.sin(dist13) * Math.cos(phi1),
    Math.cos(dist13) - Math.sin(phi1) * Math.sin(phi3)
  );
  const lambda3 = lambda1 + deltaLambda13;

  const lat = (phi3 * 180) / Math.PI;
  const lon = ((((lambda3 * 180) / Math.PI) + 540) % 360) - 180;

  const distA = Math.abs(dist13 * EARTH_RADIUS_KM);
  const distB = haversineDistanceKm(t2.latitude, t2.longitude, lat, lon);

  return {
    lat,
    lon,
    distFromAkm: distA,
    distFromBkm: distB,
    errorRadiusKm: Math.max(0.4, Number((distA * 0.015 + distB * 0.015).toFixed(2))),
    elevationEstFt: Math.round((t1.elevationFt + t2.elevationFt) / 2)
  };
}

/**
 * Spatial convex hull using Andrew's Monotone Chain algorithm.
 */
export function computeConvexHull(
  points: Array<{ lat: number; lon: number }>
): Array<{ lat: number; lon: number }> {
  if (points.length <= 2) return points;

  const sorted = [...points].sort((a, b) =>
    a.lon === b.lon ? a.lat - b.lat : a.lon - b.lon
  );

  const cross = (
    o: { lat: number; lon: number },
    a: { lat: number; lon: number },
    b: { lat: number; lon: number }
  ) => (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);

  const lower: Array<{ lat: number; lon: number }> = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Array<{ lat: number; lon: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Pads a cluster's points outward slightly so 2-point or 3-point thermal fronts
 * form a clean, visible tactical buffered polygon on the GIS canvas.
 */
export function buildBufferedClusterPolygon(
  incidents: IncidentPhysicsSimulation[],
  bufferKm: number = 6.5
): Array<{ lat: number; lon: number }> {
  const rawSamples: Array<{ lat: number; lon: number }> = [];
  for (const sim of incidents) {
    const { latitude, longitude } = sim.incident;
    for (let angle = 0; angle < 360; angle += 45) {
      rawSamples.push(destinationCoordinate(latitude, longitude, angle, bufferKm));
    }
  }
  return computeConvexHull(rawSamples);
}
