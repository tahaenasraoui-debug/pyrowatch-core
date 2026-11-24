import { buildBufferedClusterPolygon, haversineDistanceKm } from './geodesy';
import type {
  AlbiniSpottingMetrics,
  FREMetrics,
  FuelModelPhysicalSpec,
  FuelModelType,
  IncidentPhysicsSimulation,
  PlumeConcentrationPoint,
  RothermelMetrics,
  ThermalCluster,
  WildfireIncident
} from './types';

export const FUEL_MODEL_SPECS: Record<FuelModelType, FuelModelPhysicalSpec> = {
  Chaparral: {
    code: 'FBFM-SH7 (Heavy California Chaparral)',
    fuelLoadKgM2: 3.45,
    savRatio: 5400,
    bedDepthM: 1.8,
    heatContentKjKg: 19800,
    moistureExtinction: 0.3,
    packingRatioBeta: 0.0038,
    emissionFactorPm25: 14.2,
    colorHex: '#f97316'
  },
  'Boreal Forest': {
    code: 'FBFM-TU5 (High-Load Boreal Conifer Timber)',
    fuelLoadKgM2: 4.1,
    savRatio: 4900,
    bedDepthM: 0.65,
    heatContentKjKg: 18600,
    moistureExtinction: 0.25,
    packingRatioBeta: 0.0115,
    emissionFactorPm25: 18.5,
    colorHex: '#10b981'
  },
  'Mediterranean Scrub': {
    code: 'FBFM-SH5 (Garrigue / Maquis Dry Scrub)',
    fuelLoadKgM2: 2.65,
    savRatio: 6100,
    bedDepthM: 1.3,
    heatContentKjKg: 19400,
    moistureExtinction: 0.28,
    packingRatioBeta: 0.0041,
    emissionFactorPm25: 13.0,
    colorHex: '#eab308'
  },
  'Eucalyptus Bush': {
    code: 'FBFM-SB4 (Sclerophyll Eucalyptus Stringybark)',
    fuelLoadKgM2: 3.9,
    savRatio: 5800,
    bedDepthM: 1.5,
    heatContentKjKg: 20400,
    moistureExtinction: 0.24,
    packingRatioBeta: 0.0052,
    emissionFactorPm25: 16.8,
    colorHex: '#ef4444'
  },
  'Savanna Grassland': {
    code: 'FBFM-GR7 (Dry Tropical Tall Savanna Grass)',
    fuelLoadKgM2: 1.45,
    savRatio: 7200,
    bedDepthM: 0.9,
    heatContentKjKg: 18000,
    moistureExtinction: 0.18,
    packingRatioBeta: 0.0029,
    emissionFactorPm25: 9.8,
    colorHex: '#f59e0b'
  },
  'Tropical Rainforest': {
    code: 'FBFM-TL9 (Broadleaf Canopy & Slash Litter)',
    fuelLoadKgM2: 3.2,
    savRatio: 4200,
    bedDepthM: 0.45,
    heatContentKjKg: 18200,
    moistureExtinction: 0.35,
    packingRatioBeta: 0.014,
    emissionFactorPm25: 19.4,
    colorHex: '#84cc16'
  }
};

export function getEffectiveWindSpeedMps(incident: WildfireIncident): number {
  return incident.overrides?.windSpeedMps ?? incident.wind_vector.speed_mps;
}

export function getEffectiveWindBearingDeg(incident: WildfireIncident): number {
  return incident.overrides?.windBearingDeg ?? incident.wind_vector.bearing_deg;
}

export function getEffectiveSlopeDeg(incident: WildfireIncident): number {
  return incident.overrides?.slopePct ?? incident.slope_deg;
}

/**
 * Albini (1979) firebrand spotting distance estimation.
 */
export function computeAlbiniSpotting(
  flameLengthM: number,
  windSpeedMps: number,
  slopePct: number
): AlbiniSpottingMetrics {
  const flameHeightM = Math.max(0.5, flameLengthM * 0.75);
  const slopeFactor = 1.0 + Math.min(1.2, slopePct / 100);
  const rawDistKm =
    0.00078 * (windSpeedMps * 3.6) * Math.sqrt(flameHeightM) * slopeFactor * 1.35;
  const maxSpottingDistanceKm = Math.max(0.05, Number(rawDistKm.toFixed(2)));

  let spottingRiskLevel: AlbiniSpottingMetrics['spottingRiskLevel'] = 'LOW';
  if (maxSpottingDistanceKm > 2.5) spottingRiskLevel = 'CRITICAL';
  else if (maxSpottingDistanceKm > 1.2) spottingRiskLevel = 'HIGH';
  else if (maxSpottingDistanceKm > 0.4) spottingRiskLevel = 'MODERATE';

  return {
    maxSpottingDistanceKm,
    spottingRiskLevel,
    flameHeightM
  };
}

