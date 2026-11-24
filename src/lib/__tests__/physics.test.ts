import { describe, expect, it } from 'vitest';
import {
  FUEL_MODEL_SPECS,
  classifyAqiPm25,
  computeAlbiniSpotting,
  computeFREAndEmissions,
  computeRothermelSpread,
  computeThermalClusters,
  evaluateGaussianPlumeAt,
  getEffectiveSlopeDeg,
  getEffectiveWindBearingDeg,
  getEffectiveWindSpeedMps,
  simulateIncidentPhysics
} from '../physics';
import type { FuelModelType, WildfireIncident } from '../types';

function makeIncident(overrides: Partial<WildfireIncident> = {}): WildfireIncident {
  return {
    incident_id: 'TEST-CA-001',
    name: 'Diablo Ridge Test Front',
    region: 'CALIFORNIA',
    latitude: 39.82,
    longitude: -121.44,
    frp: 485.6,
    brightness_temp_k: 418.4,
    confidence_pct: 99,
    detection_utc: '2025-05-11T04:42:00Z',
    hours_ago: 1.5,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 12,
    slope_deg: 28,
    ambient_humidity_pct: 14,
    population_at_risk: 28400,
    wind_vector: { speed_mps: 11.8, bearing_deg: 235 },
    ...overrides
  };
}

