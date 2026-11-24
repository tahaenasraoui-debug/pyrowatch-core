import { describe, expect, it } from 'vitest';
import {
  parseFirmsCsv,
  parseFirmsGeoJson,
  parseFirmsPayload,
  serializeIncidentsToCsv,
  serializeIncidentsToGeoJson
} from '../firmsParser';
import { INITIAL_FIRMS_INCIDENTS } from '../incidents';
import { FUEL_MODEL_SPECS, simulateIncidentPhysics } from '../physics';

describe('NASA FIRMS CSV Parser', () => {
  it('parses standard FIRMS CSV rows including quoted fields, confidence codes, and zero values', () => {
    const csv = [
      'incident_id,name,latitude,longitude,frp,bright_ti4,confidence,acq_date,hours_ago,satellite_sensor,fuel_type,estimated_containment_pct,slope_deg,wind_speed_mps,wind_bearing_deg',
      'FIRMS-01,"Tahoe Basin, North Ridge",39.09,-120.03,512.4,421.8,h,2025-05-11T04:00:00Z,0,VIIRS NOAA-20,Chaparral,0,0,14.8,0',
      'FIRMS-02,Corsica Scrub,41.42,9.18,345.6,393.5,nominal,2025-05-11T03:00:00Z,2.5,MODIS Aqua,Mediterranean Scrub,20,26,12.5,110',
      'FIRMS-03,Savanna Low Conf,-14.62,18.84,180.0,360.0,L,2025-05-11T02:00:00Z,4.0,UnknownSensor,UnknownFuel,15,5,9.0,270'
    ].join('\r\n');

    const records = parseFirmsPayload(csv);
    expect(records).toHaveLength(3);

    expect(records[0]).toMatchObject({
      incident_id: 'FIRMS-01',
      name: 'Tahoe Basin, North Ridge',
      latitude: 39.09,
      longitude: -120.03,
      frp: 512.4,
      brightness_temp_k: 421.8,
      confidence_pct: 96,
      hours_ago: 0,
      satellite_sensor: 'VIIRS NOAA-20',
      fuel_type: 'Chaparral',
      estimated_containment_pct: 0,
      slope_deg: 0,
      wind_vector: { speed_mps: 14.8, bearing_deg: 0 }
    });

    expect(records[1].confidence_pct).toBe(84);
    expect(records[1].satellite_sensor).toBe('MODIS Aqua');
    expect(records[1].fuel_type).toBe('Mediterranean Scrub');

    // Unknown sensors / fuels fall back to valid schema enums so physics never crashes
    expect(records[2].confidence_pct).toBe(45);
    expect(records[2].satellite_sensor).toBe('VIIRS NOAA-20');
    expect(records[2].fuel_type).toBe('Chaparral');
    expect(FUEL_MODEL_SPECS[records[2].fuel_type]).toBeDefined();
  });

  it('skips invalid/out-of-range coordinate rows and throws on empty or header-only CSV', () => {
    const mixedCsv = [
      'latitude,longitude,frp',
      'not_a_number,-120.0,200',
      '95.0,10.0,200',
      '-33.2,150.4,410.5'
    ].join('\n');

    const records = parseFirmsCsv(mixedCsv);
    expect(records).toHaveLength(1);
    expect(records[0].latitude).toBe(-33.2);
    expect(records[0].longitude).toBe(150.4);
    expect(records[0].frp).toBe(410.5);

    expect(() => parseFirmsPayload('   ')).toThrow(/empty/i);
    expect(() => parseFirmsCsv('latitude,longitude,frp')).toThrow(/at least 1/i);
    expect(() => parseFirmsCsv('latitude,longitude\nabc,def')).toThrow(/no valid coordinate/i);
  });
});