/**
 * ROTHERMEL SURFACE FIRE SPREAD MODEL (1972) + ANDERSON ELLIPTICAL GROWTH (1983)
 * Computes Rate of Spread R (m/min), Reaction Intensity I_R, Wind Factor phi_w,
 * Slope Factor phi_s, Byram's Fireline Intensity I_B (kW/m), Flame Length L_f (m),
 * and Elliptical Burn Growth after applying extinction and tactical suppression.
 */
export function computeRothermelSpread(
  incident: WildfireIncident,
  simHourOffset: number
): RothermelMetrics {
  const spec = FUEL_MODEL_SPECS[incident.fuel_type];

  const effWindSpeed = getEffectiveWindSpeedMps(incident);
  const effHumidity =
    incident.overrides?.deadFuelMoisturePct !== undefined
      ? incident.overrides.deadFuelMoisturePct
      : incident.ambient_humidity_pct;
  const effSlope = getEffectiveSlopeDeg(incident);

  const fuelMoistureFraction =
    incident.overrides?.deadFuelMoisturePct !== undefined
      ? incident.overrides.deadFuelMoisturePct / 100
      : Math.max(0.03, Math.min(spec.moistureExtinction * 0.92, (effHumidity / 100) * 0.42));

  const isExtinguished = fuelMoistureFraction >= spec.moistureExtinction;
  const rM = fuelMoistureFraction / spec.moistureExtinction;

  // Moisture damping coefficient (eta_M)
  const etaM = Math.max(
    0.08,
    1.0 - 2.59 * rM + 5.11 * Math.pow(rM, 2) - 3.52 * Math.pow(rM, 3)
  );

  // Optimum packing ratio beta_op (Rothermel 1972 eq. 37, converted to SI)
  const savImperial = spec.savRatio / 3.28084; // 1/ft
  const betaOp = 3.348 * Math.pow(savImperial, -0.8189);
  const betaRatio = spec.packingRatioBeta / betaOp;

  // Maximum reaction velocity Gamma'_max (min^-1)
  const A = 133.0 * Math.pow(savImperial, -0.7913);
  const gammaMax =
    Math.pow(savImperial, 1.5) / (495.0 + 0.0594 * Math.pow(savImperial, 1.5));
  const gammaPrime = gammaMax * Math.pow(betaRatio, A) * Math.exp(A * (1.0 - betaRatio));

  // Mineral damping coefficient eta_S (typical silica content ~ 0.055)
  const etaS = 0.41739;

  // Reaction Intensity I_R (kW/m^2)
  const reactionIntensityKwm2 =
    (gammaPrime * spec.fuelLoadKgM2 * spec.heatContentKjKg * etaM * etaS) / 60.0;

  // Propagating flux ratio xi
  const xi =
    Math.exp((0.792 + 0.681 * Math.sqrt(savImperial)) * (spec.packingRatioBeta + 0.1)) /
    (192.0 + 0.2595 * savImperial);

  // Wind factor phi_W (using midflame wind speed ~ 0.48 * 10m wind speed, in ft/min)
  const midflameWindMps = effWindSpeed * 0.48;
  const midflameWindFtMin = midflameWindMps * 196.85;
  const C = 7.47 * Math.exp(-0.133 * Math.pow(savImperial, 0.55));
  const B = 0.02526 * Math.pow(savImperial, 0.54);
  const E = 0.715 * Math.exp(-0.000359 * savImperial);
  const windFactorPhiW = C * Math.pow(midflameWindFtMin, B) * Math.pow(betaRatio, -E);

  // Slope factor phi_S = 5.275 * beta^-0.3 * (tan theta)^2
  const tanSlope = Math.tan((effSlope * Math.PI) / 180);
  const slopeFactorPhiS =
    5.275 * Math.pow(spec.packingRatioBeta, -0.3) * Math.pow(tanSlope, 2);

  // Heat of preignition Q_ig (kJ/kg) and effective heating number epsilon
  const qIg = 581.0 + 2594.0 * fuelMoistureFraction;
  const epsilon = Math.exp(-452.8 / savImperial);
  const bulkDensityRhoB = spec.fuelLoadKgM2 / spec.bedDepthM;

  // Rate of Spread R (m/min) with FRP radiative coupling multiplier
  const frpBoost = 1.0 + Math.log10(Math.max(10, incident.frp)) * 0.18;
  const rawR =
    ((reactionIntensityKwm2 * 60.0 * xi * (1.0 + windFactorPhiW + slopeFactorPhiS)) /
      (bulkDensityRhoB * epsilon * qIg)) *
    frpBoost;

  const rateOfSpreadMpm = Math.max(0.8, Math.min(98.0, rawR));
  const rateOfSpreadKmh = (rateOfSpreadMpm * 60) / 1000;

  // Byram's Fireline Intensity I_B (kW/m) & Flame Length L_f (m)
  const residenceTimeMin = 384.0 / savImperial;
  const heatPerUnitAreaKjM2 = reactionIntensityKwm2 * 60.0 * residenceTimeMin;
  const baselineFirelineIntensityKwm = (heatPerUnitAreaKjM2 * rateOfSpreadMpm) / 60.0;
  const baselineFlameLengthM =
    0.0775 * Math.pow(Math.max(1, baselineFirelineIntensityKwm), 0.46);

  // Apply moisture extinction and VLAT/backburn suppression BEFORE projecting forward burn area
  let finalRosMpm = rateOfSpreadMpm;
  let finalFlameM = baselineFlameLengthM;
  let suppressedByRetardant = false;

  if (isExtinguished) {
    finalRosMpm = 0.05;
    finalFlameM = 0.1;
  } else {
    if (incident.suppression?.retardantApplied) {
      finalRosMpm *= 0.35;
      finalFlameM *= 0.5;
      suppressedByRetardant = true;
    }
    if (incident.suppression?.backburnActive) {
      finalRosMpm *= 0.65;
    }
  }

  const finalRosKmh = (finalRosMpm * 60) / 1000;
  const firelineIntensityKwm = (heatPerUnitAreaKjM2 * finalRosMpm) / 60.0;
  const effectiveContainmentPct = Math.min(
    100,
    incident.estimated_containment_pct +
      (incident.suppression?.vlatDrops || 0) * 25 +
      (incident.suppression?.dozerLineKm || 0) * 12
  );

  // Elliptical Fire Area Estimation (Anderson 1983 length-to-breadth ratio LB)
  const lbRatio =
    0.936 * Math.exp(0.2566 * midflameWindMps) +
    0.461 * Math.exp(-0.1548 * midflameWindMps) -
    0.397;
  const clampedLb = Math.max(1.1, Math.min(8.0, lbRatio));

  // Initial burned area based on FRP & active burn duration
  const activeBurnHours = Math.max(2.0, Math.min(36.0, incident.hours_ago + 4.0));
  const baselineContainmentDamping =
    1.0 - (incident.estimated_containment_pct / 100) * 0.65;
  const initialMajorKm = Math.max(
    0.6,
    rateOfSpreadKmh * Math.sqrt(activeBurnHours) * 0.72 * baselineContainmentDamping
  );
  const initialMinorKm = initialMajorKm / clampedLb;
  const initialBurnAreaHa =
    Math.PI * (initialMajorKm / 2) * (initialMinorKm / 2) * 100;

  // Forward simulation expansion (+simHourOffset hours) using post-suppression spread & containment
  const effectiveContainmentDamping = 1.0 - (effectiveContainmentPct / 100) * 0.65;
  const ellipseMajorAxisKm =
    initialMajorKm + finalRosKmh * simHourOffset * effectiveContainmentDamping;
  const ellipseMinorAxisKm = ellipseMajorAxisKm / clampedLb;
  const simulatedBurnAreaHa =
    Math.PI * (ellipseMajorAxisKm / 2) * (ellipseMinorAxisKm / 2) * 100;

  const spotting = computeAlbiniSpotting(finalFlameM, effWindSpeed, effSlope);

  return {
    rateOfSpreadMpm: finalRosMpm,
    rateOfSpreadKmh: finalRosKmh,
    reactionIntensityKwm2,
    firelineIntensityKwm,
    flameLengthM: finalFlameM,
    windFactorPhiW,
    slopeFactorPhiS,
    initialBurnAreaHa,
    simulatedBurnAreaHa,
    ellipseMajorAxisKm,
    ellipseMinorAxisKm,
    spotting,
    isExtinguished,
    suppressedByRetardant,
    effectiveContainmentPct
  };
}

