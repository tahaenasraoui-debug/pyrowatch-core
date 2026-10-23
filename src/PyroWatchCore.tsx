import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Flame,
  Wind,
  Activity,
  Compass,
  Layers,
  Filter,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Satellite,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Thermometer,
  ShieldAlert,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Sliders,
  FileText,
  CheckCircle2,
  Sparkles,
  Eye,
  Clock,
  BarChart3,
  Terminal,
  Search,
  Code2,
  Table,
  GitBranch,
  Cpu,
  Palette,
  Command
} from 'lucide-react';

// ============================================================================
// 0. NEOVIM COLORSCHEME ENGINE (5 ICONIC CUSTOM THEMES)
// ============================================================================

export type NvimThemeId =
  | 'tokyonight-storm'
  | 'catppuccin-mocha'
  | 'gruvbox-material'
  | 'kanagawa-wave'
  | 'rose-pine';

export interface NvimThemePalette {
  id: NvimThemeId;
  label: string;
  shortName: string;
  bg: string;        // Main editor / ocean backdrop
  mantle: string;    // Darker sidebar / statusline / landmass fill
  crust: string;     // Deepest border / terminal backdrop
  surface: string;   // Floating window / card surface
  border: string;    // Crisp 1px split border
  fg: string;        // Primary syntax foreground
  subtext: string;   // Secondary identifier text
  comment: string;   // Line numbers & comments
  blue: string;      // Keywords / Functions / Normal Mode
  magenta: string;   // Types / Structs / Telescope Mode
  red: string;       // Extreme FRP / Errors / Sim-Run Mode
  orange: string;    // Constants / High FRP / Numbers
  yellow: string;    // Strings / Moderate FRP / Warnings
  green: string;     // Low FRP / Git branch / Insert Mode
  cyan: string;      // Operators / Coordinates / Fields
}

export const NVIM_THEMES: Record<NvimThemeId, NvimThemePalette> = {
  'tokyonight-storm': {
    id: 'tokyonight-storm',
    label: 'TokyoNight Storm',
    shortName: 'tokyonight',
    bg: '#1a1b26',
    mantle: '#16161e',
    crust: '#111219',
    surface: '#24283b',
    border: '#3b4261',
    fg: '#c0caf5',
    subtext: '#a9b1d6',
    comment: '#565f89',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    red: '#f7768e',
    orange: '#ff9e64',
    yellow: '#e0af68',
    green: '#9ece6a',
    cyan: '#7dcfff'
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    shortName: 'catppuccin',
    bg: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
    surface: '#313244',
    border: '#45475a',
    fg: '#cdd6f4',
    subtext: '#bac2de',
    comment: '#6c7086',
    blue: '#89b4fa',
    magenta: '#cba6f7',
    red: '#f38ba8',
    orange: '#fab387',
    yellow: '#f9e2af',
    green: '#a6e3a1',
    cyan: '#94e2d5'
  },
  'gruvbox-material': {
    id: 'gruvbox-material',
    label: 'Gruvbox Material',
    shortName: 'gruvbox',
    bg: '#1d2021',
    mantle: '#141617',
    crust: '#0e1010',
    surface: '#282828',
    border: '#504945',
    fg: '#d4be98',
    subtext: '#ddc7a1',
    comment: '#7c6f64',
    blue: '#7daea3',
    magenta: '#d3869b',
    red: '#ea6962',
    orange: '#e78a4e',
    yellow: '#d8a657',
    green: '#a9b665',
    cyan: '#89b482'
  },
  'kanagawa-wave': {
    id: 'kanagawa-wave',
    label: 'Kanagawa Wave',
    shortName: 'kanagawa',
    bg: '#1f1f28',
    mantle: '#16161d',
    crust: '#111117',
    surface: '#2a2a37',
    border: '#54546d',
    fg: '#dcd7ba',
    subtext: '#c8c093',
    comment: '#727169',
    blue: '#7e9cd8',
    magenta: '#957fb8',
    red: '#e46876',
    orange: '#ffa066',
    yellow: '#dca561',
    green: '#98bb6c',
    cyan: '#6a9589'
  },
  'rose-pine': {
    id: 'rose-pine',
    label: 'Rosé Pine',
    shortName: 'rose-pine',
    bg: '#191724',
    mantle: '#1f1d2e',
    crust: '#14121d',
    surface: '#26233a',
    border: '#403d52',
    fg: '#e0def4',
    subtext: '#908caa',
    comment: '#6e6a86',
    blue: '#31748f',
    magenta: '#c4a7e7',
    red: '#eb6f92',
    orange: '#ea9a97',
    yellow: '#f6c177',
    green: '#9ccfd8',
    cyan: '#ebbcba'
  }
};

export type ActiveBufferTab = 'VIEWPORT_GIS' | 'FIRMS_TABLE_CSV' | 'ROTHERMEL_CORE_RS';

// ============================================================================
// 1. TYPE DEFINITIONS & INTERFACES
// ============================================================================

export type SatelliteSensor = 'VIIRS SNPP' | 'VIIRS NOAA-20' | 'MODIS Terra' | 'MODIS Aqua';

export type FuelModelType =
  | 'Chaparral'
  | 'Boreal Forest'
  | 'Mediterranean Scrub'
  | 'Eucalyptus Bush'
  | 'Savanna Grassland'
  | 'Tropical Rainforest';

export type TheaterRegion =
  | 'GLOBAL'
  | 'CALIFORNIA'
  | 'MEDITERRANEAN'
  | 'BOREAL_CANADA'
  | 'AUSTRALIA'
  | 'AMAZONIA'
  | 'SAVANNA_AFRICA';

export interface WindVector {
  speed_mps: number;   // meters per second at 10m height
  bearing_deg: number; // direction wind is blowing TOWARDS (0 = N, 90 = E, 180 = S, 270 = W)
}

export interface WildfireIncident {
  incident_id: string;
  name: string;
  region: TheaterRegion;
  latitude: number;
  longitude: number;
  frp: number; // Fire Radiative Power in Megawatts (MW)
  brightness_temp_k: number; // Kelvin (Channel I4 / MODIS B21)
  confidence_pct: number; // 0 - 100%
  detection_utc: string; // ISO timestamp
  hours_ago: number; // Hours prior to current epoch for temporal scrubbing
  satellite_sensor: SatelliteSensor;
  fuel_type: FuelModelType;
  estimated_containment_pct: number;
  slope_deg: number; // Ambient topographic slope grade in degrees
  ambient_humidity_pct: number; // Relative humidity %
  population_at_risk: number; // Downwind/proximate population within 25km
  wind_vector: WindVector;
}

export interface RothermelMetrics {
  rateOfSpreadMpm: number;      // R in meters / minute
  rateOfSpreadKmh: number;      // R in km / hour
  reactionIntensityKwm2: number;// I_R in kW/m^2
  firelineIntensityKwm: number; // Byram's intensity I_B in kW/m
  flameLengthM: number;         // Flame length L_f in meters
  windFactorPhiW: number;       // Dimensionless wind multiplier
  slopeFactorPhiS: number;      // Dimensionless slope multiplier
  initialBurnAreaHa: number;    // Estimated current area (hectares)
  simulatedBurnAreaHa: number;  // Projected area after +simHours
  ellipseMajorAxisKm: number;   // Downwind elliptical spread length (km)
  ellipseMinorAxisKm: number;   // Crosswind elliptical spread width (km)
}

export interface PlumeConcentrationPoint {
  distanceKm: number;
  centerlinePm25: number;       // ug/m^3 along plume axis (y = 0)
  sigmaY: number;               // Horizontal dispersion coeff (m)
  sigmaZ: number;               // Vertical dispersion coeff (m)
  aqiCategory: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  colorHex: string;
}

export interface FREMetrics {
  freGigajoules: number;        // Time-integrated Fire Radiative Energy (GJ)
  freTerajoules: number;        // Time-integrated Fire Radiative Energy (TJ)
  biomassCombustionRateKgs: number; // kg/s of dry biomass consumed
  pm25EmissionRateGs: number;   // Q in grams/second of PM2.5
  severityClass: 'Low' | 'Moderate' | 'High' | 'Extreme Complex';
  severityColor: string;
}

export interface IncidentPhysicsSimulation {
  incident: WildfireIncident;
  rothermel: RothermelMetrics;
  fre: FREMetrics;
  plumeProfile: PlumeConcentrationPoint[];
  corridor6hKm: number;
  corridor12hKm: number;
  corridor24hKm: number;
  activeSimCorridorKm: number;
}

export interface ThermalCluster {
  cluster_id: string;
  name: string;
  incidents: IncidentPhysicsSimulation[];
  centroid: { lat: number; lon: number };
  hullPoints: Array<{ lat: number; lon: number }>;
  aggregateFrpMw: number;
  maxRateOfSpreadMpm: number;
  totalPopulationAtRisk: number;
  perimeterKm: number;
}

export interface GISFilterState {
  minFrp: number;
  minConfidence: number;
  lookbackHours: number; // 6, 24, 48, 168 (7d)
  selectedSensors: SatelliteSensor[];
  selectedFuels: FuelModelType[];
  clusterRadiusKm: number;
  searchQuery: string;
}

export interface LayerVisibility {
  plumeCones: boolean;
  clusterHulls: boolean;
  pulseRings: boolean;
  thermalHeatmap: boolean;
  windVectors: boolean;
  graticuleGrid: boolean;
}

// ============================================================================
// 2. SCIENTIFIC FUEL & DISPERSION CONSTANTS (ROTHERMEL & PASQUILL-GIFFORD)
// ============================================================================

interface FuelModelPhysicalSpec {
  code: string;
  fuelLoadKgM2: number;         // w_0: Ovendry fuel load (kg/m^2)
  savRatio: number;             // sigma: Surface-area-to-volume ratio (m^-1)
  bedDepthM: number;            // delta: Fuel bed depth (m)
  heatContentKjKg: number;      // h: Low heat content (kJ/kg)
  moistureExtinction: number;   // M_x: Moisture of extinction (fraction)
  packingRatioBeta: number;     // beta: Packing ratio
  emissionFactorPm25: number;   // g PM2.5 per kg dry fuel burned
  colorHex: string;
}

const FUEL_MODEL_SPECS: Record<FuelModelType, FuelModelPhysicalSpec> = {
  'Chaparral': {
    code: 'FBFM-SH7 (Heavy California Chaparral)',
    fuelLoadKgM2: 3.45,
    savRatio: 5400,
    bedDepthM: 1.8,
    heatContentKjKg: 19800,
    moistureExtinction: 0.30,
    packingRatioBeta: 0.0038,
    emissionFactorPm25: 14.2,
    colorHex: '#f97316'
  },
  'Boreal Forest': {
    code: 'FBFM-TU5 (High-Load Boreal Conifer Timber)',
    fuelLoadKgM2: 4.10,
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
    fuelLoadKgM2: 3.90,
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
    fuelLoadKgM2: 3.20,
    savRatio: 4200,
    bedDepthM: 0.45,
    heatContentKjKg: 18200,
    moistureExtinction: 0.35,
    packingRatioBeta: 0.0140,
    emissionFactorPm25: 19.4,
    colorHex: '#84cc16'
  }
};

const THEATER_PRESETS: Record<
  TheaterRegion,
  { label: string; centerLat: number; centerLon: number; zoom: number; subtitle: string }
> = {
  GLOBAL: {
    label: 'Global Command',
    centerLat: 16,
    centerLon: 8,
    zoom: 1.0,
    subtitle: 'Planetary FIRMS Thermal Constellation'
  },
  CALIFORNIA: {
    label: 'California / West US',
    centerLat: 37.8,
    centerLon: -120.5,
    zoom: 5.8,
    subtitle: 'Sierra Nevada & Coast Range Chaparral'
  },
  MEDITERRANEAN: {
    label: 'Mediterranean Basin',
    centerLat: 38.2,
    centerLon: 20.5,
    zoom: 5.4,
    subtitle: 'Aegean, Peloponnese & Iberian Scrub'
  },
  BOREAL_CANADA: {
    label: 'Canadian Boreal',
    centerLat: 58.2,
    centerLon: -115.0,
    zoom: 5.0,
    subtitle: 'Athabasca & Great Slave Taiga Shield'
  },
  AUSTRALIA: {
    label: 'SE Australia Bush',
    centerLat: -34.5,
    centerLon: 149.2,
    zoom: 5.5,
    subtitle: 'Blue Mountains & Victorian Alps Eucalyptus'
  },
  AMAZONIA: {
    label: 'Amazonia / Cerrado',
    centerLat: -9.8,
    centerLon: -56.5,
    zoom: 4.8,
    subtitle: 'Mato Grosso & Pará Deforestation Arc'
  },
  SAVANNA_AFRICA: {
    label: 'Central African Savanna',
    centerLat: -12.2,
    centerLon: 20.5,
    zoom: 5.0,
    subtitle: 'Angola & Zambezi Miombo Grasslands'
  }
};

// ============================================================================
// 3. SYNTHETIC HIGH-FIDELITY NASA FIRMS + EONET DATASET (56 INCIDENTS)
// ============================================================================
// Geographically clustered so proximate points (<15km) tessellate into active
// thermal front polygons while spanning all 6 critical global fire regimes.

