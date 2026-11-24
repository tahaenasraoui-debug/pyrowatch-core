import { getEffectiveWindBearingDeg, getEffectiveWindSpeedMps } from './physics';
import type {
  FuelModelType,
  IncidentPhysicsSimulation,
  SatelliteSensor,
  WildfireIncident
} from './types';

const VALID_SENSORS = new Set<SatelliteSensor>([
  'VIIRS SNPP',
  'VIIRS NOAA-20',
  'MODIS Terra',
  'MODIS Aqua'
]);

const VALID_FUEL_MODELS = new Set<FuelModelType>([
  'Chaparral',
  'Boreal Forest',
  'Mediterranean Scrub',
  'Eucalyptus Bush',
  'Savanna Grassland',
  'Tropical Rainforest'
]);

function parseFiniteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(num) ? num : fallback;
}

function parseFiniteCoordinate(value: unknown): number {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(num) ? num : Number.NaN;
}

function parseConfidence(value: unknown, fallback: number = 90): number {
  if (value === null || value === undefined || value === '') return fallback;
  const str = String(value).trim().toLowerCase();
  if (str === 'h' || str === 'high') return 96;
  if (str === 'n' || str === 'nominal') return 84;
  if (str === 'l' || str === 'low') return 45;
  const num = Number(str);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, num));
}

function normalizeSensor(value: unknown, fallback: SatelliteSensor): SatelliteSensor {
  if (typeof value === 'string') {
    const trimmed = value.trim() as SatelliteSensor;
    if (VALID_SENSORS.has(trimmed)) return trimmed;
  }
  return fallback;
}

function normalizeFuelType(value: unknown, fallback: FuelModelType = 'Chaparral'): FuelModelType {
  if (typeof value === 'string') {
    const trimmed = value.trim() as FuelModelType;
    if (VALID_FUEL_MODELS.has(trimmed)) return trimmed;
  }
  return fallback;
}

function isValidLatLon(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Splits a single CSV line into trimmed fields, supporting quoted cells and escaped quotes.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses a GeoJSON FeatureCollection, single Feature, or JSON array of FIRMS anomalies.
 */
export function parseFirmsGeoJson(rawText: string): WildfireIncident[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Empty payload provided to FIRMS GeoJSON parser.');
  }

  const json: unknown = JSON.parse(trimmed);
  let features: unknown[] = [];

  if (Array.isArray(json)) {
    features = json;
  } else if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.features)) {
      features = obj.features;
    } else if (obj.type === 'Feature') {
      features = [obj];
    }
  }

  const parsedIncidents: WildfireIncident[] = [];
  const batchSuffix = Date.now().toString().slice(-4);

  features.forEach((rawFeature, idx) => {
    if (!rawFeature || typeof rawFeature !== 'object') return;
    const f = rawFeature as Record<string, unknown>;
    const props =
      f.properties && typeof f.properties === 'object'
        ? (f.properties as Record<string, unknown>)
        : f;

    const geometry =
      f.geometry && typeof f.geometry === 'object'
        ? (f.geometry as Record<string, unknown>)
        : undefined;
    const coords = Array.isArray(geometry?.coordinates)
      ? (geometry.coordinates as unknown[])
      : undefined;

    const lon = parseFiniteCoordinate(coords?.[0] ?? props.lon ?? props.longitude);
    const lat = parseFiniteCoordinate(coords?.[1] ?? props.lat ?? props.latitude);
    if (!isValidLatLon(lat, lon)) return;

    const windObj =
      props.wind_vector && typeof props.wind_vector === 'object'
        ? (props.wind_vector as Record<string, unknown>)
        : undefined;

    const rawId = typeof props.incident_id === 'string' ? props.incident_id.trim() : '';
    const rawName = typeof props.name === 'string' ? props.name.trim() : '';
    const rawUtc = typeof props.detection_utc === 'string' ? props.detection_utc.trim() : '';

    parsedIncidents.push({
      incident_id: rawId || `FIRMS-ING-${batchSuffix}-${idx + 1}`,
      name: rawName || `Ingested Thermal Anomaly #${idx + 1}`,
      region: 'GLOBAL',
      latitude: lat,
      longitude: lon,
      frp: parseFiniteNumber(props.frp ?? props.frp_mw, 215.0),
      brightness_temp_k: parseFiniteNumber(
        props.bright_ti4 ?? props.brightness_temp_k ?? props.brightness,
        375.0
      ),
      confidence_pct: parseConfidence(props.confidence_pct ?? props.confidence, 90),
      detection_utc: rawUtc || new Date().toISOString(),
      hours_ago: parseFiniteNumber(props.hours_ago, 1.0),
      satellite_sensor: normalizeSensor(props.satellite_sensor, 'VIIRS SNPP'),
      fuel_type: normalizeFuelType(props.fuel_type, 'Chaparral'),
      estimated_containment_pct: parseFiniteNumber(props.estimated_containment_pct, 10),
      slope_deg: parseFiniteNumber(props.slope_deg, 18),
      ambient_humidity_pct: parseFiniteNumber(props.ambient_humidity_pct, 16),
      population_at_risk: Math.round(parseFiniteNumber(props.population_at_risk, 15000)),
      wind_vector: {
        speed_mps: parseFiniteNumber(props.wind_speed_mps ?? windObj?.speed_mps, 10.5),
        bearing_deg: parseFiniteNumber(props.wind_bearing_deg ?? windObj?.bearing_deg, 120)
      }
    });
  });

  if (parsedIncidents.length === 0) {
    throw new Error('No valid coordinate records found in payload.');
  }

  return parsedIncidents;
}