/**
 * FIRE RADIATIVE ENERGY (FRE) & BIOMASS COMBUSTION ENGINE
 * Integrates FRP (MW = MJ/s) over time into Gigajoules (GJ) and Terajoules (TJ),
 * computes biomass consumption rate (Wooster et al. 2005 factor: 0.368 kg/MJ),
 * and derives source PM2.5 emission rate Q (g/s).
 */
export function computeFREAndEmissions(
  incident: WildfireIncident,
  simHourOffset: number
): FREMetrics {
  const spec = FUEL_MODEL_SPECS[incident.fuel_type];

  // Effective integration window (hours) accounting for diurnal cycle + forward sim
  const integrationHours = Math.max(
    3.0,
    Math.min(48.0, incident.hours_ago + 4.0 + simHourOffset)
  );
  const diurnalModulation = 0.78; // Accounts for overnight radiative dip
  const freMegajoules = incident.frp * integrationHours * 3600 * diurnalModulation;
  const freGigajoules = freMegajoules / 1000;
  const freTerajoules = freGigajoules / 1000;

  // Wooster et al. (2005) radiative-to-biomass conversion coefficient: 0.368 kg/MJ
  const biomassCombustionRateKgs = incident.frp * 0.368;

  // Emission rate Q (g/s of PM2.5) = biomass rate (kg/s) * EF_PM25 (g/kg)
  const pm25EmissionRateGs = biomassCombustionRateKgs * spec.emissionFactorPm25;

  let severityClass: FREMetrics['severityClass'] = 'Low';
  let severityColor = '#22c55e';
  if (incident.frp >= 400 || freTerajoules >= 18) {
    severityClass = 'Extreme Complex';
    severityColor = '#ef4444';
  } else if (incident.frp >= 260 || freTerajoules >= 9) {
    severityClass = 'High';
    severityColor = '#f97316';
  } else if (incident.frp >= 150 || freTerajoules >= 4) {
    severityClass = 'Moderate';
    severityColor = '#f59e0b';
  }

  return {
    freGigajoules,
    freTerajoules,
    biomassCombustionRateKgs,
    pm25EmissionRateGs,
    severityClass,
    severityColor
  };
}