const INITIAL_FIRMS_INCIDENTS: WildfireIncident[] = [
  // --- CLUSTER 1: NORTHERN CALIFORNIA (Mendocino / Plumas Complex - <15km apart) ---
  {
    incident_id: 'FIRMS-CA-001',
    name: 'Diablo Ridge Complex - Alpha Front',
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
    wind_vector: { speed_mps: 11.8, bearing_deg: 235 }
  },
  {
    incident_id: 'FIRMS-CA-002',
    name: 'Diablo Ridge Complex - Feather Canyon',
    region: 'CALIFORNIA',
    latitude: 39.88,
    longitude: -121.38,
    frp: 392.0,
    brightness_temp_k: 399.2,
    confidence_pct: 97,
    detection_utc: '2025-05-11T04:42:00Z',
    hours_ago: 1.5,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 15,
    slope_deg: 31,
    ambient_humidity_pct: 15,
    population_at_risk: 19200,
    wind_vector: { speed_mps: 12.4, bearing_deg: 240 }
  },
  {
    incident_id: 'FIRMS-CA-003',
    name: 'Diablo Ridge Complex - Bucks Summit',
    region: 'CALIFORNIA',
    latitude: 39.77,
    longitude: -121.36,
    frp: 318.4,
    brightness_temp_k: 386.7,
    confidence_pct: 94,
    detection_utc: '2025-05-11T03:15:00Z',
    hours_ago: 3.0,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 20,
    slope_deg: 24,
    ambient_humidity_pct: 16,
    population_at_risk: 14500,
    wind_vector: { speed_mps: 10.9, bearing_deg: 232 }
  },
  {
    incident_id: 'FIRMS-CA-004',
    name: 'Diablo Ridge Complex - Oroville Foothills',
    region: 'CALIFORNIA',
    latitude: 39.74,
    longitude: -121.48,
    frp: 274.1,
    brightness_temp_k: 374.5,
    confidence_pct: 92,
    detection_utc: '2025-05-11T02:50:00Z',
    hours_ago: 3.5,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 22,
    slope_deg: 19,
    ambient_humidity_pct: 17,
    population_at_risk: 34100,
    wind_vector: { speed_mps: 11.2, bearing_deg: 238 }
  },

  // --- CLUSTER 2: SOUTHERN CALIFORNIA (Santa Ynez / Angeles Crest Cluster) ---
  {
    incident_id: 'FIRMS-CA-005',
    name: 'Santa Ynez Sundowner Fire - East',
    region: 'CALIFORNIA',
    latitude: 34.52,
    longitude: -119.78,
    frp: 412.8,
    brightness_temp_k: 408.1,
    confidence_pct: 98,
    detection_utc: '2025-05-11T05:10:00Z',
    hours_ago: 1.1,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 8,
    slope_deg: 34,
    ambient_humidity_pct: 11,
    population_at_risk: 62000,
    wind_vector: { speed_mps: 14.5, bearing_deg: 195 }
  },
  {
    incident_id: 'FIRMS-CA-006',
    name: 'Santa Ynez Sundowner Fire - Montecito Ridge',
    region: 'CALIFORNIA',
    latitude: 34.48,
    longitude: -119.69,
    frp: 356.2,
    brightness_temp_k: 395.0,
    confidence_pct: 96,
    detection_utc: '2025-05-11T05:10:00Z',
    hours_ago: 1.1,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 10,
    slope_deg: 32,
    ambient_humidity_pct: 12,
    population_at_risk: 54800,
    wind_vector: { speed_mps: 13.8, bearing_deg: 190 }
  },
  {
    incident_id: 'FIRMS-CA-007',
    name: 'Santa Ynez Sundowner Fire - Gibraltar Dam',
    region: 'CALIFORNIA',
    latitude: 34.56,
    longitude: -119.71,
    frp: 245.9,
    brightness_temp_k: 369.4,
    confidence_pct: 91,
    detection_utc: '2025-05-11T01:20:00Z',
    hours_ago: 5.0,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 18,
    slope_deg: 27,
    ambient_humidity_pct: 14,
    population_at_risk: 29000,
    wind_vector: { speed_mps: 12.1, bearing_deg: 198 }
  },
  {
    incident_id: 'FIRMS-CA-008',
    name: 'San Gabriel Canyon Brush Fire',
    region: 'CALIFORNIA',
    latitude: 34.26,
    longitude: -117.88,
    frp: 198.4,
    brightness_temp_k: 362.0,
    confidence_pct: 89,
    detection_utc: '2025-05-10T21:00:00Z',
    hours_ago: 9.2,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 35,
    slope_deg: 29,
    ambient_humidity_pct: 19,
    population_at_risk: 78500,
    wind_vector: { speed_mps: 9.4, bearing_deg: 215 }
  },
  {
    incident_id: 'FIRMS-CA-009',
    name: 'Clear Lake Mendocino Complex',
    region: 'CALIFORNIA',
    latitude: 39.12,
    longitude: -122.74,
    frp: 164.0,
    brightness_temp_k: 354.2,
    confidence_pct: 86,
    detection_utc: '2025-05-10T14:30:00Z',
    hours_ago: 16.0,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 48,
    slope_deg: 21,
    ambient_humidity_pct: 22,
    population_at_risk: 16300,
    wind_vector: { speed_mps: 7.8, bearing_deg: 110 }
  },
  {
    incident_id: 'FIRMS-CA-010',
    name: 'Klamath Basin Timber Anomaly',
    region: 'CALIFORNIA',
    latitude: 41.58,
    longitude: -123.12,
    frp: 289.5,
    brightness_temp_k: 381.0,
    confidence_pct: 93,
    detection_utc: '2025-05-09T22:15:00Z',
    hours_ago: 32.0,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 28,
    slope_deg: 26,
    ambient_humidity_pct: 24,
    population_at_risk: 8400,
    wind_vector: { speed_mps: 8.6, bearing_deg: 65 }
  },

  // --- CLUSTER 3: MEDITERRANEAN BASIN (Attica / Evia Greece Cluster & Iberia) ---
  {
    incident_id: 'FIRMS-MED-001',
    name: 'Mount Penteli Attica Front - North',
    region: 'MEDITERRANEAN',
    latitude: 38.08,
    longitude: 23.88,
    frp: 428.0,
    brightness_temp_k: 411.5,
    confidence_pct: 99,
    detection_utc: '2025-05-11T04:55:00Z',
    hours_ago: 1.3,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 14,
    slope_deg: 27,
    ambient_humidity_pct: 16,
    population_at_risk: 112000,
    wind_vector: { speed_mps: 13.6, bearing_deg: 165 }
  },
  {
    incident_id: 'FIRMS-MED-002',
    name: 'Mount Penteli Attica Front - Marathon Ridge',
    region: 'MEDITERRANEAN',
    latitude: 38.14,
    longitude: 23.94,
    frp: 345.2,
    brightness_temp_k: 392.8,
    confidence_pct: 96,
    detection_utc: '2025-05-11T04:55:00Z',
    hours_ago: 1.3,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 18,
    slope_deg: 25,
    ambient_humidity_pct: 17,
    population_at_risk: 84000,
    wind_vector: { speed_mps: 13.1, bearing_deg: 168 }
  },
  {
    incident_id: 'FIRMS-MED-003',
    name: 'Mount Penteli Attica Front - Dionisos Spur',
    region: 'MEDITERRANEAN',
    latitude: 38.11,
    longitude: 23.81,
    frp: 298.7,
    brightness_temp_k: 384.1,
    confidence_pct: 95,
    detection_utc: '2025-05-11T02:10:00Z',
    hours_ago: 4.1,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 22,
    slope_deg: 23,
    ambient_humidity_pct: 18,
    population_at_risk: 95000,
    wind_vector: { speed_mps: 12.4, bearing_deg: 162 }
  },
  {
    incident_id: 'FIRMS-MED-004',
    name: 'North Evia Pine & Maquis Complex - Limni',
    region: 'MEDITERRANEAN',
    latitude: 38.78,
    longitude: 23.32,
    frp: 312.5,
    brightness_temp_k: 389.0,
    confidence_pct: 94,
    detection_utc: '2025-05-10T23:40:00Z',
    hours_ago: 6.8,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 25,
    slope_deg: 29,
    ambient_humidity_pct: 19,
    population_at_risk: 24500,
    wind_vector: { speed_mps: 10.8, bearing_deg: 175 }
  },
  {
    incident_id: 'FIRMS-MED-005',
    name: 'North Evia Complex - Rovies Ridge',
    region: 'MEDITERRANEAN',
    latitude: 38.83,
    longitude: 23.25,
    frp: 268.0,
    brightness_temp_k: 376.4,
    confidence_pct: 91,
    detection_utc: '2025-05-10T23:40:00Z',
    hours_ago: 6.8,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 30,
    slope_deg: 26,
    ambient_humidity_pct: 20,
    population_at_risk: 18900,
    wind_vector: { speed_mps: 10.2, bearing_deg: 172 }
  },
  {
    incident_id: 'FIRMS-MED-006',
    name: 'Peloponnese Ilia Garrigue Fire',
    region: 'MEDITERRANEAN',
    latitude: 37.65,
    longitude: 21.62,
    frp: 215.4,
    brightness_temp_k: 368.2,
    confidence_pct: 88,
    detection_utc: '2025-05-10T16:00:00Z',
    hours_ago: 14.5,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 42,
    slope_deg: 20,
    ambient_humidity_pct: 23,
    population_at_risk: 31200,
    wind_vector: { speed_mps: 9.1, bearing_deg: 150 }
  },
  {
    incident_id: 'FIRMS-MED-007',
    name: 'Antalya Taurus Foothills Anomaly',
    region: 'MEDITERRANEAN',
    latitude: 36.88,
    longitude: 31.42,
    frp: 334.0,
    brightness_temp_k: 391.2,
    confidence_pct: 95,
    detection_utc: '2025-05-10T11:20:00Z',
    hours_ago: 19.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 31,
    slope_deg: 30,
    ambient_humidity_pct: 17,
    population_at_risk: 46000,
    wind_vector: { speed_mps: 11.4, bearing_deg: 140 }
  },
  {
    incident_id: 'FIRMS-MED-008',
    name: 'Calabria Aspromonte Ridge Fire',
    region: 'MEDITERRANEAN',
    latitude: 38.16,
    longitude: 15.92,
    frp: 184.6,
    brightness_temp_k: 359.8,
    confidence_pct: 85,
    detection_utc: '2025-05-09T18:00:00Z',
    hours_ago: 36.5,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 55,
    slope_deg: 28,
    ambient_humidity_pct: 25,
    population_at_risk: 27400,
    wind_vector: { speed_mps: 8.3, bearing_deg: 125 }
  },
  {
    incident_id: 'FIRMS-MED-009',
    name: 'Chefchaouen Rif Scrub Anomaly',
    region: 'MEDITERRANEAN',
    latitude: 35.17,
    longitude: -5.26,
    frp: 229.0,
    brightness_temp_k: 371.0,
    confidence_pct: 90,
    detection_utc: '2025-05-08T15:00:00Z',
    hours_ago: 63.0,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 68,
    slope_deg: 26,
    ambient_humidity_pct: 21,
    population_at_risk: 22800,
    wind_vector: { speed_mps: 9.7, bearing_deg: 280 }
  },

  // --- CLUSTER 4: CANADIAN BOREAL SHIELD (Wood Buffalo / Athabasca Cluster) ---
  {
    incident_id: 'FIRMS-BOR-001',
    name: 'Athabasca Crown Complex - Sector 1',
    region: 'BOREAL_CANADA',
    latitude: 58.62,
    longitude: -111.45,
    frp: 612.4,
    brightness_temp_k: 434.2,
    confidence_pct: 100,
    detection_utc: '2025-05-11T05:30:00Z',
    hours_ago: 0.8,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 5,
    slope_deg: 9,
    ambient_humidity_pct: 18,
    population_at_risk: 4200,
    wind_vector: { speed_mps: 13.2, bearing_deg: 105 }
  },
  {
    incident_id: 'FIRMS-BOR-002',
    name: 'Athabasca Crown Complex - Birch River',
    region: 'BOREAL_CANADA',
    latitude: 58.69,
    longitude: -111.34,
    frp: 548.0,
    brightness_temp_k: 425.8,
    confidence_pct: 99,
    detection_utc: '2025-05-11T05:30:00Z',
    hours_ago: 0.8,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 5,
    slope_deg: 8,
    ambient_humidity_pct: 19,
    population_at_risk: 3100,
    wind_vector: { speed_mps: 12.9, bearing_deg: 108 }
  },
  {
    incident_id: 'FIRMS-BOR-003',
    name: 'Athabasca Crown Complex - Lake Claire Flank',
    region: 'BOREAL_CANADA',
    latitude: 58.56,
    longitude: -111.55,
    frp: 472.3,
    brightness_temp_k: 414.0,
    confidence_pct: 98,
    detection_utc: '2025-05-11T04:15:00Z',
    hours_ago: 2.0,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 8,
    slope_deg: 7,
    ambient_humidity_pct: 20,
    population_at_risk: 2800,
    wind_vector: { speed_mps: 12.4, bearing_deg: 102 }
  },
  {
    incident_id: 'FIRMS-BOR-004',
    name: 'High Level Zama Taiga Complex - West',
    region: 'BOREAL_CANADA',
    latitude: 58.75,
    longitude: -118.65,
    frp: 389.0,
    brightness_temp_k: 398.5,
    confidence_pct: 96,
    detection_utc: '2025-05-11T01:45:00Z',
    hours_ago: 4.5,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 15,
    slope_deg: 11,
    ambient_humidity_pct: 21,
    population_at_risk: 5600,
    wind_vector: { speed_mps: 10.6, bearing_deg: 95 }
  },
  {
    incident_id: 'FIRMS-BOR-005',
    name: 'High Level Zama Taiga Complex - East',
    region: 'BOREAL_CANADA',
    latitude: 58.79,
    longitude: -118.51,
    frp: 342.1,
    brightness_temp_k: 390.1,
    confidence_pct: 94,
    detection_utc: '2025-05-11T01:45:00Z',
    hours_ago: 4.5,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 15,
    slope_deg: 10,
    ambient_humidity_pct: 22,
    population_at_risk: 4900,
    wind_vector: { speed_mps: 10.4, bearing_deg: 98 }
  },
  {
    incident_id: 'FIRMS-BOR-006',
    name: 'Great Slave Shield Lightning Complex',
    region: 'BOREAL_CANADA',
    latitude: 61.42,
    longitude: -114.28,
    frp: 418.7,
    brightness_temp_k: 405.3,
    confidence_pct: 97,
    detection_utc: '2025-05-10T19:30:00Z',
    hours_ago: 11.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 12,
    slope_deg: 6,
    ambient_humidity_pct: 23,
    population_at_risk: 19500,
    wind_vector: { speed_mps: 11.1, bearing_deg: 120 }
  },
  {
    incident_id: 'FIRMS-BOR-007',
    name: 'Peace River Muskeg Burn',
    region: 'BOREAL_CANADA',
    latitude: 56.24,
    longitude: -117.32,
    frp: 235.6,
    brightness_temp_k: 369.8,
    confidence_pct: 89,
    detection_utc: '2025-05-09T20:00:00Z',
    hours_ago: 34.0,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 40,
    slope_deg: 12,
    ambient_humidity_pct: 26,
    population_at_risk: 11200,
    wind_vector: { speed_mps: 8.5, bearing_deg: 88 }
  },
  {
    incident_id: 'FIRMS-BOR-008',
    name: 'Yakutia Lena Basin Permafrost Fire',
    region: 'BOREAL_CANADA',
    latitude: 62.85,
    longitude: 129.40,
    frp: 465.0,
    brightness_temp_k: 412.6,
    confidence_pct: 98,
    detection_utc: '2025-05-10T12:00:00Z',
    hours_ago: 18.5,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 0,
    slope_deg: 8,
    ambient_humidity_pct: 20,
    population_at_risk: 14800,
    wind_vector: { speed_mps: 11.8, bearing_deg: 75 }
  },

  // --- CLUSTER 5: SE AUSTRALIA EUCALYPTUS BUSH (Blue Mountains / Wollemi Cluster) ---
  {
    incident_id: 'FIRMS-AUS-001',
    name: 'Gospers Mountain Megafire - Crown Ridge',
    region: 'AUSTRALIA',
    latitude: -33.18,
    longitude: 150.42,
    frp: 538.9,
    brightness_temp_k: 424.0,
    confidence_pct: 99,
    detection_utc: '2025-05-11T05:00:00Z',
    hours_ago: 1.2,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 10,
    slope_deg: 29,
    ambient_humidity_pct: 12,
    population_at_risk: 48500,
    wind_vector: { speed_mps: 14.2, bearing_deg: 115 }
  },
  {
    incident_id: 'FIRMS-AUS-002',
    name: 'Gospers Mountain Megafire - Colo Gorge',
    region: 'AUSTRALIA',
    latitude: -33.24,
    longitude: 150.51,
    frp: 462.4,
    brightness_temp_k: 413.1,
    confidence_pct: 98,
    detection_utc: '2025-05-11T05:00:00Z',
    hours_ago: 1.2,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 12,
    slope_deg: 33,
    ambient_humidity_pct: 13,
    population_at_risk: 59000,
    wind_vector: { speed_mps: 13.9, bearing_deg: 118 }
  },
  {
    incident_id: 'FIRMS-AUS-003',
    name: 'Gospers Mountain Megafire - Bilpin Spur',
    region: 'AUSTRALIA',
    latitude: -33.29,
    longitude: 150.45,
    frp: 384.0,
    brightness_temp_k: 397.6,
    confidence_pct: 96,
    detection_utc: '2025-05-11T03:30:00Z',
    hours_ago: 2.7,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 16,
    slope_deg: 27,
    ambient_humidity_pct: 14,
    population_at_risk: 72400,
    wind_vector: { speed_mps: 13.1, bearing_deg: 112 }
  },
  {
    incident_id: 'FIRMS-AUS-004',
    name: 'Snowy Valleys Kosciuszko Stringybark Front',
    region: 'AUSTRALIA',
    latitude: -36.12,
    longitude: 148.24,
    frp: 348.5,
    brightness_temp_k: 392.0,
    confidence_pct: 95,
    detection_utc: '2025-05-10T22:00:00Z',
    hours_ago: 8.2,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 24,
    slope_deg: 31,
    ambient_humidity_pct: 16,
    population_at_risk: 19800,
    wind_vector: { speed_mps: 11.7, bearing_deg: 130 }
  },
  {
    incident_id: 'FIRMS-AUS-005',
    name: 'Snowy Valleys Complex - Tumbarumba Escarpment',
    region: 'AUSTRALIA',
    latitude: -36.06,
    longitude: 148.16,
    frp: 294.2,
    brightness_temp_k: 382.4,
    confidence_pct: 92,
    detection_utc: '2025-05-10T22:00:00Z',
    hours_ago: 8.2,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 28,
    slope_deg: 26,
    ambient_humidity_pct: 17,
    population_at_risk: 15400,
    wind_vector: { speed_mps: 11.2, bearing_deg: 128 }
  },
  {
    incident_id: 'FIRMS-AUS-006',
    name: 'East Gippsland Mallacoota Coastal Bushfire',
    region: 'AUSTRALIA',
    latitude: -37.54,
    longitude: 149.68,
    frp: 265.0,
    brightness_temp_k: 375.9,
    confidence_pct: 90,
    detection_utc: '2025-05-09T14:00:00Z',
    hours_ago: 40.5,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 45,
    slope_deg: 18,
    ambient_humidity_pct: 22,
    population_at_risk: 12600,
    wind_vector: { speed_mps: 9.8, bearing_deg: 145 }
  },

  // --- CLUSTER 6: AMAZONIA & CERRADO ARC (Xingu / Novo Progresso Cluster) ---
  {
    incident_id: 'FIRMS-AMZ-001',
    name: 'Serra do Cachimbo Canopy Front - North',
    region: 'AMAZONIA',
    latitude: -8.84,
    longitude: -55.22,
    frp: 368.4,
    brightness_temp_k: 396.0,
    confidence_pct: 97,
    detection_utc: '2025-05-11T04:10:00Z',
    hours_ago: 2.1,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Tropical Rainforest',
    estimated_containment_pct: 5,
    slope_deg: 6,
    ambient_humidity_pct: 34,
    population_at_risk: 14200,
    wind_vector: { speed_mps: 7.9, bearing_deg: 255 }
  },
  {
    incident_id: 'FIRMS-AMZ-002',
    name: 'Serra do Cachimbo Canopy Front - BR-163 Corridor',
    region: 'AMAZONIA',
    latitude: -8.91,
    longitude: -55.16,
    frp: 324.0,
    brightness_temp_k: 388.2,
    confidence_pct: 95,
    detection_utc: '2025-05-11T04:10:00Z',
    hours_ago: 2.1,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Tropical Rainforest',
    estimated_containment_pct: 8,
    slope_deg: 5,
    ambient_humidity_pct: 35,
    population_at_risk: 16800,
    wind_vector: { speed_mps: 8.2, bearing_deg: 258 }
  },
  {
    incident_id: 'FIRMS-AMZ-003',
    name: 'Serra do Cachimbo - Jamanxim Flank',
    region: 'AMAZONIA',
    latitude: -8.79,
    longitude: -55.30,
    frp: 279.5,
    brightness_temp_k: 378.4,
    confidence_pct: 93,
    detection_utc: '2025-05-11T01:00:00Z',
    hours_ago: 5.2,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Tropical Rainforest',
    estimated_containment_pct: 10,
    slope_deg: 7,
    ambient_humidity_pct: 36,
    population_at_risk: 11500,
    wind_vector: { speed_mps: 7.5, bearing_deg: 252 }
  },
  {
    incident_id: 'FIRMS-AMZ-004',
    name: 'Pantanal Corumbá Wetland Peat & Savanna Complex',
    region: 'AMAZONIA',
    latitude: -18.92,
    longitude: -57.48,
    frp: 405.2,
    brightness_temp_k: 402.7,
    confidence_pct: 98,
    detection_utc: '2025-05-10T20:15:00Z',
    hours_ago: 10.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 15,
    slope_deg: 3,
    ambient_humidity_pct: 22,
    population_at_risk: 28900,
    wind_vector: { speed_mps: 10.4, bearing_deg: 210 }
  },
  {
    incident_id: 'FIRMS-AMZ-005',
    name: 'Pantanal Complex - Paraguay River Bend',
    region: 'AMAZONIA',
    latitude: -18.98,
    longitude: -57.40,
    frp: 318.9,
    brightness_temp_k: 386.5,
    confidence_pct: 94,
    detection_utc: '2025-05-10T20:15:00Z',
    hours_ago: 10.0,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 18,
    slope_deg: 3,
    ambient_humidity_pct: 23,
    population_at_risk: 24100,
    wind_vector: { speed_mps: 10.1, bearing_deg: 214 }
  },
  {
    incident_id: 'FIRMS-AMZ-006',
    name: 'Rondônia Porto Velho Slash Anomaly',
    region: 'AMAZONIA',
    latitude: -9.45,
    longitude: -63.12,
    frp: 242.0,
    brightness_temp_k: 371.8,
    confidence_pct: 90,
    detection_utc: '2025-05-09T17:30:00Z',
    hours_ago: 37.0,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Tropical Rainforest',
    estimated_containment_pct: 32,
    slope_deg: 5,
    ambient_humidity_pct: 38,
    population_at_risk: 33400,
    wind_vector: { speed_mps: 6.8, bearing_deg: 270 }
  },
  {
    incident_id: 'FIRMS-AMZ-007',
    name: 'Santa Cruz Chiquitano Dry Forest Fire',
    region: 'AMAZONIA',
    latitude: -16.75,
    longitude: -60.85,
    frp: 295.4,
    brightness_temp_k: 383.1,
    confidence_pct: 92,
    detection_utc: '2025-05-07T19:00:00Z',
    hours_ago: 83.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Tropical Rainforest',
    estimated_containment_pct: 50,
    slope_deg: 8,
    ambient_humidity_pct: 28,
    population_at_risk: 19700,
    wind_vector: { speed_mps: 8.9, bearing_deg: 195 }
  },

  // --- CLUSTER 7: CENTRAL AFRICAN MIOMBO SAVANNA (Bié Plateau / Zambezi Cluster) ---
  {
    incident_id: 'FIRMS-AFR-001',
    name: 'Cuando Cubango Miombo Front - North',
    region: 'SAVANNA_AFRICA',
    latitude: -14.62,
    longitude: 18.84,
    frp: 312.0,
    brightness_temp_k: 387.4,
    confidence_pct: 96,
    detection_utc: '2025-05-11T03:50:00Z',
    hours_ago: 2.4,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 10,
    slope_deg: 5,
    ambient_humidity_pct: 19,
    population_at_risk: 21500,
    wind_vector: { speed_mps: 9.8, bearing_deg: 285 }
  },
  {
    incident_id: 'FIRMS-AFR-002',
    name: 'Cuando Cubango Miombo Front - Cuito Valley',
    region: 'SAVANNA_AFRICA',
    latitude: -14.68,
    longitude: 18.92,
    frp: 276.4,
    brightness_temp_k: 379.2,
    confidence_pct: 94,
    detection_utc: '2025-05-11T03:50:00Z',
    hours_ago: 2.4,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 12,
    slope_deg: 6,
    ambient_humidity_pct: 20,
    population_at_risk: 18400,
    wind_vector: { speed_mps: 9.5, bearing_deg: 282 }
  },
  {
    incident_id: 'FIRMS-AFR-003',
    name: 'Cuando Cubango Miombo Front - Menongue Spur',
    region: 'SAVANNA_AFRICA',
    latitude: -14.57,
    longitude: 18.78,
    frp: 238.1,
    brightness_temp_k: 370.5,
    confidence_pct: 91,
    detection_utc: '2025-05-10T23:10:00Z',
    hours_ago: 7.0,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 18,
    slope_deg: 5,
    ambient_humidity_pct: 21,
    population_at_risk: 26300,
    wind_vector: { speed_mps: 9.2, bearing_deg: 288 }
  },
  {
    incident_id: 'FIRMS-AFR-004',
    name: 'Upper Zambezi Floodplain Grass Fire',
    region: 'SAVANNA_AFRICA',
    latitude: -13.25,
    longitude: 23.14,
    frp: 195.8,
    brightness_temp_k: 361.9,
    confidence_pct: 88,
    detection_utc: '2025-05-10T15:40:00Z',
    hours_ago: 14.8,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 35,
    slope_deg: 4,
    ambient_humidity_pct: 23,
    population_at_risk: 15900,
    wind_vector: { speed_mps: 8.6, bearing_deg: 275 }
  },
  {
    incident_id: 'FIRMS-AFR-005',
    name: 'Katanga Upemba Savanna Complex',
    region: 'SAVANNA_AFRICA',
    latitude: -8.92,
    longitude: 26.35,
    frp: 254.0,
    brightness_temp_k: 373.4,
    confidence_pct: 92,
    detection_utc: '2025-05-08T12:00:00Z',
    hours_ago: 66.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Savanna Grassland',
    estimated_containment_pct: 50,
    slope_deg: 7,
    ambient_humidity_pct: 24,
    population_at_risk: 31000,
    wind_vector: { speed_mps: 8.1, bearing_deg: 295 }
  },

  // --- ADDITIONAL GLOBAL TELEMETRY POINTS FOR >52 ACTIVE DETECTIONS ---
  {
    incident_id: 'FIRMS-CA-011',
    name: 'Inyo Owens Valley Brush Fire',
    region: 'CALIFORNIA',
    latitude: 36.85,
    longitude: -118.22,
    frp: 178.2,
    brightness_temp_k: 358.1,
    confidence_pct: 87,
    detection_utc: '2025-05-06T22:00:00Z',
    hours_ago: 104.0,
    satellite_sensor: 'MODIS Terra',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 74,
    slope_deg: 22,
    ambient_humidity_pct: 16,
    population_at_risk: 9200,
    wind_vector: { speed_mps: 8.9, bearing_deg: 350 }
  },
  {
    incident_id: 'FIRMS-CA-012',
    name: 'Los Padres Ventana Ridge Anomaly',
    region: 'CALIFORNIA',
    latitude: 36.22,
    longitude: -121.68,
    frp: 264.5,
    brightness_temp_k: 375.2,
    confidence_pct: 93,
    detection_utc: '2025-05-10T18:30:00Z',
    hours_ago: 12.0,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Chaparral',
    estimated_containment_pct: 30,
    slope_deg: 33,
    ambient_humidity_pct: 18,
    population_at_risk: 14700,
    wind_vector: { speed_mps: 10.5, bearing_deg: 145 }
  },
  {
    incident_id: 'FIRMS-MED-010',
    name: 'Algarve Monchique Cork Oak & Scrub Fire',
    region: 'MEDITERRANEAN',
    latitude: 37.32,
    longitude: -8.56,
    frp: 292.0,
    brightness_temp_k: 382.7,
    confidence_pct: 94,
    detection_utc: '2025-05-10T21:15:00Z',
    hours_ago: 9.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 27,
    slope_deg: 24,
    ambient_humidity_pct: 18,
    population_at_risk: 38200,
    wind_vector: { speed_mps: 11.2, bearing_deg: 135 }
  },
  {
    incident_id: 'FIRMS-MED-011',
    name: 'Sardinia Nuoro Supramonte Brush Fire',
    region: 'MEDITERRANEAN',
    latitude: 40.25,
    longitude: 9.42,
    frp: 218.4,
    brightness_temp_k: 367.0,
    confidence_pct: 89,
    detection_utc: '2025-05-07T14:20:00Z',
    hours_ago: 88.0,
    satellite_sensor: 'MODIS Aqua',
    fuel_type: 'Mediterranean Scrub',
    estimated_containment_pct: 62,
    slope_deg: 25,
    ambient_humidity_pct: 22,
    population_at_risk: 21400,
    wind_vector: { speed_mps: 9.6, bearing_deg: 115 }
  },
  {
    incident_id: 'FIRMS-BOR-009',
    name: 'La Ronge Churchill River Boreal Fire',
    region: 'BOREAL_CANADA',
    latitude: 55.35,
    longitude: -105.28,
    frp: 356.8,
    brightness_temp_k: 394.1,
    confidence_pct: 95,
    detection_utc: '2025-05-10T23:00:00Z',
    hours_ago: 7.2,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 18,
    slope_deg: 7,
    ambient_humidity_pct: 21,
    population_at_risk: 7800,
    wind_vector: { speed_mps: 10.9, bearing_deg: 112 }
  },
  {
    incident_id: 'FIRMS-BOR-010',
    name: 'Chibougamau Quebec Taiga Anomaly',
    region: 'BOREAL_CANADA',
    latitude: 50.12,
    longitude: -74.38,
    frp: 310.2,
    brightness_temp_k: 385.0,
    confidence_pct: 93,
    detection_utc: '2025-05-08T19:00:00Z',
    hours_ago: 59.0,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Boreal Forest',
    estimated_containment_pct: 45,
    slope_deg: 9,
    ambient_humidity_pct: 25,
    population_at_risk: 9400,
    wind_vector: { speed_mps: 9.8, bearing_deg: 130 }
  },
  {
    incident_id: 'FIRMS-AUS-007',
    name: 'Kangaroo Island Flinders Chase Bushfire',
    region: 'AUSTRALIA',
    latitude: -35.88,
    longitude: 136.75,
    frp: 282.6,
    brightness_temp_k: 380.2,
    confidence_pct: 92,
    detection_utc: '2025-05-09T11:00:00Z',
    hours_ago: 43.0,
    satellite_sensor: 'VIIRS SNPP',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 40,
    slope_deg: 16,
    ambient_humidity_pct: 20,
    population_at_risk: 6200,
    wind_vector: { speed_mps: 11.4, bearing_deg: 155 }
  },
  {
    incident_id: 'FIRMS-AUS-008',
    name: 'Perth Hills Darling Scarp Eucalyptus Fire',
    region: 'AUSTRALIA',
    latitude: -32.08,
    longitude: 116.14,
    frp: 319.0,
    brightness_temp_k: 387.9,
    confidence_pct: 94,
    detection_utc: '2025-05-11T02:30:00Z',
    hours_ago: 3.7,
    satellite_sensor: 'VIIRS NOAA-20',
    fuel_type: 'Eucalyptus Bush',
    estimated_containment_pct: 22,
    slope_deg: 21,
    ambient_humidity_pct: 15,
    population_at_risk: 68400,
    wind_vector: { speed_mps: 12.6, bearing_deg: 265 }
  }
];

