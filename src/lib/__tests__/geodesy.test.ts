import { describe, expect, it } from 'vitest';
import {
  computeAzimuthBearing,
  computeConvexHull,
  computeTriangulation,
  destinationCoordinate,
  formatBearingDms,
  formatBearingMils,
  formatBearingQuadrant,
  formatCoordinatesHemisphere,
  formatLatitudeHemisphere,
  formatLongitudeHemisphere,
  haversineDistanceKm
} from '../geodesy';

describe('Geodesy & Bearing Formatters', () => {
  it('round-trips destinationCoordinate with haversineDistanceKm and computeAzimuthBearing', () => {
    const origin = { lat: 37.9235, lon: -122.5965 };
    const dest = destinationCoordinate(origin.lat, origin.lon, 62.5, 125.0);

    const dist = haversineDistanceKm(origin.lat, origin.lon, dest.lat, dest.lon);
    const bearing = computeAzimuthBearing(origin.lat, origin.lon, dest.lat, dest.lon);

    expect(dist).toBeCloseTo(125.0, 2);
    expect(bearing).toBeCloseTo(62.5, 2);
  });

  it('formats DMS, quadrant, and military mils bearings including wraparound and minute carry', () => {
    expect(formatBearingDms(0)).toBe(`000° 00'`);
    expect(formatBearingDms(142.5)).toBe(`142° 30'`);
    expect(formatBearingDms(-90)).toBe(`270° 00'`);
    expect(formatBearingDms(-450)).toBe(`270° 00'`);
    expect(formatBearingDms(89.999)).toBe(`090° 00'`);

    expect(formatBearingQuadrant(45)).toBe(`N 045° 00' E`);
    expect(formatBearingQuadrant(135)).toBe(`S 045° 00' E`);
    expect(formatBearingQuadrant(225)).toBe(`S 045° 00' W`);
    expect(formatBearingQuadrant(315)).toBe(`N 045° 00' W`);

    expect(formatBearingMils(0)).toBe(0);
    expect(formatBearingMils(90)).toBe(1600);
    expect(formatBearingMils(180)).toBe(3200);
    expect(formatBearingMils(270)).toBe(4800);
  });
});

describe('Hemisphere Formatting & Cross-Bearing Triangulation (N/S/E/W)', () => {
  it('formats coordinates with accurate N/S and E/W hemisphere suffixes without negative signs', () => {
    expect(formatCoordinatesHemisphere(39.82, -121.44, 3)).toBe('39.820° N, 121.440° W');
    expect(formatCoordinatesHemisphere(38.08, 23.88, 3)).toBe('38.080° N, 23.880° E');
    expect(formatCoordinatesHemisphere(-33.18, 150.42, 3)).toBe('33.180° S, 150.420° E');
    expect(formatCoordinatesHemisphere(-8.84, -55.22, 3)).toBe('8.840° S, 55.220° W');
    expect(formatCoordinatesHemisphere(0, 0, 3)).toBe('0.000° N, 0.000° E');
    expect(formatLatitudeHemisphere(-0, 2)).toBe('0.00° N');
    expect(formatLongitudeHemisphere(-0, 2)).toBe('0.00° E');
  });

  const hemisphereCases = [
    {
      label: 'NW Hemisphere (California)',
      t1: { latitude: 37.9235, longitude: -122.5965, elevationFt: 2571 },
      t2: { latitude: 36.7328, longitude: -118.8617, elevationFt: 8502 },
      target: { lat: 39.82, lon: -121.44 },
      expectedLatHemi: 'N',
      expectedLonHemi: 'W'
    },
    {
      label: 'NE Hemisphere (Mediterranean / Greece)',
      t1: { latitude: 38.0, longitude: 22.0, elevationFt: 4200 },
      t2: { latitude: 37.5, longitude: 24.5, elevationFt: 3100 },
      target: { lat: 38.8, lon: 23.3 },
      expectedLatHemi: 'N',
      expectedLonHemi: 'E'
    },
    {
      label: 'SE Hemisphere (SE Australia)',
      t1: { latitude: -34.0, longitude: 148.5, elevationFt: 3600 },
      t2: { latitude: -35.5, longitude: 150.2, elevationFt: 2800 },
      target: { lat: -33.7, lon: 150.3 },
      expectedLatHemi: 'S',
      expectedLonHemi: 'E'
    },
    {
      label: 'SW Hemisphere (Amazonia)',
      t1: { latitude: -10.0, longitude: -57.0, elevationFt: 1200 },
      t2: { latitude: -11.5, longitude: -55.0, elevationFt: 1500 },
      target: { lat: -9.5, lon: -55.8 },
      expectedLatHemi: 'S',
      expectedLonHemi: 'W'
    }
  ] as const;

  for (const c of hemisphereCases) {
    it(`triangulates accurately in ${c.label} and formats hemisphere correctly`, () => {
      const b1 = computeAzimuthBearing(c.t1.latitude, c.t1.longitude, c.target.lat, c.target.lon);
      const b2 = computeAzimuthBearing(c.t2.latitude, c.t2.longitude, c.target.lat, c.target.lon);

      const fix = computeTriangulation(c.t1, b1, c.t2, b2);
      expect(fix).not.toBeNull();
      expect(fix!.lat).toBeCloseTo(c.target.lat, 4);
      expect(fix!.lon).toBeCloseTo(c.target.lon, 4);
      expect(fix!.distFromAkm).toBeCloseTo(
        haversineDistanceKm(c.t1.latitude, c.t1.longitude, c.target.lat, c.target.lon),
        1
      );
      expect(fix!.distFromBkm).toBeCloseTo(
        haversineDistanceKm(c.t2.latitude, c.t2.longitude, c.target.lat, c.target.lon),
        1
      );
      expect(fix!.errorRadiusKm).toBeGreaterThanOrEqual(0.4);
      expect(fix!.elevationEstFt).toBe(Math.round((c.t1.elevationFt + c.t2.elevationFt) / 2));

      const formatted = formatCoordinatesHemisphere(fix!.lat, fix!.lon, 3);
      expect(formatted).not.toContain('-');
      expect(formatted).toContain(`° ${c.expectedLatHemi},`);
      expect(formatted.endsWith(`° ${c.expectedLonHemi}`)).toBe(true);
    });
  }

  it('returns null for coincident stations or diverging sightlines', () => {
    const t1 = { latitude: 37.9235, longitude: -122.5965, elevationFt: 2571 };
    const t2 = { latitude: 36.7328, longitude: -118.8617, elevationFt: 8502 };

    expect(computeTriangulation(t1, 45, t1, 135)).toBeNull();
    expect(computeTriangulation(t1, 270, t2, 90)).toBeNull();
  });

  it('computes convex hull excluding interior points', () => {
    const hull = computeConvexHull([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 10 },
      { lat: 10, lon: 10 },
      { lat: 10, lon: 0 },
      { lat: 5, lon: 5 },
      { lat: 3, lon: 7 }
    ]);

    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ lat: 5, lon: 5 });
    expect(hull).not.toContainEqual({ lat: 3, lon: 7 });
  });
});