/**
 * ATMOSPHERIC DISPERSION & 2D GAUSSIAN SMOKE PLUME MODEL
 * C(x, y) = (Q / (2 * pi * u * sigma_y * sigma_z)) * exp(-y^2 / (2 * sigma_y^2))
 * using Pasquill-Gifford stability class C dispersion parameterization.
 */
export function evaluateGaussianPlumeAt(
  Q_gs: number,
  windSpeedMps: number,
  downwindMeters: number,
  crosswindMeters: number
): { concentrationUgM3: number; sigmaY: number; sigmaZ: number } {
  const u = Math.max(1.5, windSpeedMps);
  const x = Math.max(500, downwindMeters);

  // Pasquill-Gifford Class C (convective thermal buoyancy plume) dispersion coefficients (m)
  const sigmaY = 0.11 * x * Math.pow(1.0 + 0.0001 * x, -0.5);
  const sigmaZ = 0.08 * x * Math.pow(1.0 + 0.0002 * x, -0.5);

  // Convert Q from g/s to ug/s (1 g = 1e6 ug)
  const Q_ugs = Q_gs * 1e6;

  // 2D Gaussian Plume equation
  const prefactor = Q_ugs / (2.0 * Math.PI * u * sigmaY * sigmaZ);
  const lateralDecay = Math.exp(
    -(crosswindMeters * crosswindMeters) / (2.0 * sigmaY * sigmaY)
  );

  const concentrationUgM3 = prefactor * lateralDecay;
  return { concentrationUgM3, sigmaY, sigmaZ };
}

export function classifyAqiPm25(pm25: number): {
  aqiCategory: PlumeConcentrationPoint['aqiCategory'];
  colorHex: string;
} {
  if (pm25 >= 250) return { aqiCategory: 'Hazardous', colorHex: '#ef4444' };
  if (pm25 >= 150) return { aqiCategory: 'Very Unhealthy', colorHex: '#f97316' };
  if (pm25 >= 55) return { aqiCategory: 'Unhealthy', colorHex: '#f59e0b' };
  if (pm25 >= 15) return { aqiCategory: 'Moderate', colorHex: '#eab308' };
  return { aqiCategory: 'Good', colorHex: '#10b981' };
}

export const PLUME_SAMPLE_DISTANCES_KM = [5, 10, 20, 35, 50, 75, 100] as const;