describe('Rothermel Surface Fire Spread & Tactical Suppression', () => {
  it('computes valid physical spread metrics across all 6 fuel models', () => {
    const fuelModels = Object.keys(FUEL_MODEL_SPECS) as FuelModelType[];
    expect(fuelModels).toHaveLength(6);

    for (const fuel of fuelModels) {
      const metrics = computeRothermelSpread(makeIncident({ fuel_type: fuel }), 6.0);
      expect(metrics.rateOfSpreadMpm).toBeGreaterThan(0);
      expect(metrics.rateOfSpreadKmh).toBeCloseTo((metrics.rateOfSpreadMpm * 60) / 1000, 6);
      expect(metrics.reactionIntensityKwm2).toBeGreaterThan(0);
      expect(metrics.firelineIntensityKwm).toBeGreaterThan(0);
      expect(metrics.flameLengthM).toBeGreaterThan(0);
      expect(metrics.windFactorPhiW).toBeGreaterThan(0);
      expect(metrics.slopeFactorPhiS).toBeGreaterThan(0);
      expect(metrics.initialBurnAreaHa).toBeGreaterThan(0);
      expect(metrics.simulatedBurnAreaHa).toBeGreaterThan(metrics.initialBurnAreaHa);
      expect(metrics.ellipseMajorAxisKm).toBeGreaterThan(metrics.ellipseMinorAxisKm);
      expect(metrics.isExtinguished).toBe(false);
    }
  });

  it('increases spread rate and burn area with higher wind speed and steeper slope', () => {
    const lowWind = computeRothermelSpread(
      makeIncident({
        fuel_type: 'Tropical Rainforest',
        frp: 150,
        overrides: { windSpeedMps: 1.5, slopePct: 5, deadFuelMoisturePct: 20 }
      }),
      6.0
    );
    const highWind = computeRothermelSpread(
      makeIncident({
        fuel_type: 'Tropical Rainforest',
        frp: 150,
        overrides: { windSpeedMps: 12.0, slopePct: 5, deadFuelMoisturePct: 20 }
      }),
      6.0
    );
    const steepSlope = computeRothermelSpread(
      makeIncident({
        fuel_type: 'Tropical Rainforest',
        frp: 150,
        overrides: { windSpeedMps: 1.5, slopePct: 45, deadFuelMoisturePct: 20 }
      }),
      6.0
    );

    expect(highWind.windFactorPhiW).toBeGreaterThan(lowWind.windFactorPhiW);
    expect(highWind.rateOfSpreadMpm).toBeGreaterThan(lowWind.rateOfSpreadMpm);
    expect(highWind.simulatedBurnAreaHa).toBeGreaterThan(lowWind.simulatedBurnAreaHa);

    expect(steepSlope.slopeFactorPhiS).toBeGreaterThan(lowWind.slopeFactorPhiS);
    expect(steepSlope.rateOfSpreadMpm).toBeGreaterThan(lowWind.rateOfSpreadMpm);
    expect(steepSlope.simulatedBurnAreaHa).toBeGreaterThan(lowWind.simulatedBurnAreaHa);
  });

  it('shrinks simulatedBurnAreaHa and ellipseMajorAxisKm after VLAT retardant drops', () => {
    const base = computeRothermelSpread(makeIncident(), 6.0);
    const oneVlat = computeRothermelSpread(
      makeIncident({
        suppression: {
          vlatDrops: 1,
          dozerLineKm: 0,
          backburnActive: false,
          retardantApplied: true
        }
      }),
      6.0
    );
    const twoVlats = computeRothermelSpread(
      makeIncident({
        suppression: {
          vlatDrops: 2,
          dozerLineKm: 0,
          backburnActive: false,
          retardantApplied: true
        }
      }),
      6.0
    );

    expect(oneVlat.suppressedByRetardant).toBe(true);
    expect(oneVlat.rateOfSpreadMpm).toBeCloseTo(base.rateOfSpreadMpm * 0.35, 6);
    expect(oneVlat.flameLengthM).toBeCloseTo(base.flameLengthM * 0.5, 6);
    expect(oneVlat.effectiveContainmentPct).toBe(37);
    expect(oneVlat.ellipseMajorAxisKm).toBeLessThan(base.ellipseMajorAxisKm);
    expect(oneVlat.ellipseMinorAxisKm).toBeLessThan(base.ellipseMinorAxisKm);
    expect(oneVlat.simulatedBurnAreaHa).toBeLessThan(base.simulatedBurnAreaHa);
    expect(oneVlat.firelineIntensityKwm).toBeLessThan(base.firelineIntensityKwm);

    expect(twoVlats.effectiveContainmentPct).toBe(62);
    expect(twoVlats.ellipseMajorAxisKm).toBeLessThan(oneVlat.ellipseMajorAxisKm);
    expect(twoVlats.simulatedBurnAreaHa).toBeLessThan(oneVlat.simulatedBurnAreaHa);
  });

  it('shrinks simulatedBurnAreaHa and ellipseMajorAxisKm with backburn and dozer containment lines', () => {
    const base = computeRothermelSpread(makeIncident(), 8.0);
    const backburn = computeRothermelSpread(
      makeIncident({
        suppression: {
          vlatDrops: 0,
          dozerLineKm: 0,
          backburnActive: true,
          retardantApplied: false
        }
      }),
      8.0
    );
    const dozer = computeRothermelSpread(
      makeIncident({
        suppression: {
          vlatDrops: 0,
          dozerLineKm: 5.0,
          backburnActive: false,
          retardantApplied: false
        }
      }),
      8.0
    );
    const combined = computeRothermelSpread(
      makeIncident({
        suppression: {
          vlatDrops: 1,
          dozerLineKm: 5.0,
          backburnActive: true,
          retardantApplied: true
        }
      }),
      8.0
    );

    expect(backburn.rateOfSpreadMpm).toBeCloseTo(base.rateOfSpreadMpm * 0.65, 6);
    expect(backburn.ellipseMajorAxisKm).toBeLessThan(base.ellipseMajorAxisKm);
    expect(backburn.simulatedBurnAreaHa).toBeLessThan(base.simulatedBurnAreaHa);

    expect(dozer.effectiveContainmentPct).toBe(72);
    expect(dozer.ellipseMajorAxisKm).toBeLessThan(base.ellipseMajorAxisKm);
    expect(dozer.simulatedBurnAreaHa).toBeLessThan(base.simulatedBurnAreaHa);

    expect(combined.simulatedBurnAreaHa).toBeLessThan(backburn.simulatedBurnAreaHa);
    expect(combined.simulatedBurnAreaHa).toBeLessThan(dozer.simulatedBurnAreaHa);
  });

  it('halts forward burn growth when dead fuel moisture meets or exceeds extinction threshold', () => {
    const active = computeRothermelSpread(
      makeIncident({ fuel_type: 'Chaparral', overrides: { deadFuelMoisturePct: 10 } }),
      12.0
    );
    const extinguished = computeRothermelSpread(
      makeIncident({ fuel_type: 'Chaparral', overrides: { deadFuelMoisturePct: 32 } }),
      12.0
    );

    expect(active.isExtinguished).toBe(false);
    expect(extinguished.isExtinguished).toBe(true);
    expect(extinguished.rateOfSpreadMpm).toBe(0.05);
    expect(extinguished.flameLengthM).toBe(0.1);
    expect(extinguished.ellipseMajorAxisKm).toBeLessThan(active.ellipseMajorAxisKm);
    expect(extinguished.simulatedBurnAreaHa).toBeLessThan(active.simulatedBurnAreaHa);
    // Forward growth over 12h at 0.05 m/min (0.003 km/h) is negligible (< 0.05 km)
    expect(extinguished.simulatedBurnAreaHa - extinguished.initialBurnAreaHa).toBeLessThan(15);
  });
});

describe('Albini Spotting & FRE Biomass Combustion', () => {
  it('scales spotting distance and risk level monotonically with wind and flame length', () => {
    const low = computeAlbiniSpotting(1.0, 2.0, 0);
    const moderate = computeAlbiniSpotting(18.0, 25.0, 50);
    const high = computeAlbiniSpotting(80.0, 35.0, 60);
    const critical = computeAlbiniSpotting(250.0, 40.0, 100);

    expect(low.spottingRiskLevel).toBe('LOW');
    expect(moderate.spottingRiskLevel).toBe('MODERATE');
    expect(high.spottingRiskLevel).toBe('HIGH');
    expect(critical.spottingRiskLevel).toBe('CRITICAL');
    expect(moderate.maxSpottingDistanceKm).toBeGreaterThan(low.maxSpottingDistanceKm);
    expect(high.maxSpottingDistanceKm).toBeGreaterThan(moderate.maxSpottingDistanceKm);
    expect(critical.maxSpottingDistanceKm).toBeGreaterThan(high.maxSpottingDistanceKm);
  });

  it('integrates FRE and Wooster biomass combustion accurately', () => {
    const inc = makeIncident({ frp: 500, hours_ago: 2.0, fuel_type: 'Chaparral' });
    const fre0 = computeFREAndEmissions(inc, 0);
    const fre12 = computeFREAndEmissions(inc, 12);

    expect(fre0.biomassCombustionRateKgs).toBeCloseTo(500 * 0.368, 6);
    expect(fre0.pm25EmissionRateGs).toBeCloseTo(
      500 * 0.368 * FUEL_MODEL_SPECS.Chaparral.emissionFactorPm25,
      6
    );
    expect(fre12.freGigajoules).toBeGreaterThan(fre0.freGigajoules);
    expect(fre12.freTerajoules).toBeCloseTo(fre12.freGigajoules / 1000, 6);
    expect(fre12.severityClass).toBe('Extreme Complex');
  });
});

