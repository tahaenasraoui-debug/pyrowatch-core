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
  bg: string; // Main editor / ocean backdrop
  mantle: string; // Darker sidebar / statusline / landmass fill
  crust: string; // Deepest border / terminal backdrop
  surface: string; // Floating window / card surface
  border: string; // Crisp 1px split border
  fg: string; // Primary syntax foreground
  subtext: string; // Secondary identifier text
  comment: string; // Line numbers & comments
  blue: string; // Keywords / Functions / Normal Mode
  magenta: string; // Types / Structs / Telescope Mode
  red: string; // Extreme FRP / Errors / Sim-Run Mode
  orange: string; // Constants / High FRP / Numbers
  yellow: string; // Strings / Moderate FRP / Warnings
  green: string; // Low FRP / Git branch / Insert Mode
  cyan: string; // Operators / Coordinates / Fields
}

export type ActiveBufferTab =
  | 'VIEWPORT_GIS'
  | 'FIRMS_TABLE_CSV'
  | 'ROTHERMEL_CORE_RS'
  | 'FIREFINDER_TUI'
  | 'HELP_DOCS';

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
  speed_mps: number; // meters per second at 10m height
  bearing_deg: number; // direction wind is blowing TOWARDS (0 = N, 90 = E, 180 = S, 270 = W)
}

export interface LookoutTower {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  elevationFt: number;
  established: number;
  status: 'ACTIVE_STAFFED' | 'HISTORIC_PRESERVED' | 'AUTOMATED_OPTICAL';
}

export interface SuppressionTactics {
  vlatDrops: number;
  dozerLineKm: number;
  backburnActive: boolean;
  retardantApplied: boolean;
}

export interface PhysicsOverrides {
  windSpeedMps?: number;
  windBearingDeg?: number;
  deadFuelMoisturePct?: number;
  slopePct?: number;
}

export interface AlbiniSpottingMetrics {
  maxSpottingDistanceKm: number;
  spottingRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  flameHeightM: number;
}

export interface TriangulationSolution {
  lat: number;
  lon: number;
  distFromAkm: number;
  distFromBkm: number;
  errorRadiusKm: number;
  elevationEstFt: number;
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
  suppression?: SuppressionTactics;
  overrides?: PhysicsOverrides;
}

export interface RothermelMetrics {
  rateOfSpreadMpm: number; // R in meters / minute
  rateOfSpreadKmh: number; // R in km / hour
  reactionIntensityKwm2: number; // I_R in kW/m^2
  firelineIntensityKwm: number; // Byram's intensity I_B in kW/m
  flameLengthM: number; // Flame length L_f in meters
  windFactorPhiW: number; // Dimensionless wind multiplier
  slopeFactorPhiS: number; // Dimensionless slope multiplier
  initialBurnAreaHa: number; // Estimated current area (hectares)
  simulatedBurnAreaHa: number; // Projected area after +simHours
  ellipseMajorAxisKm: number; // Downwind elliptical spread length (km)
  ellipseMinorAxisKm: number; // Crosswind elliptical spread width (km)
  spotting: AlbiniSpottingMetrics;
  isExtinguished: boolean;
  suppressedByRetardant: boolean;
  effectiveContainmentPct: number;
}

export interface PlumeConcentrationPoint {
  distanceKm: number;
  centerlinePm25: number; // ug/m^3 along plume axis (y = 0)
  sigmaY: number; // Horizontal dispersion coeff (m)
  sigmaZ: number; // Vertical dispersion coeff (m)
  aqiCategory: 'Good' | 'Moderate' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  colorHex: string;
}

export interface FREMetrics {
  freGigajoules: number; // Time-integrated Fire Radiative Energy (GJ)
  freTerajoules: number; // Time-integrated Fire Radiative Energy (TJ)
  biomassCombustionRateKgs: number; // kg/s of dry biomass consumed
  pm25EmissionRateGs: number; // Q in grams/second of PM2.5
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

export interface FuelModelPhysicalSpec {
  code: string;
  fuelLoadKgM2: number; // w_0: Ovendry fuel load (kg/m^2)
  savRatio: number; // sigma: Surface-area-to-volume ratio (m^-1)
  bedDepthM: number; // delta: Fuel bed depth (m)
  heatContentKjKg: number; // h: Low heat content (kJ/kg)
  moistureExtinction: number; // M_x: Moisture of extinction (fraction)
  packingRatioBeta: number; // beta: Packing ratio
  emissionFactorPm25: number; // g PM2.5 per kg dry fuel burned
  colorHex: string;
}

export interface TheaterPreset {
  label: string;
  centerLat: number;
  centerLon: number;
  zoom: number;
  subtitle: string;
}