/**
 * Parses NASA FIRMS NRT CSV records with automatic schema normalization.
 */
export function parseFirmsCsv(rawText: string): WildfireIncident[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Empty payload provided to FIRMS CSV parser.');
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must include header row and at least 1 telemetry record.');
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const parsedIncidents: WildfireIncident[] = [];
  const batchSuffix = Date.now().toString().slice(-4);

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, cIdx) => {
      row[h] = cols[cIdx] ?? '';
    });

    const lat = parseFiniteCoordinate(row.latitude || row.lat);
    const lon = parseFiniteCoordinate(row.longitude || row.lon);
    if (!isValidLatLon(lat, lon)) continue;

    const confNum = parseConfidence(row.confidence_pct || row.confidence, 92);

    parsedIncidents.push({
      incident_id: row.incident_id || `FIRMS-CSV-${batchSuffix}-${i}`,
      name: row.name || `FIRMS NRT Spot (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
      region: 'GLOBAL',
      latitude: lat,
      longitude: lon,
      frp: parseFiniteNumber(row.frp || row.frp_mw, 240.0),
      brightness_temp_k: parseFiniteNumber(
        row.brightness_temp_k || row.bright_ti4 || row.brightness,
        382.0
      ),
      confidence_pct: confNum,
      detection_utc: row.detection_utc || row.acq_date || new Date().toISOString(),
      hours_ago: parseFiniteNumber(row.hours_ago, 1.2),
      satellite_sensor: normalizeSensor(row.satellite_sensor, 'VIIRS NOAA-20'),
      fuel_type: normalizeFuelType(row.fuel_type, 'Chaparral'),
      estimated_containment_pct: parseFiniteNumber(row.estimated_containment_pct, 12),
      slope_deg: parseFiniteNumber(row.slope_deg, 21),
      ambient_humidity_pct: parseFiniteNumber(row.ambient_humidity_pct, 15),
      population_at_risk: Math.round(parseFiniteNumber(row.population_at_risk, 18500)),
      wind_vector: {
        speed_mps: parseFiniteNumber(row.wind_speed_mps, 11.2),
        bearing_deg: parseFiniteNumber(row.wind_bearing_deg, 140)
      }
    });
  }

  if (parsedIncidents.length === 0) {
    throw new Error('No valid coordinate records found in payload.');
  }

  return parsedIncidents;
}

/**
 * Auto-detects and parses either NASA FIRMS GeoJSON/JSON or CSV payloads.
 */
export function parseFirmsPayload(rawText: string): WildfireIncident[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Empty payload provided to FIRMS parser.');
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseFirmsGeoJson(trimmed);
  }
  return parseFirmsCsv(trimmed);
}

/**
 * Serializes simulated telemetry incidents to CSV format.
 */
export function serializeIncidentsToCsv(
  simulatedIncidents: IncidentPhysicsSimulation[]
): string {
  const headers = [
    'incident_id',
    'name',
    'latitude',
    'longitude',
    'frp_mw',
    'brightness_temp_k',
    'confidence_pct',
    'satellite_sensor',
    'fuel_type',
    'rate_of_spread_mpm',
    'fireline_intensity_kwm',
    'fre_tj',
    'simulated_area_ha',
    'wind_speed_mps',
    'wind_bearing_deg'
  ];

  const rows = simulatedIncidents.map((s) =>
    [
      s.incident.incident_id,
      `"${s.incident.name.replace(/"/g, '""')}"`,
      s.incident.latitude.toFixed(4),
      s.incident.longitude.toFixed(4),
      s.incident.frp.toFixed(1),
      s.incident.brightness_temp_k.toFixed(1),
      s.incident.confidence_pct,
      `"${s.incident.satellite_sensor}"`,
      `"${s.incident.fuel_type}"`,
      s.rothermel.rateOfSpreadMpm.toFixed(2),
      s.rothermel.firelineIntensityKwm.toFixed(0),
      s.fre.freTerajoules.toFixed(2),
      s.rothermel.simulatedBurnAreaHa.toFixed(0),
      getEffectiveWindSpeedMps(s.incident).toFixed(1),
      getEffectiveWindBearingDeg(s.incident).toFixed(0)
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Serializes simulated telemetry incidents to a GeoJSON FeatureCollection string.
 */
export function serializeIncidentsToGeoJson(
  simulatedIncidents: IncidentPhysicsSimulation[],
  simHourOffset: number
): string {
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      generator: 'PyroWatch-Core Neovim Scientific Telemetry Engine',
      simulation_hour_offset: simHourOffset,
      exported_utc: new Date().toISOString()
    },
    features: simulatedIncidents.map((s) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [s.incident.longitude, s.incident.latitude]
      },
      properties: {
        ...s.incident,
        wind_speed_mps: getEffectiveWindSpeedMps(s.incident),
        wind_bearing_deg: getEffectiveWindBearingDeg(s.incident),
        rothermel_spread_mpm: Number(s.rothermel.rateOfSpreadMpm.toFixed(2)),
        fireline_intensity_kwm: Number(s.rothermel.firelineIntensityKwm.toFixed(0)),
        fre_terajoules: Number(s.fre.freTerajoules.toFixed(2)),
        pm25_emission_gs: Number(s.fre.pm25EmissionRateGs.toFixed(1)),
        simulated_burn_area_ha: Number(s.rothermel.simulatedBurnAreaHa.toFixed(1))
      }
    }))
  };

  return JSON.stringify(geojson, null, 2);
}