// ============================================================================
// 4. MATHEMATICAL & DISPERSION PHYSICS ENGINE
// ============================================================================

/**
 * Great-circle Haversine distance between two coordinates in kilometers.
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
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
 * Destination coordinate given starting (lat, lon), bearing (deg), and distance (km).
 */
function destinationCoordinate(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lon: number } {
  const R = 6371.0;
  const d = distanceKm / R;
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
 * 1A. ROTHERMEL SURFACE FIRE SPREAD MODEL (SIMPLIFIED FORMULATION)
 * Computes Rate of Spread R (m/min), Reaction Intensity I_R, Wind Factor phi_w,
 * Slope Factor phi_s, Byram's Fireline Intensity I_B (kW/m), Flame Length L_f (m),
 * and Elliptical Burn Growth over forward simulation time.
 */
function computeRothermelSpread(incident: WildfireIncident, simHourOffset: number): RothermelMetrics {
  const spec = FUEL_MODEL_SPECS[incident.fuel_type];

  // Dead fuel moisture fraction estimated from ambient relative humidity & radiative heating
  const fuelMoistureFraction = Math.max(
    0.03,
    Math.min(spec.moistureExtinction * 0.92, (incident.ambient_humidity_pct / 100) * 0.42)
  );
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
  const gammaMax = Math.pow(savImperial, 1.5) / (495.0 + 0.0594 * Math.pow(savImperial, 1.5));
  const gammaPrime =
    gammaMax * Math.pow(betaRatio, A) * Math.exp(A * (1.0 - betaRatio));

  // Mineral damping coefficient eta_S (typical silica content ~ 0.055)
  const etaS = 0.41739;

  // Reaction Intensity I_R (kW/m^2)
  const reactionIntensityKwm2 =
    (gammaPrime * spec.fuelLoadKgM2 * spec.heatContentKjKg * etaM * etaS) / 60.0;

  // Propagating flux ratio xi
  const xi =
    Math.exp((0.792 + 0.681 * Math.sqrt(savImperial)) * (spec.packingRatioBeta + 0.1)) /
    (192.0 + 0.2595 * savImperial);

  // Wind factor phi_W (using midflame wind speed ~ 0.45 * 10m wind speed, in ft/min)
  const midflameWindMps = incident.wind_vector.speed_mps * 0.48;
  const midflameWindFtMin = midflameWindMps * 196.85;
  const C = 7.47 * Math.exp(-0.133 * Math.pow(savImperial, 0.55));
  const B = 0.02526 * Math.pow(savImperial, 0.54);
  const E = 0.715 * Math.exp(-0.000359 * savImperial);
  const windFactorPhiW = C * Math.pow(midflameWindFtMin, B) * Math.pow(betaRatio, -E);

  // Slope factor phi_S = 5.275 * beta^-0.3 * (tan theta)^2
  const tanSlope = Math.tan((incident.slope_deg * Math.PI) / 180);
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
  const firelineIntensityKwm = (heatPerUnitAreaKjM2 * rateOfSpreadMpm) / 60.0;
  const flameLengthM = 0.0775 * Math.pow(Math.max(1, firelineIntensityKwm), 0.46);

  // Elliptical Fire Area Estimation (Anderson 1983 length-to-breadth ratio LB)
  const lbRatio =
    0.936 * Math.exp(0.2566 * midflameWindMps) +
    0.461 * Math.exp(-0.1548 * midflameWindMps) -
    0.397;
  const clampedLb = Math.max(1.1, Math.min(8.0, lbRatio));

  // Initial burned area based on FRP & active burn duration
  const activeBurnHours = Math.max(2.0, Math.min(36.0, incident.hours_ago + 4.0));
  const containmentDamping = 1.0 - (incident.estimated_containment_pct / 100) * 0.65;
  const initialMajorKm = Math.max(
    0.6,
    rateOfSpreadKmh * Math.sqrt(activeBurnHours) * 0.72 * containmentDamping
  );
  const initialMinorKm = initialMajorKm / clampedLb;
  const initialBurnAreaHa = Math.PI * (initialMajorKm / 2) * (initialMinorKm / 2) * 100;

  // Forward simulation expansion (+simHourOffset hours)
  const ellipseMajorAxisKm =
    initialMajorKm + rateOfSpreadKmh * simHourOffset * containmentDamping;
  const ellipseMinorAxisKm = ellipseMajorAxisKm / clampedLb;
  const simulatedBurnAreaHa =
    Math.PI * (ellipseMajorAxisKm / 2) * (ellipseMinorAxisKm / 2) * 100;

  return {
    rateOfSpreadMpm,
    rateOfSpreadKmh,
    reactionIntensityKwm2,
    firelineIntensityKwm,
    flameLengthM,
    windFactorPhiW,
    slopeFactorPhiS,
    initialBurnAreaHa,
    simulatedBurnAreaHa,
    ellipseMajorAxisKm,
    ellipseMinorAxisKm
  };
}

/**
 * 1B. FIRE RADIATIVE ENERGY (FRE) & BIOMASS COMBUSTION ENGINE
 * Integrates FRP (MW = MJ/s) over time into Gigajoules (GJ) and Terajoules (TJ),
 * computes biomass consumption rate (Wooster et al. 2005 factor: 0.368 kg/MJ),
 * and derives source PM2.5 emission rate Q (g/s).
 */
function computeFREAndEmissions(incident: WildfireIncident, simHourOffset: number): FREMetrics {
  const spec = FUEL_MODEL_SPECS[incident.fuel_type];

  // Effective integration window (hours) accounting for diurnal cycle + forward sim
  const integrationHours = Math.max(3.0, Math.min(48.0, incident.hours_ago + 4.0 + simHourOffset));
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
 * 1C. ATMOSPHERIC DISPERSION & 2D GAUSSIAN SMOKE PLUME MODEL
 * C(x, y) = (Q / (2 * pi * u * sigma_y * sigma_z)) * exp(-y^2 / (2 * sigma_y^2))
 * using Pasquill-Gifford stability class C/D dispersion parameterization.
 */
function evaluateGaussianPlumeAt(
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

  // 2D Gaussian Plume equation: C(x,y) = (Q / (2 * pi * u * sigma_y * sigma_z)) * exp(-y^2 / (2 * sigma_y^2))
  const prefactor = Q_ugs / (2.0 * Math.PI * u * sigmaY * sigmaZ);
  const lateralDecay = Math.exp(
    -(crosswindMeters * crosswindMeters) / (2.0 * sigmaY * sigmaY)
  );

  const concentrationUgM3 = prefactor * lateralDecay;
  return { concentrationUgM3, sigmaY, sigmaZ };
}

function classifyAqiPm25(pm25: number): {
  aqiCategory: PlumeConcentrationPoint['aqiCategory'];
  colorHex: string;
} {
  if (pm25 >= 250) return { aqiCategory: 'Hazardous', colorHex: '#ef4444' };
  if (pm25 >= 150) return { aqiCategory: 'Very Unhealthy', colorHex: '#f97316' };
  if (pm25 >= 55) return { aqiCategory: 'Unhealthy', colorHex: '#f59e0b' };
  if (pm25 >= 15) return { aqiCategory: 'Moderate', colorHex: '#eab308' };
  return { aqiCategory: 'Good', colorHex: '#10b981' };
}

/**
 * 1D. SPATIAL CONVEX HULL (MONOTONE CHAIN) & PROXIMITY CLUSTERING (<15km)
 */
function computeConvexHull(
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
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Array<{ lat: number; lon: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
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
function buildBufferedClusterPolygon(
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

// ============================================================================
// 5. CUSTOM MODULAR HOOKS (useFireData, useGISFilter, usePlumeSimulation)
// ============================================================================

/**
 * Hook 1: `useFireData`
 * Manages the active NASA FIRMS & EONET telemetry dataset and supports
 * asynchronous CSV / GeoJSON ingestion with automatic schema normalization.
 */
function useFireData() {
  const [incidents, setIncidents] = useState<WildfireIncident[]>(INITIAL_FIRMS_INCIDENTS);
  const [lastIngestedCount, setLastIngestedCount] = useState<number | null>(null);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  const ingestPayloadAsync = useCallback(async (rawText: string): Promise<number> => {
    setIngestionError(null);
    await new Promise((resolve) => setTimeout(resolve, 180)); // Async ingestion pipeline

    const trimmed = rawText.trim();
    if (!trimmed) {
      throw new Error('Empty payload provided to FIRMS parser.');
    }

    const parsedIncidents: WildfireIncident[] = [];

    // 1. Check if GeoJSON FeatureCollection or JSON Array
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const json = JSON.parse(trimmed);
      const features = Array.isArray(json)
        ? json
        : Array.isArray(json.features)
        ? json.features
        : [];

      features.forEach((f: any, idx: number) => {
        const props = f.properties || f;
        const coords = f.geometry?.coordinates || [props.longitude, props.latitude];
        const lon = parseFloat(coords[0] ?? props.lon ?? props.longitude);
        const lat = parseFloat(coords[1] ?? props.lat ?? props.latitude);
        if (isNaN(lat) || isNaN(lon)) return;

        parsedIncidents.push({
          incident_id: props.incident_id || `FIRMS-ING-${Date.now().toString().slice(-4)}-${idx + 1}`,
          name: props.name || `Ingested Thermal Anomaly #${idx + 1}`,
          region: 'GLOBAL',
          latitude: lat,
          longitude: lon,
          frp: parseFloat(props.frp) || 215.0,
          brightness_temp_k: parseFloat(props.bright_ti4 || props.brightness_temp_k || props.brightness) || 375.0,
          confidence_pct: parseFloat(props.confidence_pct || props.confidence) || 90,
          detection_utc: props.detection_utc || new Date().toISOString(),
          hours_ago: parseFloat(props.hours_ago) || 1.0,
          satellite_sensor: (props.satellite_sensor as SatelliteSensor) || 'VIIRS SNPP',
          fuel_type: (props.fuel_type as FuelModelType) || 'Chaparral',
          estimated_containment_pct: parseFloat(props.estimated_containment_pct) || 10,
          slope_deg: parseFloat(props.slope_deg) || 18,
          ambient_humidity_pct: parseFloat(props.ambient_humidity_pct) || 16,
          population_at_risk: parseInt(props.population_at_risk, 10) || 15000,
          wind_vector: {
            speed_mps: parseFloat(props.wind_speed_mps || props.wind_vector?.speed_mps) || 10.5,
            bearing_deg: parseFloat(props.wind_bearing_deg || props.wind_vector?.bearing_deg) || 120
          }
        });
      });
    } else {
      // 2. Parse NASA FIRMS NRT CSV Schema
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV must include header row and at least 1 telemetry record.');
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, cIdx) => {
          row[h] = cols[cIdx] ?? '';
        });

        const lat = parseFloat(row.latitude || row.lat);
        const lon = parseFloat(row.longitude || row.lon);
        if (isNaN(lat) || isNaN(lon)) continue;

        const confRaw = row.confidence_pct || row.confidence || '92';
        const confNum =
          confRaw === 'h' || confRaw === 'high'
            ? 96
            : confRaw === 'n' || confRaw === 'nominal'
            ? 84
            : parseFloat(confRaw) || 90;

        parsedIncidents.push({
          incident_id:
            row.incident_id || `FIRMS-CSV-${Date.now().toString().slice(-4)}-${i}`,
          name: row.name || `FIRMS NRT Spot (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
          region: 'GLOBAL',
          latitude: lat,
          longitude: lon,
          frp: parseFloat(row.frp) || 240.0,
          brightness_temp_k:
            parseFloat(row.brightness_temp_k || row.bright_ti4 || row.brightness) || 382.0,
          confidence_pct: Math.min(100, Math.max(0, confNum)),
          detection_utc: row.detection_utc || row.acq_date || new Date().toISOString(),
          hours_ago: parseFloat(row.hours_ago) || 1.2,
          satellite_sensor:
            (row.satellite_sensor as SatelliteSensor) || 'VIIRS NOAA-20',
          fuel_type: (row.fuel_type as FuelModelType) || 'Chaparral',
          estimated_containment_pct:
            parseFloat(row.estimated_containment_pct) || 12,
          slope_deg: parseFloat(row.slope_deg) || 21,
          ambient_humidity_pct: parseFloat(row.ambient_humidity_pct) || 15,
          population_at_risk: parseInt(row.population_at_risk, 10) || 18500,
          wind_vector: {
            speed_mps: parseFloat(row.wind_speed_mps) || 11.2,
            bearing_deg: parseFloat(row.wind_bearing_deg) || 140
          }
        });
      }
    }

    if (parsedIncidents.length === 0) {
      throw new Error('No valid coordinate records found in payload.');
    }

    setIncidents((prev) => [...parsedIncidents, ...prev]);
    setLastIngestedCount(parsedIncidents.length);
    return parsedIncidents.length;
  }, []);

  const resetDataset = useCallback(() => {
    setIncidents(INITIAL_FIRMS_INCIDENTS);
    setLastIngestedCount(null);
    setIngestionError(null);
  }, []);

  return {
    incidents,
    ingestPayloadAsync,
    resetDataset,
    lastIngestedCount,
    ingestionError,
    setIngestionError
  };
}

/**
 * Hook 2: `useGISFilter`
 * Multi-parametric spatial and attribute filter engine with memoized indexing.
 */
function useGISFilter(incidents: WildfireIncident[], filters: GISFilterState) {
  return useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (inc.frp < filters.minFrp) return false;
      if (inc.confidence_pct < filters.minConfidence) return false;
      if (inc.hours_ago > filters.lookbackHours) return false;
      if (!filters.selectedSensors.includes(inc.satellite_sensor)) return false;
      if (!filters.selectedFuels.includes(inc.fuel_type)) return false;
      if (
        q &&
        !inc.name.toLowerCase().includes(q) &&
        !inc.incident_id.toLowerCase().includes(q) &&
        !inc.fuel_type.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [incidents, filters]);
}

/**
 * Hook 3: `usePlumeSimulation`
 * Executes Rothermel spread, FRE integration, 2D Gaussian smoke dispersion,
 * and spatial proximity cluster tessellation (<15km default) across filtered incidents.
 */
function usePlumeSimulation(
  filteredIncidents: WildfireIncident[],
  simHourOffset: number,
  clusterRadiusKm: number
) {
  const simulatedIncidents = useMemo<IncidentPhysicsSimulation[]>(() => {
    const distancesKm = [5, 10, 20, 35, 50, 75, 100];

    return filteredIncidents.map((incident) => {
      const rothermel = computeRothermelSpread(incident, simHourOffset);
      const fre = computeFREAndEmissions(incident, simHourOffset);

      // Compute downwind plume concentration profile at discrete stations
      const plumeProfile: PlumeConcentrationPoint[] = distancesKm.map((distKm) => {
        const { concentrationUgM3, sigmaY, sigmaZ } = evaluateGaussianPlumeAt(
          fre.pm25EmissionRateGs,
          incident.wind_vector.speed_mps,
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
      // Effective transport velocity in planetary boundary layer ~ 0.65 * wind_speed_mps
      const effectiveDriftKmh = incident.wind_vector.speed_mps * 3.6 * 0.62;
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
    });
  }, [filteredIncidents, simHourOffset]);

  // Connected-Components Spatial Clustering (Hotspot Cluster Tessellation <= clusterRadiusKm)
  const thermalClusters = useMemo<ThermalCluster[]>(() => {
    const n = simulatedIncidents.length;
    const visited = new Array(n).fill(false);
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
  }, [simulatedIncidents, clusterRadiusKm]);

  return { simulatedIncidents, thermalClusters };
}

// ============================================================================
// 6. SIMPLIFIED WORLD & REGIONAL VECTOR COASTLINE POLYGONS FOR GIS CANVAS
// ============================================================================
// High-precision landmass outlines so the tactical dark slate GIS map looks
// authentic both at global scale and when zoomed into fire theaters.

const WORLD_LANDMASS_POLYGONS: Array<{ name: string; coords: Array<[number, number]> }> = [
  {
    name: 'North America',
    coords: [
      [-168, 65], [-160, 70], [-140, 70], [-125, 72], [-95, 74], [-80, 70],
      [-65, 62], [-55, 52], [-66, 44], [-70, 41], [-75, 35], [-81, 25],
      [-83, 29], [-90, 29], [-97, 26], [-96, 19], [-88, 21], [-83, 10],
      [-78, 8], [-85, 11], [-92, 15], [-105, 20], [-110, 24], [-114, 31],
      [-117, 32.5], [-120.5, 34.5], [-122.5, 37.8], [-124.2, 40.5],
      [-124.5, 48], [-130, 54], [-138, 59], [-152, 60], [-162, 55], [-168, 65]
    ]
  },
  {
    name: 'South America',
    coords: [
      [-78, 9], [-72, 11], [-62, 10], [-50, 2], [-42, -3], [-35, -6],
      [-38, -13], [-40, -22], [-48, -28], [-54, -34], [-62, -40], [-67, -50],
      [-70, -54], [-75, -48], [-72, -35], [-71, -20], [-77, -12], [-81, -5],
      [-78, 2], [-78, 9]
    ]
  },
  {
    name: 'Europe & Mediterranean N',
    coords: [
      [-9.5, 37], [-9, 43], [-2, 43.5], [-4.5, 48], [2, 51], [8, 54],
      [10, 58], [5, 62], [15, 69], [28, 71], [42, 67], [60, 69],
      [60, 55], [40, 46], [29, 45], [28, 41], [26, 40.5], [24, 38],
      [22.5, 36.5], [20, 39], [18, 40], [16, 38], [15, 40], [13.5, 45],
      [10, 44], [8, 44], [5, 43.3], [3, 42], [0, 39], [-5.5, 36], [-9.5, 37]
    ]
  },
  {
    name: 'Africa',
    coords: [
      [-17, 15], [-13, 28], [-5.8, 35.8], [3, 37], [10.5, 37], [12, 33],
      [20, 32], [32, 31.5], [34, 28], [40, 16], [43, 12], [51, 12],
      [41, -2], [40, -11], [35, -20], [32, -29], [25, -34], [18.4, -34.4],
      [15, -24], [12.5, -17], [13, -9], [9, -1], [9, 4], [2, 6],
      [-8, 4.5], [-16, 11], [-17, 15]
    ]
  },
  {
    name: 'Asia & Anatolia',
    coords: [
      [26, 40], [27, 36.8], [31, 36.8], [36, 36.5], [35, 32], [39, 22],
      [45, 13], [59, 22], [56, 27], [49, 30], [67, 24], [73, 18],
      [78, 8], [88, 22], [98, 16], [103, 2], [109, 12], [108, 21],
      [121, 24], [122, 31], [120, 39], [129, 35], [135, 45], [142, 53],
      [160, 60], [178, 66], [140, 73], [105, 76], [70, 72], [60, 69],
      [50, 45], [40, 42], [29, 41], [26, 40]
    ]
  },
  {
    name: 'Australia',
    coords: [
      [113.5, -22], [122, -17], [131, -12], [136, -12.5], [136, -15],
      [141, -17], [142.5, -11], [146, -18], [150, -23], [153.5, -28],
      [150.5, -34], [149.8, -37.5], [145, -38.5], [140, -37.5],
      [136, -35], [131, -31.5], [122, -34], [115.5, -34], [115.8, -32],
      [114, -26], [113.5, -22]
    ]
  },
  {
    name: 'Greenland',
    coords: [
      [-52, 60], [-43, 60], [-22, 70], [-18, 81], [-55, 82], [-70, 76],
      [-55, 68], [-52, 60]
    ]
  },
  {
    name: 'United Kingdom',
    coords: [
      [-5.5, 50], [-5, 54], [-6, 58.5], [-2, 58.5], [1.5, 52.5], [1, 51], [-5.5, 50]
    ]
  },
  {
    name: 'Madagascar',
    coords: [
      [49, -12], [50.2, -16], [47, -25], [44, -24.5], [44.5, -17], [49, -12]
    ]
  },
  {
    name: 'Japan & Sakhalin',
    coords: [
      [130, 31], [131, 34], [136, 35], [140, 36], [141.5, 41], [145, 43],
      [142, 45], [139.5, 40], [135, 35.5], [130, 31]
    ]
  },
  {
    name: 'New Zealand',
    coords: [
      [172, -34.5], [178, -37.5], [175, -41.5], [166.5, -46], [168, -44],
      [173, -40.5], [172, -34.5]
    ]
  },
  {
    name: 'Indonesia / Borneo / Sumatra',
    coords: [
      [95.5, 5.5], [104, 1], [106, -6], [114, -8], [118, -4], [117, 4],
      [110, 2], [102, 4], [95.5, 5.5]
    ]
  }
];

const THEATER_TOPO_RIDGES: Array<{
  name: string;
  labelLat: number;
  labelLon: number;
  coords: Array<[number, number]>;
}> = [
  {
    name: 'SIERRA NEVADA CREST',
    labelLat: 38.3,
    labelLon: -119.5,
    coords: [[-121.6, 40.4], [-120.2, 39.1], [-119.2, 37.7], [-118.4, 36.5], [-118.2, 35.4]]
  },
  {
    name: 'CALIFORNIA COAST RANGE',
    labelLat: 39.5,
    labelLon: -123.1,
    coords: [[-123.8, 41.2], [-122.9, 39.4], [-121.7, 36.3], [-119.8, 34.5]]
  },
  {
    name: 'HELLENIC PINDUS & ATTICA RIDGE',
    labelLat: 38.6,
    labelLon: 22.3,
    coords: [[20.8, 40.2], [21.6, 39.1], [22.4, 38.4], [23.9, 38.1]]
  },
  {
    name: 'BLUE MOUNTAINS ESCARPMENT',
    labelLat: -34.2,
    labelLon: 149.8,
    coords: [[150.8, -32.4], [150.3, -33.5], [149.2, -35.2], [148.1, -36.5]]
  },
  {
    name: 'ATHABASCA TAIGA SHIELD',
    labelLat: 59.3,
    labelLon: -113.5,
    coords: [[-118.8, 58.9], [-115.2, 59.1], [-111.3, 58.6], [-107.5, 58.2]]
  }
];

// ============================================================================
// 7. SUB-COMPONENTS: TUI FLOATING BORDER, WIND ROSE, GAUSSIAN PLUME CHART
// ============================================================================

/**
 * Reusable Neovim Floating Split Panel with inline box-drawing title header
 */
const NvimSplitBox: React.FC<{
  title: string;
  rightBadge?: string;
  theme: NvimThemePalette;
  accentColor?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, rightBadge, theme, accentColor, className = '', children }) => {
  const borderCol = accentColor || theme.border;
  return (
    <div
      className={`relative rounded-sm border flex flex-col ${className}`}
      style={{
        backgroundColor: theme.mantle,
        borderColor: borderCol
      }}
    >
      {/* Top Neovim Floating Border Title Bar */}
      <div
        className="h-6 px-2 flex items-center justify-between text-[11px] font-mono shrink-0 border-b select-none"
        style={{
          backgroundColor: theme.crust,
          borderColor: borderCol,
          color: accentColor || theme.blue
        }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span style={{ color: theme.comment }}>╭─</span>
          <span className="font-bold truncate">{title}</span>
          <span style={{ color: theme.comment }}>──╮</span>
        </div>
        {rightBadge && (
          <span
            className="px-1.5 py-0.2 rounded-sm text-[10px] font-mono shrink-0"
            style={{
              backgroundColor: `${accentColor || theme.blue}22`,
              color: accentColor || theme.cyan
            }}
          >
            {rightBadge}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
};

/**
 * Meteorological Wind Rose & Slope Vector SVG Widget (Theme-Aware Neovim TUI)
 */
const WindRoseCompass: React.FC<{
  bearingDeg: number;
  speedMps: number;
  slopeDeg: number;
  theme: NvimThemePalette;
}> = ({ bearingDeg, speedMps, slopeDeg, theme }) => {
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  const endX = 60 + Math.cos(rad) * 38;
  const endY = 60 + Math.sin(rad) * 38;

  return (
    <div
      className="flex items-center gap-3 rounded-sm p-2.5 border font-mono"
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border
      }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        <defs>
          <radialGradient id="nvimWindRoseGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={theme.orange} stopOpacity="0.25" />
            <stop offset="100%" stopColor={theme.bg} stopOpacity="0" />
          </radialGradient>
          <marker
            id="nvimWindArrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill={theme.orange} />
          </marker>
        </defs>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="url(#nvimWindRoseGlow)"
          stroke={theme.border}
          strokeWidth="1.2"
        />
        <circle
          cx="60"
          cy="60"
          r="35"
          fill="none"
          stroke={theme.border}
          strokeDasharray="3 3"
        />
        <circle
          cx="60"
          cy="60"
          r="20"
          fill="none"
          stroke={theme.border}
          strokeDasharray="2 2"
        />
        <line x1="60" y1="6" x2="60" y2="114" stroke={theme.border} strokeWidth="1" />
        <line x1="6" y1="60" x2="114" y2="60" stroke={theme.border} strokeWidth="1" />

        {/* Cardinal Labels */}
        <text x="60" y="15" textAnchor="middle" fill={theme.cyan} fontSize="9" fontWeight="bold">
          N
        </text>
        <text x="108" y="63" textAnchor="middle" fill={theme.comment} fontSize="9">
          E
        </text>
        <text x="60" y="112" textAnchor="middle" fill={theme.comment} fontSize="9">
          S
        </text>
        <text x="12" y="63" textAnchor="middle" fill={theme.comment} fontSize="9">
          W
        </text>

        {/* Dispersion Cone Sector Preview */}
        <path
          d={`M 60 60 L ${60 + Math.cos(rad - 0.32) * 45} ${
            60 + Math.sin(rad - 0.32) * 45
          } A 45 45 0 0 1 ${60 + Math.cos(rad + 0.32) * 45} ${
            60 + Math.sin(rad + 0.32) * 45
          } Z`}
          fill={theme.orange}
          fillOpacity="0.22"
          stroke={theme.orange}
          strokeOpacity="0.55"
          strokeWidth="1"
        />

        {/* Wind Vector Line */}
        <line
          x1="60"
          y1="60"
          x2={endX}
          y2={endY}
          stroke={theme.orange}
          strokeWidth="2.2"
          markerEnd="url(#nvimWindArrow)"
        />
        <circle cx="60" cy="60" r="3.5" fill={theme.red} stroke={theme.yellow} strokeWidth="1.2" />
      </svg>

      <div className="space-y-1.5 text-[11px] flex-1 font-mono">
        <div style={{ color: theme.comment }}>// local_wind_vector.rs</div>
        <div>
          <span style={{ color: theme.cyan }}>azimuth_deg</span>:{' '}
          <span style={{ color: theme.yellow }} className="font-bold">
            {bearingDeg.toFixed(0)}°
          </span>
        </div>
        <div>
          <span style={{ color: theme.cyan }}>u_10m_mps</span>:{' '}
          <span style={{ color: theme.orange }} className="font-bold">
            {speedMps.toFixed(1)}
          </span>{' '}
          <span style={{ color: theme.comment }}>
            ({(speedMps * 3.6).toFixed(0)} km/h)
          </span>
        </div>
        <div>
          <span style={{ color: theme.cyan }}>slope_theta</span>:{' '}
          <span style={{ color: theme.magenta }} className="font-bold">
            {slopeDeg.toFixed(0)}°
          </span>{' '}
          <span style={{ color: theme.comment }}>
            ({Math.round(Math.tan((slopeDeg * Math.PI) / 180) * 100)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 2D Gaussian Plume Downwind PM2.5 Decay & Cross-Wind Bell Curve SVG Chart (Theme-Aware)
 */
const GaussianPlumeChart: React.FC<{
  profile: PlumeConcentrationPoint[];
  emissionRateGs: number;
  windSpeedMps: number;
  theme: NvimThemePalette;
}> = ({ profile, emissionRateGs, windSpeedMps, theme }) => {
  const [selectedStationIdx, setSelectedStationIdx] = useState<number>(1);
  const activeStation = profile[selectedStationIdx] || profile[0];

  const maxPm25 = Math.max(300, ...profile.map((p) => p.centerlinePm25));

  const chartW = 310;
  const chartH = 112;
  const padL = 36;
  const padB = 20;
  const padT = 10;
  const padR = 12;

  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const pointsStr = profile
    .map((pt) => {
      const x = padL + (pt.distanceKm / 100) * plotW;
      const y = padT + plotH - Math.min(1, pt.centerlinePm25 / maxPm25) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaStr = `${padL},${padT + plotH} ${pointsStr} ${padL + plotW},${padT + plotH}`;

  const crossWindSamples: Array<{ yKm: number; val: number }> = [];
  const maxCrossKm = Math.max(4, Math.ceil((activeStation.sigmaY * 3) / 1000));
  for (let i = -20; i <= 20; i++) {
    const yKm = (i / 20) * maxCrossKm;
    const { concentrationUgM3 } = evaluateGaussianPlumeAt(
      emissionRateGs,
      windSpeedMps,
      activeStation.distanceKm * 1000,
      yKm * 1000
    );
    crossWindSamples.push({ yKm, val: concentrationUgM3 });
  }

  return (
    <div
      className="rounded-sm p-2.5 space-y-2.5 border font-mono"
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-[11px] font-bold flex items-center gap-1.5"
            style={{ color: theme.blue }}
          >
            <Activity className="w-3.5 h-3.5" style={{ color: theme.orange }} />
            <span>fn gaussian_plume_c(x, y)</span>
          </div>
          <div className="text-[10px]" style={{ color: theme.comment }}>
            C(x,y) = [Q/(2π·u·σy·σz)]·exp(-y²/2σy²)
          </div>
        </div>
        <span
          className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold border"
          style={{
            backgroundColor: `${activeStation.colorHex}20`,
            borderColor: `${activeStation.colorHex}60`,
            color: activeStation.colorHex
          }}
        >
          {activeStation.aqiCategory} @{activeStation.distanceKm}km
        </span>
      </div>

      {/* Downwind Centerline Decay SVG */}
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} className="overflow-visible">
        <defs>
          <linearGradient id="nvimPlumeDecayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={theme.red} stopOpacity="0.45" />
            <stop offset="65%" stopColor={theme.orange} stopOpacity="0.18" />
            <stop offset="100%" stopColor={theme.orange} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t, i) => {
          const y = padT + plotH * (1 - t);
          const val = Math.round(maxPm25 * t);
          return (
            <g key={i}>
              <line
                x1={padL}
                y1={y}
                x2={padL + plotW}
                y2={y}
                stroke={theme.border}
                strokeDasharray="2 2"
              />
              <text
                x={padL - 4}
                y={y + 3}
                textAnchor="end"
                fill={theme.comment}
                fontSize="8"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          );
        })}

        <polygon points={areaStr} fill="url(#nvimPlumeDecayGrad)" />
        <polyline fill="none" stroke={theme.orange} strokeWidth="2" points={pointsStr} />

        {profile.map((pt, idx) => {
          const x = padL + (pt.distanceKm / 100) * plotW;
          const y = padT + plotH - Math.min(1, pt.centerlinePm25 / maxPm25) * plotH;
          const isSel = idx === selectedStationIdx;
          return (
            <g
              key={pt.distanceKm}
              className="cursor-pointer"
              onClick={() => setSelectedStationIdx(idx)}
            >
              <circle
                cx={x}
                cy={y}
                r={isSel ? 4.8 : 3.0}
                fill={isSel ? theme.yellow : pt.colorHex}
                stroke={theme.crust}
                strokeWidth="1.5"
              />
              {isSel && (
                <circle
                  cx={x}
                  cy={y}
                  r={7.5}
                  fill="none"
                  stroke={theme.cyan}
                  strokeWidth="1.2"
                />
              )}
              <text
                x={x}
                y={chartH - 4}
                textAnchor="middle"
                fill={isSel ? theme.fg : theme.comment}
                fontSize="8"
                fontFamily="monospace"
                fontWeight={isSel ? 'bold' : 'normal'}
              >
                {pt.distanceKm}k
              </text>
            </g>
          );
        })}
      </svg>

      {/* Crosswind Gaussian Bell Curve at Selected Downwind Station */}
      <div
        className="pt-2 border-t flex items-center justify-between gap-2"
        style={{ borderColor: theme.border }}
      >
        <div className="space-y-0.5 text-[10px]">
          <div style={{ color: theme.subtext }}>
            x = <span style={{ color: theme.cyan }}>{activeStation.distanceKm}km</span> downwind
          </div>
          <div className="font-bold text-xs" style={{ color: theme.yellow }}>
            {activeStation.centerlinePm25.toFixed(1)} µg/m³ PM₂.₅
          </div>
          <div style={{ color: theme.comment }}>
            σy:{Math.round(activeStation.sigmaY)}m | σz:{Math.round(activeStation.sigmaZ)}m
          </div>
        </div>

        <div
          className="w-36 rounded-sm p-1 border"
          style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
        >
          <div
            className="text-[8px] text-center mb-0.5"
            style={{ color: theme.comment }}
          >
            exp(-y²/2σy²) ±{maxCrossKm}km
          </div>
          <svg width="100%" viewBox="0 0 120 34">
            <path
              d={
                `M 4 30 ` +
                crossWindSamples
                  .map((s, idx) => {
                    const x = 4 + (idx / (crossWindSamples.length - 1)) * 112;
                    const norm =
                      activeStation.centerlinePm25 > 0
                        ? s.val / activeStation.centerlinePm25
                        : 0;
                    const y = 30 - norm * 24;
                    return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ') +
                ` L 116 30 Z`
              }
              fill={`${theme.magenta}33`}
              stroke={theme.magenta}
              strokeWidth="1.4"
            />
            <line
              x1="60"
              y1="3"
              x2="60"
              y2="30"
              stroke={theme.comment}
              strokeDasharray="2 2"
              strokeWidth="0.8"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. MAIN APPLICATION COMPONENT: PyroWatchCore (Neovim TUI Edition)
// ============================================================================

export default function App() {
  // 0. Neovim Theme & Buffer State
  const [themeId, setThemeId] = useState<NvimThemeId>('tokyonight-storm');
  const theme = NVIM_THEMES[themeId];
  const [activeBuffer, setActiveBuffer] = useState<ActiveBufferTab>('VIEWPORT_GIS');

  // 1. Data & Ingestion Hook
  const {
    incidents,
    ingestPayloadAsync,
    resetDataset,
    lastIngestedCount,
    ingestionError,
    setIngestionError
  } = useFireData();

  // 2. Multi-Parametric Filter State
  const [filters, setFilters] = useState<GISFilterState>({
    minFrp: 100,
    minConfidence: 80,
    lookbackHours: 168,
    selectedSensors: ['VIIRS SNPP', 'VIIRS NOAA-20', 'MODIS Terra', 'MODIS Aqua'],
    selectedFuels: [
      'Chaparral',
      'Boreal Forest',
      'Mediterranean Scrub',
      'Eucalyptus Bush',
      'Savanna Grassland',
      'Tropical Rainforest'
    ],
    clusterRadiusKm: 15,
    searchQuery: ''
  });

  // 3. Spatial Overlay Visibility State
  const [layers, setLayers] = useState<LayerVisibility>({
    plumeCones: true,
    clusterHulls: true,
    pulseRings: true,
    thermalHeatmap: true,
    windVectors: true,
    graticuleGrid: true
  });

  // 4. Forward Dispersion Simulation Playback State (0h to +24h)
  const [simHourOffset, setSimHourOffset] = useState<number>(6.0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<1 | 5>(1);

  // 5. GIS Viewport Camera State
  const [activeTheater, setActiveTheater] = useState<TheaterRegion>('GLOBAL');
  const [camera, setCamera] = useState<{ centerLat: number; centerLon: number; zoom: number }>({
    centerLat: 16,
    centerLon: 8,
    zoom: 1.0
  });
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);

  // 6. Selected Incident / Modals / Vim Command Line
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('FIRMS-CA-001');
  const [leftDeckOpen, setLeftDeckOpen] = useState<boolean>(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(true);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [ingestText, setIngestText] = useState<string>('');
  const [exportToast, setExportToast] = useState<string | null>(null);

  // Telescope Fuzzy Finder State
  const [isTelescopeOpen, setIsTelescopeOpen] = useState<boolean>(false);
  const [telescopeQuery, setTelescopeQuery] = useState<string>('');
  const [telescopeHighlightIdx, setTelescopeHighlightIdx] = useState<number>(0);

  // Neovim Ex-Command Line (`:`) State
  const [vimCommandInput, setVimCommandInput] = useState<string>('');
  const [isCommandFocused, setIsCommandFocused] = useState<boolean>(false);
  const [vimStatusMsg, setVimStatusMsg] = useState<string>(
    '-- Neovim Geospatial Engine Ready | Press / for :Telescope | j/k to cycle anomalies --'
  );
  const commandInputRef = useRef<HTMLInputElement | null>(null);

  // Execute Custom Hooks
  const filteredIncidents = useGISFilter(incidents, filters);
  const { simulatedIncidents, thermalClusters } = usePlumeSimulation(
    filteredIncidents,
    simHourOffset,
    filters.clusterRadiusKm
  );

  // Selected Incident Simulation Object
  const selectedSim = useMemo(() => {
    return (
      simulatedIncidents.find((s) => s.incident.incident_id === selectedIncidentId) ||
      simulatedIncidents[0] ||
      null
    );
  }, [simulatedIncidents, selectedIncidentId]);

  // Telescope Filtered Results
  const telescopeResults = useMemo(() => {
    const q = telescopeQuery.trim().toLowerCase();
    if (!q) return simulatedIncidents;
    return simulatedIncidents.filter(
      (s) =>
        s.incident.name.toLowerCase().includes(q) ||
        s.incident.incident_id.toLowerCase().includes(q) ||
        s.incident.fuel_type.toLowerCase().includes(q) ||
        s.incident.satellite_sensor.toLowerCase().includes(q) ||
        s.incident.region.toLowerCase().includes(q)
    );
  }, [simulatedIncidents, telescopeQuery]);

  // Global KPI Aggregations
  const globalKpis = useMemo(() => {
    const activeCount = simulatedIncidents.length;
    const totalFrpMw = simulatedIncidents.reduce((sum, s) => sum + s.incident.frp, 0);
    const totalFrpGw = totalFrpMw / 1000;
    const totalBurnedHa = simulatedIncidents.reduce(
      (sum, s) => sum + s.rothermel.simulatedBurnAreaHa,
      0
    );
    const totalPopRisk = simulatedIncidents.reduce(
      (sum, s) => sum + s.incident.population_at_risk,
      0
    );
    const highestRiskIncident =
      [...simulatedIncidents].sort(
        (a, b) => b.incident.population_at_risk - a.incident.population_at_risk
      )[0] || null;

    return {
      activeCount,
      totalFrpGw,
      totalBurnedHa,
      totalPopRisk,
      highestRiskIncident
    };
  }, [simulatedIncidents]);

  // Forward Dispersion Simulation Playback Loop
  useEffect(() => {
    if (!isSimPlaying) return;
    const intervalMs = 80;
    const timer = setInterval(() => {
      setSimHourOffset((prev) => {
        const step = 0.15 * simSpeedMultiplier;
        if (prev + step >= 24.0) {
          return 0.0;
        }
        return Number((prev + step).toFixed(2));
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isSimPlaying, simSpeedMultiplier]);

  // Theater Jump Handler
  const handleSelectTheater = useCallback((theater: TheaterRegion) => {
    const preset = THEATER_PRESETS[theater];
    setActiveTheater(theater);
    setActiveBuffer('VIEWPORT_GIS');
    setCamera({
      centerLat: preset.centerLat,
      centerLon: preset.centerLon,
      zoom: preset.zoom
    });
    setVimStatusMsg(`:MapJump ${theater} -> (${preset.centerLat}°, ${preset.centerLon}°) @ ${preset.zoom}x`);
  }, []);

  // Center on Specific Incident
  const focusOnIncident = useCallback((inc: WildfireIncident) => {
    setSelectedIncidentId(inc.incident_id);
    setRightDrawerOpen(true);
    setCamera((prev) => ({
      centerLat: inc.latitude,
      centerLon: inc.longitude,
      zoom: Math.max(prev.zoom, 5.5)
    }));
    setVimStatusMsg(`:Inspect ${inc.incident_id} "${inc.name}" [FRP=${inc.frp}MW]`);
  }, []);

  // Export CSV / GeoJSON Utility
  const handleExportData = useCallback(
    (format: 'CSV' | 'GEOJSON') => {
      let content = '';
      let mime = 'text/csv';
      let ext = 'csv';

      if (format === 'CSV') {
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
            `"${s.incident.name}"`,
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
            s.incident.wind_vector.speed_mps.toFixed(1),
            s.incident.wind_vector.bearing_deg.toFixed(0)
          ].join(',')
        );
        content = [headers.join(','), ...rows].join('\n');
      } else {
        mime = 'application/geo+json';
        ext = 'geojson';
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
              rothermel_spread_mpm: Number(s.rothermel.rateOfSpreadMpm.toFixed(2)),
              fireline_intensity_kwm: Number(s.rothermel.firelineIntensityKwm.toFixed(0)),
              fre_terajoules: Number(s.fre.freTerajoules.toFixed(2)),
              pm25_emission_gs: Number(s.fre.pm25EmissionRateGs.toFixed(1)),
              simulated_burn_area_ha: Number(s.rothermel.simulatedBurnAreaHa.toFixed(1))
            }
          }))
        };
        content = JSON.stringify(geojson, null, 2);
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pyrowatch_firms_telemetry_${simHourOffset}h.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const msg = `:w! pyrowatch_firms_telemetry_${simHourOffset}h.${ext} (${simulatedIncidents.length} records written)`;
      setExportToast(msg);
      setVimStatusMsg(msg);
      setTimeout(() => setExportToast(null), 3200);
    },
    [simulatedIncidents, simHourOffset]
  );

  // Global Vim Keybindings (`j`, `k`, `/`, `:`, `1`, `2`, `3`, `Escape`)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInputActive = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        setIsTelescopeOpen(false);
        setIsIngestModalOpen(false);
        setIsCommandFocused(false);
        commandInputRef.current?.blur();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsTelescopeOpen((prev) => !prev);
        setTelescopeHighlightIdx(0);
        return;
      }

      if (isTelescopeOpen) {
        if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
          e.preventDefault();
          setTelescopeHighlightIdx((prev) =>
            Math.min( Math.max(0, telescopeResults.length - 1), prev + 1)
          );
        } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
          e.preventDefault();
          setTelescopeHighlightIdx((prev) => Math.max(0, prev - 1));
        } else if (e.key === 'Enter' && telescopeResults[telescopeHighlightIdx]) {
          e.preventDefault();
          focusOnIncident(telescopeResults[telescopeHighlightIdx].incident);
          setIsTelescopeOpen(false);
        }
        return;
      }

      if (isInputActive) return;

      if (e.key === '/') {
        e.preventDefault();
        setIsTelescopeOpen(true);
        setTelescopeHighlightIdx(0);
      } else if (e.key === ':') {
        e.preventDefault();
        setIsCommandFocused(true);
        setVimCommandInput(':');
        setTimeout(() => commandInputRef.current?.focus(), 10);
      } else if (e.key === 'j') {
        e.preventDefault();
        if (simulatedIncidents.length === 0) return;
        const currIdx = simulatedIncidents.findIndex(
          (s) => s.incident.incident_id === selectedIncidentId
        );
        const nextIdx = (currIdx + 1) % simulatedIncidents.length;
        const nextInc = simulatedIncidents[nextIdx].incident;
        setSelectedIncidentId(nextInc.incident_id);
        setVimStatusMsg(`j -> [${nextIdx + 1}/${simulatedIncidents.length}] ${nextInc.incident_id} (${nextInc.name})`);
      } else if (e.key === 'k') {
        e.preventDefault();
        if (simulatedIncidents.length === 0) return;
        const currIdx = simulatedIncidents.findIndex(
          (s) => s.incident.incident_id === selectedIncidentId
        );
        const prevIdx =
          (currIdx - 1 + simulatedIncidents.length) % simulatedIncidents.length;
        const prevInc = simulatedIncidents[prevIdx].incident;
        setSelectedIncidentId(prevInc.incident_id);
        setVimStatusMsg(`k -> [${prevIdx + 1}/${simulatedIncidents.length}] ${prevInc.incident_id} (${prevInc.name})`);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsSimPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isTelescopeOpen,
    telescopeResults,
    telescopeHighlightIdx,
    simulatedIncidents,
    selectedIncidentId,
    focusOnIncident
  ]);

  // Execute Neovim Ex-Command (`:colorscheme`, `:sim`, `:export`, `:telescope`, etc.)
  const handleRunVimCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = vimCommandInput.trim().replace(/^:/, '').toLowerCase();
    setIsCommandFocused(false);
    commandInputRef.current?.blur();

    if (!raw) return;

    if (raw.startsWith('colorscheme ') || raw.startsWith('colo ')) {
      const arg = raw.split(/\s+/)[1] || '';
      const matched = (Object.keys(NVIM_THEMES) as NvimThemeId[]).find(
        (k) => k.includes(arg) || NVIM_THEMES[k].shortName.includes(arg)
      );
      if (matched) {
        setThemeId(matched);
        setVimStatusMsg(`:colorscheme ${matched} applied`);
      } else {
        setVimStatusMsg(`E185: Cannot find colorscheme '${arg}' (try tokyonight, catppuccin, gruvbox, kanagawa, rose-pine)`);
      }
    } else if (raw === 'telescope' || raw === 'find') {
      setIsTelescopeOpen(true);
    } else if (raw === 'ingest') {
      setIsIngestModalOpen(true);
    } else if (raw === 'sim play' || raw === 'play') {
      setIsSimPlaying(true);
      setVimStatusMsg(':sim play -> Forward Gaussian Plume & Rothermel integration active');
    } else if (raw === 'sim pause' || raw === 'pause' || raw === 'stop') {
      setIsSimPlaying(false);
      setVimStatusMsg(':sim pause -> Simulation halted');
    } else if (raw === 'sim 5x' || raw === '5x') {
      setSimSpeedMultiplier(5);
      setVimStatusMsg(':sim speed=5x');
    } else if (raw === 'sim 1x' || raw === '1x') {
      setSimSpeedMultiplier(1);
      setVimStatusMsg(':sim speed=1x');
    } else if (raw === 'export geojson' || raw === 'w geojson') {
      handleExportData('GEOJSON');
    } else if (raw === 'export csv' || raw === 'w csv' || raw === 'w') {
      handleExportData('CSV');
    } else if (raw === 'reset' || raw === 'e!') {
      resetDataset();
      setSimHourOffset(6.0);
      setVimStatusMsg(':e! Dataset and simulation clock reset to initial FIRMS epoch');
    } else if (raw === 'b1' || raw === 'gis') {
      setActiveBuffer('VIEWPORT_GIS');
    } else if (raw === 'b2' || raw === 'table') {
      setActiveBuffer('FIRMS_TABLE_CSV');
    } else if (raw === 'b3' || raw === 'core') {
      setActiveBuffer('ROTHERMEL_CORE_RS');
    } else {
      setVimStatusMsg(`E492: Not an editor command: ${raw} (try :colorscheme catppuccin, :telescope, :sim play, :w csv)`);
    }
    setVimCommandInput('');
  };

  // ==========================================================================
  // 9. INTERACTIVE 60FPS HTML5 CANVAS GIS CARTOGRAPHY ENGINE (THEME-REACTIVE)
  // ==========================================================================
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; lat: number; lon: number }>({
    x: 0,
    y: 0,
    lat: 0,
    lon: 0
  });

  const projectLatLonToXY = useCallback(
    (lat: number, lon: number, width: number, height: number) => {
      const baseScale = (width / 360) * camera.zoom;
      const x = width / 2 + (lon - camera.centerLon) * baseScale;
      const y = height / 2 - (lat - camera.centerLat) * baseScale * 1.15;
      return { x, y, scale: baseScale };
    },
    [camera]
  );

  const unprojectXYToLatLon = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const baseScale = (width / 360) * camera.zoom;
      const lon = camera.centerLon + (x - width / 2) / baseScale;
      const lat = camera.centerLat - (y - height / 2) / (baseScale * 1.15);
      return {
        lat: Math.max(-85, Math.min(85, lat)),
        lon: ((((lon + 180) % 360) + 360) % 360) - 180
      };
    },
    [camera]
  );

  // Canvas 60FPS Animation Loop (Adapts dynamically to active Neovim theme palette)
  useEffect(() => {
    let animationFrameId: number;
    let pulsePhase = 0;

    const renderGISCanvas = () => {
      pulsePhase = (pulsePhase + 0.025) % (Math.PI * 2);
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        animationFrameId = requestAnimationFrame(renderGISCanvas);
        return;
      }

      const rect = container.getBoundingClientRect();
      const W = Math.max(320, rect.width);
      const H = Math.max(240, rect.height);
      const dpr = window.devicePixelRatio || 1;
      if (
        canvas.width !== Math.floor(W * dpr) ||
        canvas.height !== Math.floor(H * dpr)
      ) {
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Neovim Theme Ocean Backdrop
      ctx.fillStyle = theme.crust;
      ctx.fillRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.08, W / 2, H / 2, W * 0.75);
      bgGrad.addColorStop(0, theme.bg);
      bgGrad.addColorStop(1, theme.crust);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Coordinate Graticule Grid
      if (layers.graticuleGrid) {
        const stepDeg = camera.zoom >= 4.5 ? 2 : camera.zoom >= 2.2 ? 10 : 20;
        ctx.strokeStyle = `${theme.border}77`;
        ctx.lineWidth = 0.75;
        ctx.fillStyle = theme.comment;
        ctx.font = '9px monospace';

        for (let lon = -180; lon <= 180; lon += stepDeg) {
          const { x } = projectLatLonToXY(0, lon, W, H);
          if (x >= 0 && x <= W) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
            ctx.fillText(`${lon >= 0 ? `+${lon}°E` : `${lon}°W`}`, x + 4, H - 8);
          }
        }

        for (let lat = -80; lat <= 80; lat += stepDeg) {
          const { y } = projectLatLonToXY(lat, 0, W, H);
          if (y >= 0 && y <= H) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
            ctx.fillText(`${lat >= 0 ? `+${lat}°N` : `${lat}°S`}`, 6, y - 4);
          }
        }

        // Equator & Prime Meridian
        const eq = projectLatLonToXY(0, 0, W, H);
        ctx.strokeStyle = `${theme.blue}66`;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, eq.y);
        ctx.lineTo(W, eq.y);
        ctx.moveTo(eq.x, 0);
        ctx.lineTo(eq.x, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. World & Regional Vector Coastlines
      ctx.fillStyle = theme.surface;
      ctx.strokeStyle = theme.blue;
      ctx.lineWidth = 1.35;

      for (const poly of WORLD_LANDMASS_POLYGONS) {
        ctx.beginPath();
        poly.coords.forEach(([lon, lat], idx) => {
          const { x, y } = projectLatLonToXY(lat, lon, W, H);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // 3B. Topographic Ridgelines & Regional Cartographic Labels
      ctx.save();
      ctx.strokeStyle = `${theme.comment}99`;
      ctx.lineWidth = 1.1;
      ctx.setLineDash([2, 3]);
      for (const ridge of THEATER_TOPO_RIDGES) {
        ctx.beginPath();
        ridge.coords.forEach(([lon, lat], idx) => {
          const { x, y } = projectLatLonToXY(lat, lon, W, H);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        if (camera.zoom >= 2.2) {
          const lbl = projectLatLonToXY(ridge.labelLat, ridge.labelLon, W, H);
          if (lbl.x > 20 && lbl.x < W - 80 && lbl.y > 20 && lbl.y < H - 20) {
            ctx.fillStyle = `${theme.subtext}aa`;
            ctx.font = 'italic 9px monospace';
            ctx.fillText(`▲ ${ridge.name}`, lbl.x, lbl.y);
          }
        }
      }
      ctx.restore();

      // 4. Thermal Density Heatmap Layer
      if (layers.thermalHeatmap) {
        for (const sim of simulatedIncidents) {
          const { x, y } = projectLatLonToXY(
            sim.incident.latitude,
            sim.incident.longitude,
            W,
            H
          );
          if (x < -120 || x > W + 120 || y < -120 || y > H + 120) continue;

          const heatRadius = Math.max(
            24,
            Math.min(110, (sim.incident.frp / 12) * Math.sqrt(camera.zoom))
          );
          const grad = ctx.createRadialGradient(x, y, 2, x, y, heatRadius);
          grad.addColorStop(0, `${theme.red}44`);
          grad.addColorStop(0.45, `${theme.orange}22`);
          grad.addColorStop(1, `${theme.yellow}00`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, heatRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Hotspot Cluster Tessellation Polygons (<15km thermal fronts)
      if (layers.clusterHulls) {
        for (const cluster of thermalClusters) {
          if (cluster.hullPoints.length < 3) continue;
          ctx.save();
          ctx.beginPath();
          cluster.hullPoints.forEach((pt, idx) => {
            const { x, y } = projectLatLonToXY(pt.lat, pt.lon, W, H);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = `${theme.red}26`;
          ctx.fill();
          ctx.strokeStyle = theme.orange;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          if (camera.zoom >= 2.5) {
            const cPos = projectLatLonToXY(cluster.centroid.lat, cluster.centroid.lon, W, H);
            ctx.fillStyle = theme.crust;
            ctx.strokeStyle = theme.red;
            ctx.lineWidth = 1;
            const badgeText = `${cluster.cluster_id}::${(cluster.aggregateFrpMw / 1000).toFixed(2)}GW`;
            const tw = ctx.measureText(badgeText).width + 12;
            ctx.fillRect(cPos.x - tw / 2, cPos.y - 26, tw, 16);
            ctx.strokeRect(cPos.x - tw / 2, cPos.y - 26, tw, 16);
            ctx.fillStyle = theme.red;
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(badgeText, cPos.x, cPos.y - 15);
            ctx.textAlign = 'start';
          }
          ctx.restore();
        }
      }

      // 6. Plume Vector Cones (6h, 12h, 24h & Forward Sim Gaussian Plume Corridors)
      if (layers.plumeCones) {
        for (const sim of simulatedIncidents) {
          const { latitude, longitude, wind_vector } = sim.incident;
          const origin = projectLatLonToXY(latitude, longitude, W, H);
          if (origin.x < -200 || origin.x > W + 200 || origin.y < -200 || origin.y > H + 200) {
            continue;
          }

          const isSelected = selectedSim?.incident.incident_id === sim.incident.incident_id;
          const bearing = wind_vector.bearing_deg;

          const activeReachKm = sim.activeSimCorridorKm * (camera.zoom < 2 ? 2.4 : 1.0);
          const halfSpreadDeg = isSelected ? 19 : 14;

          const leftTip = destinationCoordinate(
            latitude,
            longitude,
            bearing - halfSpreadDeg,
            activeReachKm
          );
          const centerTip = destinationCoordinate(
            latitude,
            longitude,
            bearing,
            activeReachKm * 1.08
          );
          const rightTip = destinationCoordinate(
            latitude,
            longitude,
            bearing + halfSpreadDeg,
            activeReachKm
          );

          const pLeft = projectLatLonToXY(leftTip.lat, leftTip.lon, W, H);
          const pCenter = projectLatLonToXY(centerTip.lat, centerTip.lon, W, H);
          const pRight = projectLatLonToXY(rightTip.lat, rightTip.lon, W, H);

          const plumeGrad = ctx.createLinearGradient(
            origin.x,
            origin.y,
            pCenter.x,
            pCenter.y
          );
          if (isSelected) {
            plumeGrad.addColorStop(0, `${theme.red}88`);
            plumeGrad.addColorStop(0.5, `${theme.orange}44`);
            plumeGrad.addColorStop(1, `${theme.magenta}08`);
          } else {
            plumeGrad.addColorStop(0, `${theme.orange}55`);
            plumeGrad.addColorStop(0.6, `${theme.yellow}22`);
            plumeGrad.addColorStop(1, `${theme.comment}00`);
          }

          ctx.beginPath();
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(pLeft.x, pLeft.y);
          ctx.quadraticCurveTo(pCenter.x, pCenter.y, pRight.x, pRight.y);
          ctx.closePath();
          ctx.fillStyle = plumeGrad;
          ctx.fill();

          if (isSelected || camera.zoom >= 3.5) {
            ctx.strokeStyle = isSelected ? theme.yellow : `${theme.orange}55`;
            ctx.lineWidth = isSelected ? 1.4 : 0.8;
            ctx.stroke();
          }

          if (isSelected) {
            const corridors = [
              { label: '6h', km: sim.corridor6hKm * (camera.zoom < 2 ? 2.2 : 1.0), color: theme.yellow },
              { label: '12h', km: sim.corridor12hKm * (camera.zoom < 2 ? 2.2 : 1.0), color: theme.orange },
              { label: '24h', km: sim.corridor24hKm * (camera.zoom < 2 ? 2.2 : 1.0), color: theme.red }
            ];

            for (const corr of corridors) {
              const cL = destinationCoordinate(latitude, longitude, bearing - halfSpreadDeg, corr.km);
              const cM = destinationCoordinate(latitude, longitude, bearing, corr.km * 1.06);
              const cR = destinationCoordinate(latitude, longitude, bearing + halfSpreadDeg, corr.km);

              const ptL = projectLatLonToXY(cL.lat, cL.lon, W, H);
              const ptM = projectLatLonToXY(cM.lat, cM.lon, W, H);
              const ptR = projectLatLonToXY(cR.lat, cR.lon, W, H);

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(ptL.x, ptL.y);
              ctx.quadraticCurveTo(ptM.x, ptM.y, ptR.x, ptR.y);
              ctx.strokeStyle = corr.color;
              ctx.lineWidth = 1.2;
              ctx.setLineDash([3, 3]);
              ctx.stroke();
              ctx.fillStyle = corr.color;
              ctx.font = 'bold 9px monospace';
              ctx.fillText(`${corr.label}(${Math.round(corr.km)}km)`, ptM.x + 4, ptM.y);
              ctx.restore();
            }
          }
        }
      }

      // 7. Wind Vectors, Dynamic FRP Pulse Rings & Target Reticles
      for (const sim of simulatedIncidents) {
        const { latitude, longitude, frp, wind_vector } = sim.incident;
        const { x, y } = projectLatLonToXY(latitude, longitude, W, H);
        if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;

        const isSelected = selectedSim?.incident.incident_id === sim.incident.incident_id;

        if (layers.windVectors && (camera.zoom >= 2.5 || isSelected)) {
          const rad = ((wind_vector.bearing_deg - 90) * Math.PI) / 180;
          const vecLen = Math.min(48, 16 + wind_vector.speed_mps * 2.0);
          const vx = x + Math.cos(rad) * vecLen;
          const vy = y + Math.sin(rad) * vecLen;

          ctx.strokeStyle = isSelected ? theme.cyan : `${theme.yellow}aa`;
          ctx.lineWidth = isSelected ? 1.8 : 1.1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(vx, vy);
          ctx.stroke();
        }

        if (layers.pulseRings) {
          const freqMultiplier = 1.0 + (frp / 350) * 1.5;
          const localPhase = (pulsePhase * freqMultiplier + (frp % 7)) % (Math.PI * 2);
          const normPulse = localPhase / (Math.PI * 2);
          const maxPulseR =
            (8 + Math.sqrt(frp) * 0.95 + simHourOffset * 0.45) *
            Math.pow(camera.zoom, 0.35);
          const currentPulseR = 4 + normPulse * maxPulseR;

          ctx.beginPath();
          ctx.arc(x, y, currentPulseR, 0, Math.PI * 2);
          ctx.strokeStyle = frp >= 350 ? theme.red : theme.orange;
          ctx.globalAlpha = (1 - normPulse) * 0.85;
          ctx.lineWidth = isSelected ? 2.2 : 1.4;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        const coreR = Math.max(
          3.2,
          Math.min(10, (2.2 + Math.sqrt(frp) * 0.22) * Math.pow(camera.zoom, 0.25))
        );
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = frp >= 400 ? theme.red : frp >= 250 ? theme.orange : theme.yellow;
        ctx.fill();
        ctx.strokeStyle = isSelected ? theme.fg : theme.crust;
        ctx.lineWidth = isSelected ? 2.0 : 1.0;
        ctx.stroke();

        // Neovim Visual-Block Target Reticle for Selected Incident
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = theme.cyan;
          ctx.lineWidth = 1.5;
          const retR = coreR + 9;
          ctx.strokeRect(x - retR, y - retR, retR * 2, retR * 2);

          ctx.fillStyle = theme.crust;
          const tag = `${sim.incident.incident_id} [${frp.toFixed(0)}MW]`;
          const tw = ctx.measureText(tag).width + 8;
          ctx.fillRect(x + retR + 4, y - 8, tw, 15);
          ctx.strokeRect(x + retR + 4, y - 8, tw, 15);
          ctx.fillStyle = theme.cyan;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(tag, x + retR + 8, y + 3);
          ctx.restore();
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(renderGISCanvas);
    };

    animationFrameId = requestAnimationFrame(renderGISCanvas);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    activeBuffer,
    theme,
    camera,
    layers,
    simulatedIncidents,
    thermalClusters,
    selectedSim,
    simHourOffset,
    projectLatLonToXY
  ]);

  // Canvas Mouse Interaction Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      lat: camera.centerLat,
      lon: camera.centerLon
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const coords = unprojectXYToLatLon(localX, localY, rect.width, rect.height);
    setCursorCoords(coords);

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const baseScale = (rect.width / 360) * camera.zoom;
      const newLon = dragStartRef.current.lon - dx / baseScale;
      const newLat = Math.max(
        -75,
        Math.min(75, dragStartRef.current.lat + dy / (baseScale * 1.15))
      );
      setCamera((prev) => ({
        ...prev,
        centerLat: newLat,
        centerLon: ((((newLon + 180) % 360) + 360) % 360) - 180
      }));
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const moveDist = Math.hypot(
      e.clientX - dragStartRef.current.x,
      e.clientY - dragStartRef.current.y
    );
    isDraggingRef.current = false;

    if (moveDist < 6 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      let closestSim: IncidentPhysicsSimulation | null = null;
      let minDistPx = 22;

      for (const sim of simulatedIncidents) {
        const { x, y } = projectLatLonToXY(
          sim.incident.latitude,
          sim.incident.longitude,
          rect.width,
          rect.height
        );
        const d = Math.hypot(clickX - x, clickY - y);
        if (d < minDistPx) {
          minDistPx = d;
          closestSim = sim;
        }
      }

      if (closestSim) {
        setSelectedIncidentId(closestSim.incident.incident_id);
        setRightDrawerOpen(true);
        setVimStatusMsg(
          `Selected ${closestSim.incident.incident_id} :: R=${closestSim.rothermel.rateOfSpreadMpm.toFixed(1)}m/min`
        );
      }
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(0.85, Math.min(16.0, Number((prev.zoom * zoomFactor).toFixed(2))))
    }));
  };

  const loadSampleFirmsCsv = () => {
    const sample = [
      'incident_id,name,latitude,longitude,frp,brightness_temp_k,confidence_pct,satellite_sensor,fuel_type,slope_deg,wind_speed_mps,wind_bearing_deg,population_at_risk',
      'FIRMS-NRT-901,Tahoe Basin Plume Alpha,39.09,-120.03,512.4,421.8,99,VIIRS NOAA-20,Chaparral,31,14.8,65,42500',
      'FIRMS-NRT-902,Tahoe Basin Emerald Ridge,39.14,-120.08,438.0,409.2,98,VIIRS SNPP,Chaparral,28,14.2,68,38900',
      'FIRMS-NRT-903,Corsica Bonifacio Scrub Fire,41.42,9.18,345.6,393.5,95,MODIS Aqua,Mediterranean Scrub,26,12.5,110,27400'
    ].join('\n');
    setIngestText(sample);
  };

  const handleExecuteIngest = async () => {
    try {
      const count = await ingestPayloadAsync(ingestText);
      setIsIngestModalOpen(false);
      setIngestText('');
      setVimStatusMsg(`:IngestFIRMS -> Appended ${count} orbital thermal anomalies to buffer`);
    } catch (err: any) {
      setIngestionError(err?.message || 'Failed to parse FIRMS payload.');
    }
  };

  // Determine Current Vim Mode Indicator for Lualine
  const vimModeInfo = useMemo(() => {
    if (isTelescopeOpen) return { label: 'TELESCOPE', color: theme.magenta };
    if (isCommandFocused) return { label: 'COMMAND', color: theme.yellow };
    if (isSimPlaying) return { label: 'SIM-RUN', color: theme.red };
    if (activeBuffer === 'FIRMS_TABLE_CSV') return { label: 'BUFFER-CSV', color: theme.green };
    if (activeBuffer === 'ROTHERMEL_CORE_RS') return { label: 'NORMAL-RS', color: theme.orange };
    return { label: 'NORMAL', color: theme.blue };
  }, [isTelescopeOpen, isCommandFocused, isSimPlaying, activeBuffer, theme]);

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col font-mono select-none"
      style={{
        backgroundColor: theme.crust,
        color: theme.fg
      }}
    >
      {/* ====================================================================
          1. TOP NEOVIM BUFFERLINE.NVIM & COLORSCHEME SWITCHER BAR
         ==================================================================== */}
      <header
        className="h-9 shrink-0 border-b px-2 flex items-center justify-between gap-2 z-30 text-xs"
        style={{
          backgroundColor: theme.crust,
          borderColor: theme.border
        }}
      >
        {/* Left: Neovim Buffer Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <div
            className="px-2 py-1 font-bold flex items-center gap-1.5 mr-1 rounded-sm"
            style={{ backgroundColor: theme.surface, color: theme.orange }}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>NVIM::PYROWATCH</span>
          </div>

          {[
            {
              id: 'VIEWPORT_GIS' as ActiveBufferTab,
              num: 1,
              name: 'viewport.gis',
              mod: '[+]',
              icon: <Compass className="w-3.5 h-3.5" style={{ color: theme.cyan }} />
            },
            {
              id: 'FIRMS_TABLE_CSV' as ActiveBufferTab,
              num: 2,
              name: 'firms_nrt.csv',
              mod: `[${simulatedIncidents.length}]`,
              icon: <Table className="w-3.5 h-3.5" style={{ color: theme.green }} />
            },
            {
              id: 'ROTHERMEL_CORE_RS' as ActiveBufferTab,
              num: 3,
              name: 'rothermel_plume.rs',
              mod: '[RO]',
              icon: <Code2 className="w-3.5 h-3.5" style={{ color: theme.orange }} />
            }
          ].map((buf) => {
            const isAct = activeBuffer === buf.id;
            return (
              <button
                key={buf.id}
                onClick={() => {
                  setActiveBuffer(buf.id);
                  setVimStatusMsg(`:buffer ${buf.num} (${buf.name})`);
                }}
                className="px-2.5 py-1 rounded-t-sm border-t-2 flex items-center gap-1.5 transition"
                style={{
                  backgroundColor: isAct ? theme.bg : theme.mantle,
                  borderColor: isAct ? theme.blue : 'transparent',
                  color: isAct ? theme.fg : theme.comment
                }}
              >
                <span style={{ color: theme.magenta }}>{buf.num}:</span>
                {buf.icon}
                <span className={isAct ? 'font-bold' : ''}>{buf.name}</span>
                <span className="text-[10px]" style={{ color: isAct ? theme.yellow : theme.comment }}>
                  {buf.mod}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center: Live Neovim Colorscheme Switcher Pills */}
        <div className="hidden lg:flex items-center gap-1">
          <span className="text-[10px] mr-1 flex items-center gap-1" style={{ color: theme.comment }}>
            <Palette className="w-3 h-3" style={{ color: theme.magenta }} />
            colorscheme:
          </span>
          {(Object.keys(NVIM_THEMES) as NvimThemeId[]).map((tKey) => {
            const p = NVIM_THEMES[tKey];
            const active = themeId === tKey;
            return (
              <button
                key={tKey}
                onClick={() => {
                  setThemeId(tKey);
                  setVimStatusMsg(`:colorscheme ${tKey}`);
                }}
                className="px-2 py-0.5 rounded-sm text-[11px] border transition flex items-center gap-1.5"
                style={{
                  backgroundColor: active ? p.surface : p.mantle,
                  borderColor: active ? p.blue : p.border,
                  color: active ? p.fg : p.comment
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: p.orange }}
                />
                <span>{p.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Telescope Trigger, Ingest & Export Commands */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsTelescopeOpen(true);
              setTelescopeHighlightIdx(0);
            }}
            className="px-2 py-0.5 rounded-sm border text-[11px] flex items-center gap-1.5 transition"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.magenta,
              color: theme.fg
            }}
            title="Open Telescope Fuzzy Finder (/ or Ctrl+K)"
          >
            <Search className="w-3 h-3" style={{ color: theme.magenta }} />
            <span>:Telescope</span>
            <kbd
              className="px-1 text-[9px] rounded-sm"
              style={{ backgroundColor: theme.crust, color: theme.cyan }}
            >
              /
            </kbd>
          </button>

          <button
            onClick={() => setIsIngestModalOpen(true)}
            className="px-2 py-0.5 rounded-sm border text-[11px] flex items-center gap-1 transition"
            style={{
              backgroundColor: `${theme.orange}20`,
              borderColor: theme.orange,
              color: theme.orange
            }}
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">:Ingest</span>
          </button>

          <button
            onClick={() => handleExportData('GEOJSON')}
            className="px-2 py-0.5 rounded-sm border text-[11px] hidden md:flex items-center gap-1 transition"
            style={{
              backgroundColor: theme.mantle,
              borderColor: theme.border,
              color: theme.cyan
            }}
          >
            <Download className="w-3 h-3" />
            <span>:w geojson</span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          2. SUB-HEADER TELEMETRY STRUCT BAR (GLOBAL KPI REGISTERS)
         ==================================================================== */}
      <div
        className="h-8 shrink-0 border-b px-3 flex items-center justify-between gap-4 text-[11px] overflow-x-auto"
        style={{
          backgroundColor: theme.mantle,
          borderColor: theme.border
        }}
      >
        <div className="flex items-center gap-4 shrink-0">
          <span>
            <span style={{ color: theme.magenta }}>let</span>{' '}
            <span style={{ color: theme.cyan }}>anomalies</span> ={' '}
            <span style={{ color: theme.yellow }} className="font-bold">
              {globalKpis.activeCount}
            </span>
            <span style={{ color: theme.comment }}>/{incidents.length};</span>
          </span>

          <span>
            <span style={{ color: theme.magenta }}>let</span>{' '}
            <span style={{ color: theme.cyan }}>radiative_gw</span> ={' '}
            <span style={{ color: theme.orange }} className="font-bold">
              {globalKpis.totalFrpGw.toFixed(2)}
            </span>
            <span style={{ color: theme.comment }}>_GW;</span>
          </span>

          <span>
            <span style={{ color: theme.magenta }}>let</span>{' '}
            <span style={{ color: theme.cyan }}>burned_ha</span> ={' '}
            <span style={{ color: theme.red }} className="font-bold">
              {Math.round(globalKpis.totalBurnedHa).toLocaleString()}
            </span>
            <span style={{ color: theme.comment }}>_ha (@+{simHourOffset.toFixed(1)}h);</span>
          </span>

          <span className="hidden lg:inline">
            <span style={{ color: theme.magenta }}>let</span>{' '}
            <span style={{ color: theme.cyan }}>tessellated_hulls</span> ={' '}
            <span style={{ color: theme.green }} className="font-bold">
              {thermalClusters.length}
            </span>
            <span style={{ color: theme.comment }}> (&lt;{filters.clusterRadiusKm}km);</span>
          </span>

          <span className="hidden xl:inline">
            <span style={{ color: theme.magenta }}>let</span>{' '}
            <span style={{ color: theme.cyan }}>max_pop_exposure</span> ={' '}
            <span style={{ color: theme.red }} className="font-bold">
              {globalKpis.highestRiskIncident
                ? `${(globalKpis.highestRiskIncident.incident.population_at_risk / 1000).toFixed(1)}k`
                : '0'}
            </span>
            <span style={{ color: theme.comment }}>;</span>
          </span>
        </div>

        {/* Theater Quick-Jump Pills */}
        <div className="flex items-center gap-1 shrink-0">
          <span style={{ color: theme.comment }}>theater:</span>
          {(Object.keys(THEATER_PRESETS) as TheaterRegion[]).map((key) => {
            const active = activeTheater === key;
            return (
              <button
                key={key}
                onClick={() => handleSelectTheater(key)}
                className="px-1.5 py-0.5 rounded-sm text-[10px] transition"
                style={{
                  backgroundColor: active ? theme.blue : 'transparent',
                  color: active ? theme.crust : theme.subtext,
                  fontWeight: active ? 'bold' : 'normal'
                }}
              >
                {key === 'GLOBAL' ? 'GLOBAL' : key.slice(0, 4)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          3. MAIN TILED NEOVIM WORKSPACE (3 FLOATING BORDERED SPLITS)
         ==================================================================== */}
      <div className="flex-1 flex gap-1.5 p-1.5 min-h-0 overflow-hidden">
        {/* ------------------------------------------------------------------
            SPLIT [2]: CENTER WORKSPACE (INTERACTIVE GIS MAP + OPTIONAL :SPLIT BUFFER)
           ------------------------------------------------------------------ */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 min-h-0">
          <NvimSplitBox
            title={`[2] canvas://world_thermal_grid.gis [crs=WGS84 | zoom=${camera.zoom.toFixed(1)}x | theater=${activeTheater}]`}
            rightBadge={
              isSimPlaying ? `SIM RUNNING (${simSpeedMultiplier}x)` : `T+${simHourOffset.toFixed(1)}h`
            }
            theme={theme}
            accentColor={isSimPlaying ? theme.red : theme.blue}
            className="flex-1 min-h-[280px]"
          >
            <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
              {/* Top Floating Map Controls */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <button
                    onClick={() => setLeftDeckOpen((o) => !o)}
                    className="px-2 py-1 rounded-sm border text-[10px] flex items-center gap-1 shadow-md"
                    style={{
                      backgroundColor: `${theme.crust}ee`,
                      borderColor: theme.border,
                      color: theme.fg
                    }}
                  >
                    {leftDeckOpen ? '◀ hide_tree' : '▶ show_tree'}
                  </button>

                  {/* Quick Theater Camera Reset */}
                  <button
                    onClick={() => handleSelectTheater('GLOBAL')}
                    className="px-2 py-1 rounded-sm border text-[10px] flex items-center gap-1 shadow-md"
                    style={{
                      backgroundColor: `${theme.crust}ee`,
                      borderColor: theme.border,
                      color: theme.cyan
                    }}
                    title="Reset to Global Map View"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>:GlobalView</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <div
                    className="flex items-center rounded-sm border p-0.5 shadow-md"
                    style={{ backgroundColor: `${theme.crust}ee`, borderColor: theme.border }}
                  >
                    <button
                      onClick={() =>
                        setCamera((p) => ({
                          ...p,
                          zoom: Math.min(16, Number((p.zoom * 1.35).toFixed(2)))
                        }))
                      }
                      className="px-2 py-0.5 font-bold hover:opacity-80"
                      style={{ color: theme.cyan }}
                      title="Zoom In"
                    >
                      +
                    </button>
                    <span className="px-2 text-[10px] font-bold" style={{ color: theme.yellow }}>
                      {camera.zoom.toFixed(1)}x
                    </span>
                    <button
                      onClick={() =>
                        setCamera((p) => ({
                          ...p,
                          zoom: Math.max(0.85, Number((p.zoom / 1.35).toFixed(2)))
                        }))
                      }
                      className="px-2 py-0.5 font-bold hover:opacity-80"
                      style={{ color: theme.cyan }}
                      title="Zoom Out"
                    >
                      -
                    </button>
                  </div>

                  <button
                    onClick={() => setRightDrawerOpen((o) => !o)}
                    className="px-2 py-1 rounded-sm border text-[10px] shadow-md"
                    style={{
                      backgroundColor: `${theme.crust}ee`,
                      borderColor: theme.border,
                      color: theme.fg
                    }}
                  >
                    {rightDrawerOpen ? 'hide_inspect ▶' : '◀ show_inspect'}
                  </button>
                </div>
              </div>

              {/* Export Toast */}
              {exportToast && (
                <div
                  className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-sm border text-xs flex items-center gap-2 shadow-xl"
                  style={{
                    backgroundColor: theme.crust,
                    borderColor: theme.green,
                    color: theme.green
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{exportToast}</span>
                </div>
              )}

              {/* Interactive GIS Map Canvas Container */}
              <div
                ref={containerRef}
                className="flex-1 w-full h-full min-h-[240px] relative cursor-crosshair overflow-hidden"
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                  className="block w-full h-full"
                />

                {/* Bottom-Left Floating Coordinate & Keybind Legend */}
                <div
                  className="absolute bottom-2.5 left-2.5 pointer-events-none px-2.5 py-1 rounded-sm border text-[10px] flex items-center gap-2.5 shadow-md"
                  style={{
                    backgroundColor: `${theme.crust}e6`,
                    borderColor: theme.border
                  }}
                >
                  <span style={{ color: theme.cyan }}>
                    WGS84 ({cursorCoords ? cursorCoords.lat.toFixed(2) : camera.centerLat.toFixed(2)}°,{' '}
                    {cursorCoords ? cursorCoords.lon.toFixed(2) : camera.centerLon.toFixed(2)}°)
                  </span>
                  <span style={{ color: theme.comment }}>|</span>
                  <span style={{ color: theme.yellow }}>drag: pan · scroll: zoom</span>
                  <span style={{ color: theme.comment }}>|</span>
                  <span style={{ color: theme.orange }}>j/k: cycle fires</span>
                  <span style={{ color: theme.comment }}>|</span>
                  <span style={{ color: theme.magenta }}>/: telescope</span>
                </div>

                {/* Bottom-Right Map Legend */}
                <div
                  className="absolute bottom-2.5 right-2.5 pointer-events-none hidden sm:flex items-center gap-3 px-2.5 py-1 rounded-sm border text-[10px] shadow-md"
                  style={{
                    backgroundColor: `${theme.crust}e6`,
                    borderColor: theme.border
                  }}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: theme.red }}
                    />
                    <span style={{ color: theme.subtext }}>&gt;400MW Extreme</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: theme.orange }}
                    />
                    <span style={{ color: theme.subtext }}>250-400MW High</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: theme.yellow }}
                    />
                    <span style={{ color: theme.subtext }}>&lt;250MW Mod</span>
                  </span>
                </div>
              </div>

              {/* Bottom Temporal Scrubber & Dispersion Simulation Bar */}
              <div
                className="h-11 shrink-0 border-t px-3 flex items-center justify-between gap-4 text-[11px]"
                style={{
                  backgroundColor: theme.crust,
                  borderColor: theme.border
                }}
              >
                {/* Lookback Window Buttons */}
                <div className="flex items-center gap-1">
                  <span style={{ color: theme.comment }}>window:</span>
                  {[
                    { label: '6h', hours: 6 },
                    { label: '24h', hours: 24 },
                    { label: '48h', hours: 48 },
                    { label: '7d', hours: 168 }
                  ].map((win) => {
                    const active = filters.lookbackHours === win.hours;
                    return (
                      <button
                        key={win.hours}
                        onClick={() =>
                          setFilters((prev) => ({ ...prev, lookbackHours: win.hours }))
                        }
                        className="px-2 py-0.5 rounded-sm border transition"
                        style={{
                          backgroundColor: active ? theme.blue : theme.mantle,
                          borderColor: active ? theme.blue : theme.border,
                          color: active ? theme.crust : theme.subtext,
                          fontWeight: active ? 'bold' : 'normal'
                        }}
                      >
                        -{win.label}
                      </button>
                    );
                  })}
                </div>

                {/* Playback Controls */}
                <div className="flex-1 max-w-xl flex items-center gap-2.5">
                  <button
                    onClick={() => setIsSimPlaying((p) => !p)}
                    className="px-2.5 py-1 rounded-sm font-bold flex items-center gap-1.5 transition"
                    style={{
                      backgroundColor: isSimPlaying ? theme.red : theme.green,
                      color: theme.crust
                    }}
                  >
                    {isSimPlaying ? (
                      <>
                        <Pause className="w-3 h-3 fill-current" />
                        <span>:pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>:sim_run</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setSimSpeedMultiplier((s) => (s === 1 ? 5 : 1))}
                    className="px-2 py-1 rounded-sm border font-bold"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.yellow
                    }}
                  >
                    {simSpeedMultiplier}x
                  </button>

                  <div className="flex-1 flex items-center gap-2">
                    <span style={{ color: theme.cyan }} className="shrink-0">
                      T+{simHourOffset.toFixed(1)}h
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={0.5}
                      value={simHourOffset}
                      onChange={(e) => setSimHourOffset(Number(e.target.value))}
                      className="w-full cursor-pointer"
                      style={{ accentColor: theme.orange }}
                    />
                    <span style={{ color: theme.comment }} className="shrink-0">
                      +24h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </NvimSplitBox>

          {/* OPTIONAL HORIZONTAL NEOVIM SPLIT (:split) FOR BUFFER 2 (CSV TABLE) OR BUFFER 3 (RUST CORE) */}
          {activeBuffer !== 'VIEWPORT_GIS' && (
            <NvimSplitBox
              title={
                activeBuffer === 'FIRMS_TABLE_CSV'
                  ? `[split] buffer://firms_nrt_telemetry.csv [${simulatedIncidents.length} rows]`
                  : `[split] buffer://src/physics/rothermel_gaussian_core.rs [RO]`
              }
              rightBadge=":q to close split"
              theme={theme}
              accentColor={theme.magenta}
              className="h-64 shrink-0"
            >
              <div className="flex-1 overflow-auto relative" style={{ backgroundColor: theme.bg }}>
                <button
                  onClick={() => setActiveBuffer('VIEWPORT_GIS')}
                  className="sticky top-2 float-right mr-3 px-2 py-0.5 rounded-sm border text-[10px] z-10"
                  style={{
                    backgroundColor: theme.crust,
                    borderColor: theme.border,
                    color: theme.red
                  }}
                >
                  :q close_split
                </button>

                {activeBuffer === 'FIRMS_TABLE_CSV' && (
                  <div className="p-2.5 text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr
                          className="border-b text-[11px]"
                          style={{ borderColor: theme.border, color: theme.magenta }}
                        >
                          <th className="py-1 px-2">LN</th>
                          <th className="py-1 px-2">INCIDENT_ID</th>
                          <th className="py-1 px-2">NAME</th>
                          <th className="py-1 px-2">LAT, LON</th>
                          <th className="py-1 px-2">FRP (MW)</th>
                          <th className="py-1 px-2">R (m/min)</th>
                          <th className="py-1 px-2">I_B (kW/m)</th>
                          <th className="py-1 px-2">FRE (TJ)</th>
                          <th className="py-1 px-2">FUEL_MODEL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulatedIncidents.map((sim, idx) => {
                          const isSel = sim.incident.incident_id === selectedIncidentId;
                          return (
                            <tr
                              key={sim.incident.incident_id}
                              onClick={() => focusOnIncident(sim.incident)}
                              className="border-b cursor-pointer transition"
                              style={{
                                borderColor: `${theme.border}66`,
                                backgroundColor: isSel ? theme.surface : 'transparent'
                              }}
                            >
                              <td className="py-1 px-2" style={{ color: theme.comment }}>
                                {idx + 1}
                              </td>
                              <td className="py-1 px-2 font-bold" style={{ color: theme.cyan }}>
                                {sim.incident.incident_id}
                              </td>
                              <td className="py-1 px-2" style={{ color: theme.fg }}>
                                {sim.incident.name}
                              </td>
                              <td className="py-1 px-2" style={{ color: theme.subtext }}>
                                {sim.incident.latitude.toFixed(2)}, {sim.incident.longitude.toFixed(2)}
                              </td>
                              <td className="py-1 px-2 font-bold" style={{ color: theme.red }}>
                                {sim.incident.frp.toFixed(1)}
                              </td>
                              <td className="py-1 px-2 font-bold" style={{ color: theme.orange }}>
                                {sim.rothermel.rateOfSpreadMpm.toFixed(2)}
                              </td>
                              <td className="py-1 px-2" style={{ color: theme.yellow }}>
                                {Math.round(sim.rothermel.firelineIntensityKwm).toLocaleString()}
                              </td>
                              <td className="py-1 px-2" style={{ color: theme.green }}>
                                {sim.fre.freTerajoules.toFixed(2)}
                              </td>
                              <td className="py-1 px-2" style={{ color: theme.magenta }}>
                                {sim.incident.fuel_type}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeBuffer === 'ROTHERMEL_CORE_RS' && selectedSim && (
                  <div className="p-3 text-xs leading-relaxed">
                    {[
                      `// PYROWATCH-CORE :: LIVE ROTHERMEL & 2D GAUSSIAN PLUME EVALUATION BUFFER`,
                      `#[derive(Debug, Clone, Serialize)]`,
                      `pub struct RothermelSurfaceSpread {`,
                      `    pub incident_id: "${selectedSim.incident.incident_id}",`,
                      `    pub fuel_model: "${FUEL_MODEL_SPECS[selectedSim.incident.fuel_type].code}",`,
                      `    pub wind_factor_phi_w: ${selectedSim.rothermel.windFactorPhiW.toFixed(4)},`,
                      `    pub slope_factor_phi_s: ${selectedSim.rothermel.slopeFactorPhiS.toFixed(4)},`,
                      `    pub reaction_intensity_kw_m2: ${selectedSim.rothermel.reactionIntensityKwm2.toFixed(2)},`,
                      `    pub rate_of_spread_m_min: ${selectedSim.rothermel.rateOfSpreadMpm.toFixed(3)},`,
                      `    pub byram_fireline_intensity_kw_m: ${selectedSim.rothermel.firelineIntensityKwm.toFixed(1)},`,
                      `    pub flame_length_m: ${selectedSim.rothermel.flameLengthM.toFixed(2)},`,
                      `    pub projected_burn_area_ha: ${selectedSim.rothermel.simulatedBurnAreaHa.toFixed(1)},`,
                      `}`
                    ].map((line, i) => (
                      <div key={i} className="flex gap-4">
                        <span
                          className="w-6 text-right select-none shrink-0"
                          style={{ color: theme.comment }}
                        >
                          {i + 1}
                        </span>
                        <pre
                          className="whitespace-pre-wrap font-mono"
                          style={{
                            color: line.trim().startsWith('//')
                              ? theme.comment
                              : line.includes('pub struct') || line.includes('#[')
                              ? theme.magenta
                              : line.includes('pub ')
                              ? theme.cyan
                              : theme.fg
                          }}
                        >
                          {line}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </NvimSplitBox>
          )}
        </div>

        {/* ------------------------------------------------------------------
            SPLIT [3]: RIGHT INSPECTOR (SYNTAX-HIGHLIGHTED TELEMETRY & CHARTS)
           ------------------------------------------------------------------ */}
        {rightDrawerOpen && (
          <NvimSplitBox
            title="[3] inspect://rothermel_plume.rs"
            rightBadge={selectedSim ? selectedSim.incident.incident_id : 'NONE'}
            theme={theme}
            className="w-96 shrink-0"
          >
            {selectedSim ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
                {/* Syntax-Highlighted Rust Struct Telemetry Header */}
                <div
                  className="p-2.5 rounded-sm border space-y-1"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: theme.magenta }} className="font-bold">
                      pub struct ThermalAnomaly &#123;
                    </span>
                    <span
                      className="px-1.5 py-0.2 rounded-sm text-[10px] font-bold"
                      style={{
                        backgroundColor: `${selectedSim.fre.severityColor}25`,
                        color: selectedSim.fre.severityColor
                      }}
                    >
                      {selectedSim.fre.severityClass}
                    </span>
                  </div>

                  <div className="pl-3 space-y-0.5">
                    <div>
                      <span style={{ color: theme.cyan }}>name</span>:{' '}
                      <span style={{ color: theme.yellow }}>"{selectedSim.incident.name}"</span>,
                    </div>
                    <div>
                      <span style={{ color: theme.cyan }}>coords</span>:{' '}
                      <span style={{ color: theme.orange }}>
                        ({selectedSim.incident.latitude.toFixed(3)}°,{' '}
                        {selectedSim.incident.longitude.toFixed(3)}°)
                      </span>
                      ,
                    </div>
                    <div>
                      <span style={{ color: theme.cyan }}>sensor</span>:{' '}
                      <span style={{ color: theme.green }}>
                        "{selectedSim.incident.satellite_sensor}"
                      </span>{' '}
                      <span style={{ color: theme.comment }}>
                        // conf={selectedSim.incident.confidence_pct}%
                      </span>
                    </div>
                    <div>
                      <span style={{ color: theme.cyan }}>frp_mw</span>:{' '}
                      <span style={{ color: theme.red }} className="font-bold">
                        {selectedSim.incident.frp.toFixed(1)}
                      </span>
                      , <span style={{ color: theme.cyan }}>temp_k</span>:{' '}
                      <span style={{ color: theme.orange }}>
                        {selectedSim.incident.brightness_temp_k.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div style={{ color: theme.magenta }} className="font-bold">
                    &#125;
                  </div>
                </div>

                {/* Rothermel Surface Spread Metrics */}
                <div
                  className="p-2.5 rounded-sm border space-y-2"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: theme.blue }} className="font-bold">
                      impl RothermelSpread &#123;
                    </span>
                    <span style={{ color: theme.yellow }}>{selectedSim.incident.fuel_type}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className="p-2 rounded-sm border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px]">
                        rate_of_spread (R)
                      </div>
                      <div style={{ color: theme.orange }} className="text-sm font-bold">
                        {selectedSim.rothermel.rateOfSpreadMpm.toFixed(1)} m/min
                      </div>
                      <div style={{ color: theme.subtext }} className="text-[10px]">
                        {selectedSim.rothermel.rateOfSpreadKmh.toFixed(2)} km/h
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-sm border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px]">
                        fireline_intensity (I_B)
                      </div>
                      <div style={{ color: theme.red }} className="text-sm font-bold">
                        {Math.round(selectedSim.rothermel.firelineIntensityKwm).toLocaleString()}{' '}
                        kW/m
                      </div>
                      <div style={{ color: theme.subtext }} className="text-[10px]">
                        L_f = {selectedSim.rothermel.flameLengthM.toFixed(1)} m
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-sm border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px]">
                         integrated_fre & Q
                      </div>
                      <div style={{ color: theme.yellow }} className="text-xs font-bold">
                        {selectedSim.fre.freTerajoules.toFixed(2)} TJ
                      </div>
                      <div style={{ color: theme.subtext }} className="text-[10px]">
                        Q_pm25: {(selectedSim.fre.pm25EmissionRateGs / 1000).toFixed(2)} kg/s
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-sm border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px]">
                        ellipse_area (+{simHourOffset.toFixed(0)}h)
                      </div>
                      <div style={{ color: theme.green }} className="text-xs font-bold">
                        {Math.round(selectedSim.rothermel.simulatedBurnAreaHa).toLocaleString()} ha
                      </div>
                      <div style={{ color: theme.subtext }} className="text-[10px]">
                        {selectedSim.rothermel.ellipseMajorAxisKm.toFixed(1)}×
                        {selectedSim.rothermel.ellipseMinorAxisKm.toFixed(1)} km
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2D Gaussian Plume Chart */}
                <GaussianPlumeChart
                  profile={selectedSim.plumeProfile}
                  emissionRateGs={selectedSim.fre.pm25EmissionRateGs}
                  windSpeedMps={selectedSim.incident.wind_vector.speed_mps}
                  theme={theme}
                />

                {/* Wind Rose & Topographic Slope */}
                <WindRoseCompass
                  bearingDeg={selectedSim.incident.wind_vector.bearing_deg}
                  speedMps={selectedSim.incident.wind_vector.speed_mps}
                  slopeDeg={selectedSim.incident.slope_deg}
                  theme={theme}
                />

                {/* Population Risk & Containment Progress */}
                <div
                  className="p-2.5 rounded-sm border space-y-2"
                  style={{
                    backgroundColor: theme.bg,
                    borderColor: theme.border
                  }}
                >
                  <div className="flex justify-between">
                    <span style={{ color: theme.cyan }}>pop_exposure_25km:</span>
                    <span style={{ color: theme.red }} className="font-bold">
                      {selectedSim.incident.population_at_risk.toLocaleString()} citizens
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span style={{ color: theme.comment }}>containment_pct</span>
                      <span style={{ color: theme.green }}>
                        {selectedSim.incident.estimated_containment_pct}%
                      </span>
                    </div>
                    <div
                      className="w-full h-2 rounded-sm overflow-hidden border"
                      style={{ backgroundColor: theme.crust, borderColor: theme.border }}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${selectedSim.incident.estimated_containment_pct}%`,
                          backgroundColor: theme.green
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs" style={{ color: theme.comment }}>
                // E404: No matching thermal anomalies in buffer
              </div>
            )}
          </NvimSplitBox>
        )}
      </div>

      {/* ====================================================================
          4. BOTTOM LUALINE.NVIM STATUSLINE & INTERACTIVE :COMMAND LINE
         ==================================================================== */}
      <footer className="shrink-0 z-30 select-none">
        {/* Lualine Statusbar */}
        <div
          className="h-6 flex items-center justify-between text-[11px] border-t"
          style={{
            backgroundColor: theme.mantle,
            borderColor: theme.border
          }}
        >
          {/* Left Lualine Segments */}
          <div className="flex items-center h-full">
            <div
              className="px-3 h-full flex items-center font-bold tracking-wider"
              style={{
                backgroundColor: vimModeInfo.color,
                color: theme.crust
              }}
            >
              {vimModeInfo.label}
            </div>
            <div
              className="px-2.5 h-full flex items-center gap-1.5 border-r"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.green
              }}
            >
              <GitBranch className="w-3 h-3" />
              <span>main*</span>
            </div>
            <div
              className="px-3 h-full flex items-center gap-2"
              style={{ color: theme.subtext }}
            >
              <span>{theme.id}</span>
              <span style={{ color: theme.comment }}>|</span>
              <span style={{ color: theme.orange }}>
                FRP Σ={globalKpis.totalFrpGw.toFixed(2)}GW
              </span>
            </div>
          </div>

          {/* Right Lualine Segments */}
          <div className="flex items-center h-full">
            <div
              className="px-3 h-full hidden sm:flex items-center gap-2 border-l"
              style={{ borderColor: theme.border, color: theme.cyan }}
            >
              <span>
                {cursorCoords
                  ? `${cursorCoords.lat.toFixed(2)}°, ${cursorCoords.lon.toFixed(2)}°`
                  : `${camera.centerLat.toFixed(2)}°, ${camera.centerLon.toFixed(2)}°`}
              </span>
            </div>
            <div
              className="px-2.5 h-full hidden md:flex items-center border-l"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.subtext
              }}
            >
              utf-8 [unix] · rust/gis
            </div>
            <div
              className="px-3 h-full flex items-center font-bold"
              style={{
                backgroundColor: vimModeInfo.color,
                color: theme.crust
              }}
            >
              {simulatedIncidents.findIndex(
                (s) => s.incident.incident_id === selectedIncidentId
              ) + 1}
              /{simulatedIncidents.length} Top
            </div>
          </div>
        </div>

        {/* Interactive Ex-Command Line (`:`) */}
        <form
          onSubmit={handleRunVimCommand}
          className="h-6 px-2 flex items-center justify-between text-[11px] border-t"
          style={{
            backgroundColor: theme.crust,
            borderColor: theme.border
          }}
        >
          <div className="flex-1 flex items-center gap-1">
            <span style={{ color: theme.yellow }} className="font-bold">
              :
            </span>
            <input
              ref={commandInputRef}
              type="text"
              value={vimCommandInput}
              onFocus={() => setIsCommandFocused(true)}
              onBlur={() => setIsCommandFocused(false)}
              onChange={(e) => setVimCommandInput(e.target.value)}
              placeholder={vimStatusMsg}
              className="w-full bg-transparent focus:outline-none font-mono text-[11px]"
              style={{
                color: isCommandFocused ? theme.fg : theme.comment
              }}
            />
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[10px]" style={{ color: theme.comment }}>
            <span>cmds:</span>
            <button
              type="button"
              onClick={() => {
                setThemeId('catppuccin-mocha');
                setVimStatusMsg(':colorscheme catppuccin-mocha');
              }}
              className="hover:underline"
              style={{ color: theme.magenta }}
            >
              :colo catppuccin
            </button>
            <button
              type="button"
              onClick={() => {
                setThemeId('gruvbox-material');
                setVimStatusMsg(':colorscheme gruvbox-material');
              }}
              className="hover:underline"
              style={{ color: theme.orange }}
            >
              :colo gruvbox
            </button>
            <button
              type="button"
              onClick={() => setIsTelescopeOpen(true)}
              className="hover:underline"
              style={{ color: theme.cyan }}
            >
              :telescope
            </button>
          </div>
        </form>
      </footer>

      {/* ====================================================================
          5. TELESCOPE.NVIM FUZZY FINDER FLOATING MODAL (/ OR CTRL+K)
         ==================================================================== */}
      {isTelescopeOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsTelescopeOpen(false)}
        >
          <div
            className="max-w-4xl w-full h-[460px] grid grid-cols-1 md:grid-cols-12 gap-2 p-2 rounded-sm border shadow-2xl"
            style={{
              backgroundColor: theme.crust,
              borderColor: theme.magenta
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Pane: Telescope Prompt + Results List */}
            <NvimSplitBox
              title="╭─ Telescope Find Thermal Anomalies ──╮"
              rightBadge={`${telescopeResults.length} / ${simulatedIncidents.length}`}
              theme={theme}
              accentColor={theme.magenta}
              className="md:col-span-7 h-full"
            >
              <div
                className="p-2 border-b flex items-center gap-2"
                style={{ borderColor: theme.border, backgroundColor: theme.bg }}
              >
                <span style={{ color: theme.magenta }} className="font-bold">
                  &gt;
                </span>
                <input
                  type="text"
                  autoFocus
                  value={telescopeQuery}
                  onChange={(e) => {
                    setTelescopeQuery(e.target.value);
                    setTelescopeHighlightIdx(0);
                  }}
                  placeholder="Fuzzy search by name, region, fuel, sensor, or ID..."
                  className="w-full bg-transparent text-xs focus:outline-none font-mono"
                  style={{ color: theme.fg }}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 text-xs">
                {telescopeResults.map((sim, idx) => {
                  const isHi = idx === telescopeHighlightIdx;
                  return (
                    <div
                      key={sim.incident.incident_id}
                      onMouseEnter={() => setTelescopeHighlightIdx(idx)}
                      onClick={() => {
                        focusOnIncident(sim.incident);
                        setIsTelescopeOpen(false);
                      }}
                      className="px-2 py-1.5 rounded-sm cursor-pointer flex items-center justify-between"
                      style={{
                        backgroundColor: isHi ? theme.surface : 'transparent',
                        color: isHi ? theme.fg : theme.subtext
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span style={{ color: isHi ? theme.magenta : theme.comment }}>
                          {isHi ? '❯' : ' '}
                        </span>
                        <span style={{ color: theme.cyan }} className="font-bold">
                          {sim.incident.incident_id}
                        </span>
                        <span className="truncate">{sim.incident.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px]">
                        <span style={{ color: theme.yellow }}>{sim.incident.fuel_type}</span>
                        <span style={{ color: theme.red }} className="font-bold">
                          {sim.incident.frp.toFixed(0)}MW
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </NvimSplitBox>

            {/* Right Pane: Telescope Live Physics Preview */}
            <NvimSplitBox
              title="╭─ Live Physics Preview ──╮"
              rightBadge="rothermel.rs"
              theme={theme}
              accentColor={theme.cyan}
              className="hidden md:flex md:col-span-5 h-full"
            >
              {telescopeResults[telescopeHighlightIdx] ? (
                (() => {
                  const prev = telescopeResults[telescopeHighlightIdx];
                  return (
                    <div className="p-3 space-y-2.5 text-[11px] overflow-y-auto">
                      <div className="font-bold text-xs" style={{ color: theme.yellow }}>
                        {prev.incident.name}
                      </div>
                      <div style={{ color: theme.comment }}>
                        // {prev.incident.region} · {prev.incident.satellite_sensor}
                      </div>
                      <div
                        className="p-2 rounded-sm border space-y-1"
                        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                      >
                        <div>
                          <span style={{ color: theme.cyan }}>frp_megawatts:</span>{' '}
                          <span style={{ color: theme.red }} className="font-bold">
                            {prev.incident.frp.toFixed(1)} MW
                          </span>
                        </div>
                        <div>
                          <span style={{ color: theme.cyan }}>rate_of_spread_R:</span>{' '}
                          <span style={{ color: theme.orange }} className="font-bold">
                            {prev.rothermel.rateOfSpreadMpm.toFixed(2)} m/min
                          </span>
                        </div>
                        <div>
                          <span style={{ color: theme.cyan }}>byram_intensity:</span>{' '}
                          <span style={{ color: theme.yellow }}>
                            {Math.round(prev.rothermel.firelineIntensityKwm).toLocaleString()} kW/m
                          </span>
                        </div>
                        <div>
                          <span style={{ color: theme.cyan }}>flame_length:</span>{' '}
                          <span style={{ color: theme.green }}>
                            {prev.rothermel.flameLengthM.toFixed(1)} m
                          </span>
                        </div>
                        <div>
                          <span style={{ color: theme.cyan }}>fre_terajoules:</span>{' '}
                          <span style={{ color: theme.magenta }}>
                            {prev.fre.freTerajoules.toFixed(2)} TJ
                          </span>
                        </div>
                        <div>
                          <span style={{ color: theme.cyan }}>pm25_10km_downwind:</span>{' '}
                          <span style={{ color: theme.red }}>
                            {prev.plumeProfile[1]?.centerlinePm25.toFixed(1)} µg/m³
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px]" style={{ color: theme.comment }}>
                        Press <kbd style={{ color: theme.cyan }}>Enter</kbd> to jump camera to
                        target coordinates.
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="p-4 text-xs" style={{ color: theme.comment }}>
                  No matching thermal anomalies.
                </div>
              )}
            </NvimSplitBox>
          </div>
        </div>
      )}

      {/* ====================================================================
          6. NASA FIRMS CSV / GEOJSON INGESTION FLOATING WINDOW
         ==================================================================== */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <NvimSplitBox
            title="╭─ :IngestFIRMS // NASA VIIRS & MODIS NRT Telemetry Parser ──╮"
            rightBadge="CSV | GeoJSON"
            theme={theme}
            accentColor={theme.orange}
            className="max-w-2xl w-full p-3 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: theme.subtext }}>
                Paste NASA FIRMS NRT CSV rows or GeoJSON FeatureCollection:
              </span>
              <button
                onClick={loadSampleFirmsCsv}
                className="underline font-bold"
                style={{ color: theme.yellow }}
              >
                :read sample_firms_batch.csv
              </button>
            </div>

            <textarea
              rows={7}
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
              placeholder="incident_id,name,latitude,longitude,frp,brightness_temp_k..."
              className="w-full rounded-sm border p-2.5 text-xs font-mono focus:outline-none"
              style={{
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.green
              }}
            />

            {ingestionError && (
              <div
                className="p-2 rounded-sm border text-xs flex items-center gap-2"
                style={{
                  backgroundColor: `${theme.red}20`,
                  borderColor: theme.red,
                  color: theme.red
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{ingestionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsIngestModalOpen(false)}
                className="px-3 py-1 rounded-sm border text-xs"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.subtext
                }}
              >
                :q! Cancel
              </button>
              <button
                onClick={handleExecuteIngest}
                className="px-3 py-1 rounded-sm font-bold text-xs"
                style={{
                  backgroundColor: theme.orange,
                  color: theme.crust
                }}
              >
                :w! Parse &amp; Project
              </button>
            </div>
          </NvimSplitBox>
        </div>
      )}
    </div>
  );
}