describe('NASA FIRMS GeoJSON & JSON Parser', () => {
  it('parses GeoJSON FeatureCollection respecting [lon, lat] coordinate order', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [150.42, -33.18] },
          properties: {
            incident_id: 'GEO-AUS-1',
            name: 'Blue Mountains Spot',
            frp: 490.2,
            bright_ti4: 415.0,
            confidence: 'high',
            satellite_sensor: 'VIIRS SNPP',
            fuel_type: 'Eucalyptus Bush',
            wind_speed_mps: 15.0,
            wind_bearing_deg: 0
          }
        }
      ]
    });

    const records = parseFirmsPayload(geojson);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      incident_id: 'GEO-AUS-1',
      name: 'Blue Mountains Spot',
      latitude: -33.18,
      longitude: 150.42,
      frp: 490.2,
      brightness_temp_k: 415.0,
      confidence_pct: 96,
      satellite_sensor: 'VIIRS SNPP',
      fuel_type: 'Eucalyptus Bush',
      wind_vector: { speed_mps: 15.0, bearing_deg: 0 }
    });
  });

  it('parses raw JSON arrays and single GeoJSON Feature objects', () => {
    const jsonArray = JSON.stringify([
      {
        incident_id: 'ARR-1',
        lat: -8.84,
        lon: -55.22,
        frp: 320,
        fuel_type: 'Tropical Rainforest',
        wind_vector: { speed_mps: 8.5, bearing_deg: 255 }
      }
    ]);
    const arrRecords = parseFirmsGeoJson(jsonArray);
    expect(arrRecords).toHaveLength(1);
    expect(arrRecords[0].latitude).toBe(-8.84);
    expect(arrRecords[0].longitude).toBe(-55.22);
    expect(arrRecords[0].fuel_type).toBe('Tropical Rainforest');
    expect(arrRecords[0].wind_vector).toEqual({ speed_mps: 8.5, bearing_deg: 255 });

    const singleFeature = JSON.stringify({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [23.88, 38.08] },
      properties: { name: 'Attica Single Feature', frp: 380 }
    });
    const singleRecords = parseFirmsGeoJson(singleFeature);
    expect(singleRecords).toHaveLength(1);
    expect(singleRecords[0].latitude).toBe(38.08);
    expect(singleRecords[0].longitude).toBe(23.88);
  });

  it('throws on invalid JSON or GeoJSON with no valid coordinates', () => {
    expect(() => parseFirmsGeoJson('{ bad json')).toThrow();
    expect(() =>
      parseFirmsGeoJson(JSON.stringify({ type: 'FeatureCollection', features: [] }))
    ).toThrow(/no valid coordinate/i);
  });
});

describe('Telemetry Export & Re-Ingestion Round-Trip', () => {
  it('round-trips exported CSV and GeoJSON payloads cleanly including wind overrides', () => {
    const sample = INITIAL_FIRMS_INCIDENTS.slice(0, 3).map((inc, idx) =>
      idx === 0
        ? { ...inc, overrides: { windSpeedMps: 24.5, windBearingDeg: 95 } }
        : inc
    );
    const sims = sample.map((inc) => simulateIncidentPhysics(inc, 6.0));

    const csv = serializeIncidentsToCsv(sims);
    const reParsedCsv = parseFirmsPayload(csv);
    expect(reParsedCsv).toHaveLength(3);
    expect(reParsedCsv[0].incident_id).toBe(sample[0].incident_id);
    expect(reParsedCsv[0].name).toBe(sample[0].name);
    expect(reParsedCsv[0].fuel_type).toBe(sample[0].fuel_type);
    expect(reParsedCsv[0].frp).toBeCloseTo(sample[0].frp, 1);
    expect(reParsedCsv[0].wind_vector.speed_mps).toBeCloseTo(24.5, 1);
    expect(reParsedCsv[0].wind_vector.bearing_deg).toBe(95);

    const geojson = serializeIncidentsToGeoJson(sims, 6.0);
    const reParsedGeo = parseFirmsPayload(geojson);
    expect(reParsedGeo).toHaveLength(3);
    expect(reParsedGeo[0].incident_id).toBe(sample[0].incident_id);
    expect(reParsedGeo[0].wind_vector.speed_mps).toBeCloseTo(24.5, 1);
    expect(reParsedGeo[0].wind_vector.bearing_deg).toBe(95);
  });
});