describe('2D Gaussian Smoke Plume & Override Propagation', () => {
  it('decays downwind along centerline and symmetrically crosswind', () => {
    const near = evaluateGaussianPlumeAt(2000, 10, 5000, 0);
    const far = evaluateGaussianPlumeAt(2000, 10, 50000, 0);
    const left = evaluateGaussianPlumeAt(2000, 10, 10000, -1200);
    const right = evaluateGaussianPlumeAt(2000, 10, 10000, 1200);
    const center = evaluateGaussianPlumeAt(2000, 10, 10000, 0);

    expect(near.concentrationUgM3).toBeGreaterThan(far.concentrationUgM3);
    expect(left.concentrationUgM3).toBeCloseTo(right.concentrationUgM3, 8);
    expect(center.concentrationUgM3).toBeGreaterThan(left.concentrationUgM3);
  });

  it('respects incident.overrides in Gaussian plume concentrations, drift corridors, and helpers', () => {
    const baseInc = makeIncident({
      wind_vector: { speed_mps: 10.0, bearing_deg: 200 },
      slope_deg: 20
    });
    const overriddenInc = makeIncident({
      wind_vector: { speed_mps: 10.0, bearing_deg: 200 },
      slope_deg: 20,
      overrides: {
        windSpeedMps: 25.0,
        windBearingDeg: 45,
        slopePct: 40
      }
    });

    expect(getEffectiveWindSpeedMps(overriddenInc)).toBe(25.0);
    expect(getEffectiveWindBearingDeg(overriddenInc)).toBe(45);
    expect(getEffectiveSlopeDeg(overriddenInc)).toBe(40);

    const baseSim = simulateIncidentPhysics(baseInc, 6.0);
    const overriddenSim = simulateIncidentPhysics(overriddenInc, 6.0);

    // Stronger wind dilutes PM2.5 at the same downwind distance (C ~ 1/u)
    expect(overriddenSim.plumeProfile[0].centerlinePm25).toBeLessThan(
      baseSim.plumeProfile[0].centerlinePm25
    );
    expect(overriddenSim.plumeProfile[0].centerlinePm25).toBeCloseTo(
      baseSim.plumeProfile[0].centerlinePm25 * (10.0 / 25.0),
      5
    );

    // Stronger wind extends smoke transport corridors downwind
    expect(overriddenSim.corridor6hKm).toBeGreaterThan(baseSim.corridor6hKm);
    expect(overriddenSim.corridor12hKm).toBeGreaterThan(baseSim.corridor12hKm);
    expect(overriddenSim.corridor24hKm).toBeGreaterThan(baseSim.corridor24hKm);
    expect(overriddenSim.activeSimCorridorKm).toBeGreaterThan(baseSim.activeSimCorridorKm);
  });

  it('classifies AQI PM2.5 thresholds accurately', () => {
    expect(classifyAqiPm25(5).aqiCategory).toBe('Good');
    expect(classifyAqiPm25(25).aqiCategory).toBe('Moderate');
    expect(classifyAqiPm25(80).aqiCategory).toBe('Unhealthy');
    expect(classifyAqiPm25(180).aqiCategory).toBe('Very Unhealthy');
    expect(classifyAqiPm25(300).aqiCategory).toBe('Hazardous');
  });

  it('clusters proximate thermal hotspots and isolates distant ones', () => {
    const sims = [
      simulateIncidentPhysics(makeIncident({ incident_id: 'A', latitude: 39.82, longitude: -121.44 }), 6),
      simulateIncidentPhysics(makeIncident({ incident_id: 'B', latitude: 39.85, longitude: -121.40 }), 6),
      simulateIncidentPhysics(makeIncident({ incident_id: 'C', latitude: -33.18, longitude: 150.42 }), 6)
    ];

    const clusters = computeThermalClusters(sims, 15);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].incidents).toHaveLength(2);
    expect(clusters[0].hullPoints.length).toBeGreaterThanOrEqual(3);
    expect(clusters[0].perimeterKm).toBeGreaterThan(0);
    expect(clusters[0].aggregateFrpMw).toBeCloseTo(sims[0].incident.frp + sims[1].incident.frp, 4);
  });
});