/**
 * Full single-incident physics simulation combining Rothermel spread, FRE emissions,
 * 2D Gaussian smoke dispersion, and drift corridors while respecting incident.overrides.
 */
export function simulateIncidentPhysics(
  incident: WildfireIncident,
  simHourOffset: number
): IncidentPhysicsSimulation {
  const rothermel = computeRothermelSpread(incident, simHourOffset);
  const fre = computeFREAndEmissions(incident, simHourOffset);
  const effectiveWindSpeed = getEffectiveWindSpeedMps(incident);

  const plumeProfile: PlumeConcentrationPoint[] = PLUME_SAMPLE_DISTANCES_KM.map((distKm) => {
    const { concentrationUgM3, sigmaY, sigmaZ } = evaluateGaussianPlumeAt(
      fre.pm25EmissionRateGs,
      effectiveWindSpeed,
      distKm * 1000,
      0
    );
    const { aqiCategory, colorHex } = classifyAqiPm25(concentrationUgM3);
    return {
      distanceKm: distKm,
      centerlinePm25: concentrationUgM3,
      sigmaY,
      sigmaZ,
      aqiCategory,
      colorHex
    };
  });

  // Smoke drift transport corridors (km downwind at 6h, 12h, 24h)
  // Effective transport velocity in planetary boundary layer ~ 0.62 * wind_speed_mps
  const effectiveDriftKmh = effectiveWindSpeed * 3.6 * 0.62;
  const corridor6hKm = Math.max(18, effectiveDriftKmh * 6);
  const corridor12hKm = Math.max(36, effectiveDriftKmh * 12);
  const corridor24hKm = Math.max(72, effectiveDriftKmh * 24);
  const activeSimCorridorKm = Math.max(
    corridor6hKm * 0.45,
    effectiveDriftKmh * Math.max(2, simHourOffset)
  );

  return {
    incident,
    rothermel,
    fre,
    plumeProfile,
    corridor6hKm,
    corridor12hKm,
    corridor24hKm,
    activeSimCorridorKm
  };
}

/**
 * Connected-components spatial clustering of proximate thermal anomalies (<= clusterRadiusKm).
 */
export function computeThermalClusters(
  simulatedIncidents: IncidentPhysicsSimulation[],
  clusterRadiusKm: number
): ThermalCluster[] {
  const n = simulatedIncidents.length;
  const visited = new Array<boolean>(n).fill(false);
  const clusters: ThermalCluster[] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const component: IncidentPhysicsSimulation[] = [];
    const queue: number[] = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const currIdx = queue.shift()!;
      const currSim = simulatedIncidents[currIdx];
      component.push(currSim);

      for (let j = 0; j < n; j++) {
        if (visited[j]) continue;
        const dist = haversineDistanceKm(
          currSim.incident.latitude,
          currSim.incident.longitude,
          simulatedIncidents[j].incident.latitude,
          simulatedIncidents[j].incident.longitude
        );
        if (dist <= clusterRadiusKm) {
          visited[j] = true;
          queue.push(j);
        }
      }
    }

    if (component.length >= 2) {
      const sumLat = component.reduce((acc, s) => acc + s.incident.latitude, 0);
      const sumLon = component.reduce((acc, s) => acc + s.incident.longitude, 0);
      const centroid = {
        lat: sumLat / component.length,
        lon: sumLon / component.length
      };

      const hullPoints = buildBufferedClusterPolygon(component, 6.0);
      let perimeterKm = 0;
      for (let k = 0; k < hullPoints.length; k++) {
        const p1 = hullPoints[k];
        const p2 = hullPoints[(k + 1) % hullPoints.length];
        perimeterKm += haversineDistanceKm(p1.lat, p1.lon, p2.lat, p2.lon);
      }

      const aggregateFrpMw = component.reduce((acc, s) => acc + s.incident.frp, 0);
      const maxRateOfSpreadMpm = Math.max(
        ...component.map((s) => s.rothermel.rateOfSpreadMpm)
      );
      const totalPopulationAtRisk = component.reduce(
        (acc, s) => acc + s.incident.population_at_risk,
        0
      );

      const baseName = component[0].incident.name.split(' - ')[0];
      clusters.push({
        cluster_id: `COMPLEX-${clusters.length + 1}`,
        name: `${baseName} Thermal Front (${component.length} Spots)`,
        incidents: component,
        centroid,
        hullPoints,
        aggregateFrpMw,
        maxRateOfSpreadMpm,
        totalPopulationAtRisk,
        perimeterKm
      });
    }
  }

  return clusters;
}
