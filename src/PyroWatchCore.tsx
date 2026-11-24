import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Flame,
  Activity,
  Compass,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Crosshair,
  Search,
  Code2,
  Table,
  GitBranch,
  Volume2,
  VolumeX,
  Radio,
  SlidersHorizontal,
  HelpCircle,
  Plane,
  Truck,
  ShieldCheck
} from 'lucide-react';
import { lookoutSound } from './lib/audio';
import {
  HISTORIC_LOOKOUT_TOWERS,
  NVIM_THEMES,
  THEATER_BUTTONS,
  THEATER_PRESETS,
  THEATER_TOPO_RIDGES,
  WORLD_LANDMASS_POLYGONS
} from './lib/constants';
import {
  parseFirmsPayload,
  serializeIncidentsToCsv,
  serializeIncidentsToGeoJson
} from './lib/firmsParser';
import {
  computeAzimuthBearing,
  computeTriangulation,
  destinationCoordinate,
  formatBearingDms,
  formatBearingMils,
  formatBearingQuadrant,
  formatCoordinatesHemisphere
} from './lib/geodesy';
import { INITIAL_FIRMS_INCIDENTS } from './lib/incidents';
import {
  FUEL_MODEL_SPECS,
  computeThermalClusters,
  evaluateGaussianPlumeAt,
  getEffectiveSlopeDeg,
  getEffectiveWindBearingDeg,
  getEffectiveWindSpeedMps,
  simulateIncidentPhysics
} from './lib/physics';
import type {
  ActiveBufferTab,
  FuelModelType,
  GISFilterState,
  IncidentPhysicsSimulation,
  LayerVisibility,
  NvimThemeId,
  NvimThemePalette,
  PhysicsOverrides,
  PlumeConcentrationPoint,
  TheaterRegion,
  ThermalCluster,
  WildfireIncident
} from './lib/types';

const DEFAULT_LAYERS: LayerVisibility = {
  plumeCones: true,
  clusterHulls: true,
  pulseRings: true,
  thermalHeatmap: true,
  windVectors: true,
  graticuleGrid: true
};

// ============================================================================
// CUSTOM MODULAR HOOKS (useFireData, useGISFilter, usePlumeSimulation)
// ============================================================================

/**
 * Hook 1: `useFireData`
 * Manages the active NASA FIRMS & EONET telemetry dataset and supports
 * asynchronous CSV / GeoJSON ingestion with automatic schema normalization.
 */
function useFireData() {
  const [incidents, setIncidents] = useState<WildfireIncident[]>(INITIAL_FIRMS_INCIDENTS);
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  const ingestPayloadAsync = useCallback(async (rawText: string): Promise<number> => {
    setIngestionError(null);
    await new Promise((resolve) => setTimeout(resolve, 180)); // Async ingestion pipeline

    const parsedIncidents = parseFirmsPayload(rawText);
    setIncidents((prev) => [...parsedIncidents, ...prev]);
    return parsedIncidents.length;
  }, []);

  const resetDataset = useCallback(() => {
    setIncidents(INITIAL_FIRMS_INCIDENTS);
    setIngestionError(null);
  }, []);

  const addCustomSpotFire = useCallback(
    (lat: number, lon: number, name?: string, fuelType?: FuelModelType) => {
      const newInc: WildfireIncident = {
        incident_id: `IGN-SPOT-${Date.now().toString().slice(-4)}`,
        name: name || `Custom Spot Ignition (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
        region: 'GLOBAL',
        latitude: lat,
        longitude: lon,
        frp: 850.0,
        brightness_temp_k: 412.0,
        confidence_pct: 98,
        detection_utc: new Date().toISOString(),
        hours_ago: 0.2,
        satellite_sensor: 'VIIRS NOAA-20',
        fuel_type: fuelType || 'Chaparral',
        estimated_containment_pct: 5,
        slope_deg: 24,
        ambient_humidity_pct: 12,
        population_at_risk: 12500,
        wind_vector: { speed_mps: 14.5, bearing_deg: 215 },
        suppression: { vlatDrops: 0, dozerLineKm: 0, backburnActive: false, retardantApplied: false }
      };
      setIncidents((prev) => [newInc, ...prev]);
      return newInc;
    },
    []
  );

  const applyTacticalSuppression = useCallback(
    (incidentId: string, tactic: 'VLAT' | 'DOZER' | 'BACKBURN') => {
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.incident_id !== incidentId) return inc;
          const current = inc.suppression || {
            vlatDrops: 0,
            dozerLineKm: 0,
            backburnActive: false,
            retardantApplied: false
          };
          if (tactic === 'VLAT') {
            return {
              ...inc,
              suppression: {
                ...current,
                vlatDrops: current.vlatDrops + 1,
                retardantApplied: true
              }
            };
          } else if (tactic === 'DOZER') {
            return {
              ...inc,
              suppression: {
                ...current,
                dozerLineKm: current.dozerLineKm + 2.5
              }
            };
          } else {
            return {
              ...inc,
              suppression: {
                ...current,
                backburnActive: true
              }
            };
          }
        })
      );
    },
    []
  );

  const updateIncidentOverrides = useCallback(
    (incidentId: string, overrides: Partial<PhysicsOverrides>) => {
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.incident_id !== incidentId) return inc;
          return {
            ...inc,
            overrides: {
              ...inc.overrides,
              ...overrides
            }
          };
        })
      );
    },
    []
  );

  const resetIncidentOverrides = useCallback((incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.incident_id !== incidentId) return inc;
        return {
          ...inc,
          overrides: undefined,
          suppression: undefined
        };
      })
    );
  }, []);

  return {
    incidents,
    ingestPayloadAsync,
    resetDataset,
    ingestionError,
    setIngestionError,
    addCustomSpotFire,
    applyTacticalSuppression,
    updateIncidentOverrides,
    resetIncidentOverrides
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
    return filteredIncidents.map((incident) => simulateIncidentPhysics(incident, simHourOffset));
  }, [filteredIncidents, simHourOffset]);

  const thermalClusters = useMemo<ThermalCluster[]>(() => {
    return computeThermalClusters(simulatedIncidents, clusterRadiusKm);
  }, [simulatedIncidents, clusterRadiusKm]);

  return { simulatedIncidents, thermalClusters };
}

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
  const cleanTitle = title.replace(/^╭─\s*/, '').replace(/\s*──╮$/, '').trim();
  const borderCol = accentColor ? `${accentColor}40` : theme.border;
  return (
    <div
      className={`relative rounded-[2px] border flex flex-col overflow-hidden ${className}`}
      style={{
        backgroundColor: theme.mantle,
        borderColor: borderCol
      }}
    >
      {/* Sleek Neovim Window Statusline / Titlebar */}
      <div
        className="h-6 px-2.5 flex items-center justify-between text-[11px] font-mono shrink-0 border-b select-none"
        style={{
          backgroundColor: theme.crust,
          borderColor: theme.border,
          color: theme.fg
        }}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: accentColor || theme.blue }}
          />
          <span className="font-semibold tracking-tight truncate">{cleanTitle}</span>
        </div>
        {rightBadge && (
          <span
            className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono shrink-0 border"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: accentColor || theme.subtext
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
    ingestionError,
    setIngestionError,
    addCustomSpotFire,
    applyTacticalSuppression,
    updateIncidentOverrides,
    resetIncidentOverrides
  } = useFireData();

  // Audio Telemetry Synthesizer State
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);

  // Click-to-Ignite Spot Fire Tool State
  const [isIgniteMode, setIsIgniteMode] = useState<boolean>(false);

  // Osborne Firefinder Lookout Tower State
  const [primaryTowerId, setPrimaryTowerId] = useState<string>('TWR-TAMALPAIS');
  const [secondaryTowerId, setSecondaryTowerId] = useState<string>('TWR-BUCK-ROCK');
  const [manualAzimuthDeg, setManualAzimuthDeg] = useState<number>(142.5);
  const [isManualAim, setIsManualAim] = useState<boolean>(false);

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

  // 3. Forward Dispersion Simulation Playback State (0h to +24h)
  const [simHourOffset, setSimHourOffset] = useState<number>(6.0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<1 | 5>(1);

  // 4. GIS Viewport Camera State
  const [activeTheater, setActiveTheater] = useState<TheaterRegion>('GLOBAL');
  const [camera, setCamera] = useState<{ centerLat: number; centerLon: number; zoom: number }>({
    centerLat: 16,
    centerLon: 8,
    zoom: 1.0
  });
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);

  // 5. Selected Incident / Modals / Vim Command Line
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('FIRMS-CA-001');
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(true);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [ingestText, setIngestText] = useState<string>('');

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

  // Scale Web Audio combustion rumble to the active incident's radiative power (FRP)
  useEffect(() => {
    if (!audioEnabled || !selectedSim) return;
    const effectiveFrp = selectedSim.rothermel.isExtinguished
      ? 0
      : selectedSim.rothermel.suppressedByRetardant
        ? selectedSim.incident.frp * 0.5
        : selectedSim.incident.frp;
    lookoutSound.updateThermalPower(effectiveFrp);
  }, [audioEnabled, selectedSim]);

  // Osborne Lookout Towers & Triangulation State
  const primaryTower = useMemo(
    () => HISTORIC_LOOKOUT_TOWERS.find((t) => t.id === primaryTowerId) || HISTORIC_LOOKOUT_TOWERS[0],
    [primaryTowerId]
  );
  const secondaryTower = useMemo(
    () => HISTORIC_LOOKOUT_TOWERS.find((t) => t.id === secondaryTowerId) || HISTORIC_LOOKOUT_TOWERS[1],
    [secondaryTowerId]
  );

  const primaryBearingToTarget = useMemo(() => {
    if (!selectedSim) return manualAzimuthDeg;
    return computeAzimuthBearing(
      primaryTower.latitude,
      primaryTower.longitude,
      selectedSim.incident.latitude,
      selectedSim.incident.longitude
    );
  }, [primaryTower, selectedSim, manualAzimuthDeg]);

  const activePrimaryBearing = isManualAim ? manualAzimuthDeg : primaryBearingToTarget;

  const secondaryBearingToTarget = useMemo(() => {
    if (!selectedSim) return (activePrimaryBearing + 45) % 360;
    return computeAzimuthBearing(
      secondaryTower.latitude,
      secondaryTower.longitude,
      selectedSim.incident.latitude,
      selectedSim.incident.longitude
    );
  }, [secondaryTower, selectedSim, activePrimaryBearing]);

  const triangulationSolution = useMemo(() => {
    return computeTriangulation(
      primaryTower,
      activePrimaryBearing,
      secondaryTower,
      secondaryBearingToTarget
    );
  }, [primaryTower, activePrimaryBearing, secondaryTower, secondaryBearingToTarget]);

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
      const content =
        format === 'CSV'
          ? serializeIncidentsToCsv(simulatedIncidents)
          : serializeIncidentsToGeoJson(simulatedIncidents, simHourOffset);
      const mime = format === 'CSV' ? 'text/csv' : 'application/geo+json';
      const ext = format === 'CSV' ? 'csv' : 'geojson';

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
      setVimStatusMsg(msg);
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
      lookoutSound.playSquelch();
    } else if (raw === 'b2' || raw === 'table') {
      setActiveBuffer('FIRMS_TABLE_CSV');
      lookoutSound.playSquelch();
    } else if (raw === 'b3' || raw === 'core') {
      setActiveBuffer('ROTHERMEL_CORE_RS');
      lookoutSound.playSquelch();
    } else if (raw === 'b4' || raw === 'firefinder' || raw === 'osborne') {
      setActiveBuffer('FIREFINDER_TUI');
      lookoutSound.playSquelch();
      setVimStatusMsg(':buffer 4 (firefinder.rs) [Osborne Lookout Station]');
    } else if (raw === 'b5' || raw === 'help' || raw === 'h') {
      setActiveBuffer('HELP_DOCS');
      lookoutSound.playSquelch();
      setVimStatusMsg(':help pyrowatch [Operator Manual & Equations]');
    } else if (raw === 'audio on') {
      const on = lookoutSound.setEnabled(true);
      setAudioEnabled(on);
      setVimStatusMsg(':audio on [VHF Radio & Thermal Rumble]');
    } else if (raw === 'audio off' || raw === 'mute') {
      lookoutSound.setEnabled(false);
      setAudioEnabled(false);
      setVimStatusMsg(':audio off [Muted]');
    } else if (raw === 'ignite') {
      setIsIgniteMode((p) => !p);
      setVimStatusMsg(':ignite -> Click anywhere on the map canvas to deploy a spot fire');
    } else if (raw === 'vlat' || raw === 'retardant') {
      if (selectedSim) {
        applyTacticalSuppression(selectedSim.incident.incident_id, 'VLAT');
        lookoutSound.playVlatRadio();
        setVimStatusMsg(`:vlat deployed on ${selectedSim.incident.incident_id}`);
      }
    } else if (raw === 'dozer') {
      if (selectedSim) {
        applyTacticalSuppression(selectedSim.incident.incident_id, 'DOZER');
        lookoutSound.playSquelch();
        setVimStatusMsg(`:dozer containment line cut on ${selectedSim.incident.incident_id}`);
      }
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
      if (DEFAULT_LAYERS.graticuleGrid) {
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

      // 3C. Historic Osborne Lookout Towers
      for (const twr of HISTORIC_LOOKOUT_TOWERS) {
        const tPos = projectLatLonToXY(twr.latitude, twr.longitude, W, H);
        if (tPos.x < -80 || tPos.x > W + 80 || tPos.y < -80 || tPos.y > H + 80) continue;

        const isPrim = twr.id === primaryTowerId;
        const isSec = twr.id === secondaryTowerId;

        ctx.save();
        ctx.fillStyle = isPrim ? theme.magenta : isSec ? theme.cyan : theme.green;
        ctx.strokeStyle = theme.crust;
        ctx.lineWidth = 1.5;

        const s = isPrim || isSec ? 6.5 : 4.5;
        ctx.beginPath();
        ctx.moveTo(tPos.x, tPos.y - s);
        ctx.lineTo(tPos.x + s, tPos.y);
        ctx.lineTo(tPos.x, tPos.y + s);
        ctx.lineTo(tPos.x - s, tPos.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (camera.zoom >= 1.6 || isPrim || isSec) {
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isPrim ? theme.magenta : isSec ? theme.cyan : theme.fg;
          ctx.fillText(`◈ ${twr.name.split(' ')[0]} [${twr.elevationFt}ft]`, tPos.x + 8, tPos.y + 3);
        }
        ctx.restore();
      }

      // 3D. Active Osborne Sightlines & Cross-Bearing Triangulation
      if (activeBuffer === 'FIREFINDER_TUI' || camera.zoom >= 1.4) {
        const pPos = projectLatLonToXY(primaryTower.latitude, primaryTower.longitude, W, H);
        const tipA = destinationCoordinate(primaryTower.latitude, primaryTower.longitude, activePrimaryBearing, 280);
        const pTipA = projectLatLonToXY(tipA.lat, tipA.lon, W, H);

        ctx.save();
        ctx.strokeStyle = theme.magenta;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pPos.x, pPos.y);
        ctx.lineTo(pTipA.x, pTipA.y);
        ctx.stroke();

        const sPos = projectLatLonToXY(secondaryTower.latitude, secondaryTower.longitude, W, H);
        const tipB = destinationCoordinate(secondaryTower.latitude, secondaryTower.longitude, secondaryBearingToTarget, 280);
        const pTipB = projectLatLonToXY(tipB.lat, tipB.lon, W, H);

        ctx.strokeStyle = theme.cyan;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sPos.x, sPos.y);
        ctx.lineTo(pTipB.x, pTipB.y);
        ctx.stroke();

        if (triangulationSolution && triangulationSolution.distFromAkm > 1 && triangulationSolution.distFromAkm < 400) {
          const fixPos = projectLatLonToXY(triangulationSolution.lat, triangulationSolution.lon, W, H);
          ctx.setLineDash([]);
          ctx.strokeStyle = theme.yellow;
          ctx.lineWidth = 2.0;

          const rFix = 12 + Math.sin(pulsePhase * 2) * 3;
          ctx.beginPath();
          ctx.arc(fixPos.x, fixPos.y, rFix, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(fixPos.x - rFix - 4, fixPos.y);
          ctx.lineTo(fixPos.x + rFix + 4, fixPos.y);
          ctx.moveTo(fixPos.x, fixPos.y - rFix - 4);
          ctx.lineTo(fixPos.x, fixPos.y + rFix + 4);
          ctx.stroke();

          ctx.fillStyle = theme.yellow;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`▲ TRIANGULATED FIX ±${triangulationSolution.errorRadiusKm}km`, fixPos.x + 16, fixPos.y - 4);
        }
        ctx.restore();
      }

      // 4. Thermal Density Heatmap Layer
      if (DEFAULT_LAYERS.thermalHeatmap) {
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
      if (DEFAULT_LAYERS.clusterHulls) {
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
      if (DEFAULT_LAYERS.plumeCones) {
        for (const sim of simulatedIncidents) {
          const { latitude, longitude } = sim.incident;
          const origin = projectLatLonToXY(latitude, longitude, W, H);
          if (origin.x < -200 || origin.x > W + 200 || origin.y < -200 || origin.y > H + 200) {
            continue;
          }

          const isSelected = selectedSim?.incident.incident_id === sim.incident.incident_id;
          const bearing = getEffectiveWindBearingDeg(sim.incident);

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
        const { latitude, longitude, frp } = sim.incident;
        const { x, y } = projectLatLonToXY(latitude, longitude, W, H);
        if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;

        const isSelected = selectedSim?.incident.incident_id === sim.incident.incident_id;

        if (DEFAULT_LAYERS.windVectors && (camera.zoom >= 2.5 || isSelected)) {
          const effBearing = getEffectiveWindBearingDeg(sim.incident);
          const effSpeed = getEffectiveWindSpeedMps(sim.incident);
          const rad = ((effBearing - 90) * Math.PI) / 180;
          const vecLen = Math.min(48, 16 + effSpeed * 2.0);
          const vx = x + Math.cos(rad) * vecLen;
          const vy = y + Math.sin(rad) * vecLen;

          ctx.strokeStyle = isSelected ? theme.cyan : `${theme.yellow}aa`;
          ctx.lineWidth = isSelected ? 1.8 : 1.1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(vx, vy);
          ctx.stroke();
        }

        if (DEFAULT_LAYERS.pulseRings) {
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
    simulatedIncidents,
    thermalClusters,
    selectedSim,
    simHourOffset,
    projectLatLonToXY,
    primaryTowerId,
    secondaryTowerId,
    primaryTower,
    secondaryTower,
    activePrimaryBearing,
    secondaryBearingToTarget,
    triangulationSolution
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

      if (isIgniteMode) {
        const coords = unprojectXYToLatLon(clickX, clickY, rect.width, rect.height);
        const newInc = addCustomSpotFire(coords.lat, coords.lon);
        setSelectedIncidentId(newInc.incident_id);
        setIsIgniteMode(false);
        lookoutSound.playSquelch();
        setVimStatusMsg(`:ignite -> Deployed spot fire at ${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`);
        return;
      }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to parse FIRMS payload.';
      setIngestionError(message);
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
        className="h-9 shrink-0 border-b px-2.5 flex items-center justify-between gap-3 select-none"
        style={{
          backgroundColor: theme.mantle,
          borderColor: theme.border
        }}
      >
        {/* Left: Brand & Bufferline Tabs */}
        <div className="flex items-center h-full gap-1 overflow-x-auto">
          <div className="flex items-center gap-1.5 pr-2 mr-1 border-r shrink-0" style={{ borderColor: theme.border }}>
            <span className="font-bold tracking-wider text-xs" style={{ color: theme.yellow }}>
              PYROWATCH
            </span>
            <span className="text-[9px] px-1 py-0.5 rounded-[2px] font-bold" style={{ backgroundColor: theme.surface, color: theme.cyan }}>
              CORE
            </span>
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
            },
            {
              id: 'FIREFINDER_TUI' as ActiveBufferTab,
              num: 4,
              name: 'firefinder.rs',
              mod: '[OSBORNE]',
              icon: <Radio className="w-3.5 h-3.5" style={{ color: theme.magenta }} />
            },
            {
              id: 'HELP_DOCS' as ActiveBufferTab,
              num: 5,
              name: 'help_docs.txt',
              mod: '[HELP]',
              icon: <HelpCircle className="w-3.5 h-3.5" style={{ color: theme.yellow }} />
            }
          ].map((buf) => {
            const isAct = activeBuffer === buf.id;
            return (
              <button
                key={buf.id}
                onClick={() => {
                  setActiveBuffer(buf.id);
                  lookoutSound.playSquelch();
                  setVimStatusMsg(`:buffer ${buf.num} (${buf.name})`);
                }}
                className="h-full px-2.5 flex items-center gap-1.5 transition text-[11px] font-mono border-b-2"
                style={{
                  backgroundColor: isAct ? theme.bg : 'transparent',
                  borderColor: isAct ? theme.blue : 'transparent',
                  color: isAct ? theme.fg : theme.comment
                }}
              >
                <span style={{ color: isAct ? theme.blue : theme.comment }}>{buf.num}:</span>
                {buf.icon}
                <span className={isAct ? 'font-semibold' : ''}>{buf.name}</span>
                <span className="text-[10px]" style={{ color: isAct ? theme.yellow : theme.comment }}>
                  {buf.mod}
                </span>
              </button>
            );
          })}
        </div>

        {/* Center: Compact Colorscheme Dropdown Cycle */}
        <div className="hidden lg:flex items-center">
          <button
            onClick={() => {
              const keys = Object.keys(NVIM_THEMES) as NvimThemeId[];
              const nextIdx = (keys.indexOf(themeId) + 1) % keys.length;
              setThemeId(keys[nextIdx]);
              setVimStatusMsg(`:colorscheme ${keys[nextIdx]}`);
            }}
            className="px-2.5 py-1 rounded-[2px] border text-[11px] transition flex items-center gap-2 hover:opacity-90 font-mono"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.fg
            }}
            title="Click to cycle colorscheme (:colorscheme <name>)"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: NVIM_THEMES[themeId].orange }}
            />
            <span className="font-medium">{NVIM_THEMES[themeId].label}</span>
            <span className="text-[10px]" style={{ color: theme.comment }}>
              ({NVIM_THEMES[themeId].shortName}) ▾
            </span>
          </button>
        </div>

        {/* Right: Operational Tools */}
        <div className="flex items-center gap-1.5 shrink-0 font-mono">
          <button
            onClick={() => {
              const newState = lookoutSound.toggle();
              setAudioEnabled(newState);
              setVimStatusMsg(newState ? ':audio on [VHF Radio & Thermal Rumble Active]' : ':audio off [Muted]');
            }}
            className="px-2 py-1 rounded-[2px] border text-[11px] flex items-center gap-1.5 transition hover:opacity-90"
            style={{
              backgroundColor: audioEnabled ? `${theme.green}20` : theme.surface,
              borderColor: audioEnabled ? theme.green : theme.border,
              color: audioEnabled ? theme.green : theme.comment
            }}
            title="Toggle Lookout Radio & Combustion Audio Ambiance (:audio on/off)"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden xl:inline">{audioEnabled ? 'radio_on' : 'radio_off'}</span>
          </button>

          <button
            onClick={() => {
              setIsIgniteMode((p) => !p);
              setVimStatusMsg(
                !isIgniteMode
                  ? ':ignite active -> Click anywhere on GIS canvas to deploy spot fire'
                  : ':ignite cancelled'
              );
            }}
            className="px-2 py-1 rounded-[2px] border text-[11px] flex items-center gap-1.5 transition hover:opacity-90"
            style={{
              backgroundColor: isIgniteMode ? `${theme.red}25` : theme.surface,
              borderColor: isIgniteMode ? theme.red : theme.border,
              color: isIgniteMode ? theme.red : theme.subtext
            }}
            title="Ignite new custom wildfire anomaly on canvas (:ignite)"
          >
            <Flame className="w-3.5 h-3.5" style={{ color: isIgniteMode ? theme.red : theme.orange }} />
            <span className="hidden sm:inline">{isIgniteMode ? 'click_map!' : ':ignite'}</span>
          </button>

          <button
            onClick={() => {
              setIsTelescopeOpen(true);
              setTelescopeHighlightIdx(0);
            }}
            className="px-2.5 py-1 rounded-[2px] border text-[11px] flex items-center gap-1.5 transition hover:opacity-90"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.fg
            }}
            title="Open Telescope Fuzzy Finder (/ or Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" style={{ color: theme.magenta }} />
            <span>:Telescope</span>
            <kbd
              className="px-1 text-[9px] rounded-[2px]"
              style={{ backgroundColor: theme.crust, color: theme.cyan }}
            >
              /
            </kbd>
          </button>

          <button
            onClick={() => setIsIngestModalOpen(true)}
            className="px-2 py-1 rounded-[2px] border text-[11px] flex items-center gap-1 transition hover:opacity-90"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.orange
            }}
            title="Ingest FIRMS NRT CSV / GeoJSON (:Ingest)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">:Ingest</span>
          </button>

          <button
            onClick={() => handleExportData('GEOJSON')}
            className="px-2 py-1 rounded-[2px] border text-[11px] hidden md:flex items-center gap-1 transition hover:opacity-90"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.cyan
            }}
            title="Export simulated anomalies (:w geojson)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>:w geojson</span>
          </button>
        </div>
      </header>

{/* ====================================================================
          2. SUB-HEADER TELEMETRY REGISTER STRIP (GLOBAL KPIS & THEATER SELECTOR)
         ==================================================================== */}
      <div
        className="h-8 shrink-0 border-b px-3 flex items-center justify-between gap-4 text-[11px] overflow-x-auto font-mono select-none"
        style={{
          backgroundColor: theme.mantle,
          borderColor: theme.border
        }}
      >
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span style={{ color: theme.comment }} className="uppercase text-[10px] tracking-wider font-semibold">Anomalies:</span>
            <span style={{ color: theme.yellow }} className="font-bold tabular-nums">
              {globalKpis.activeCount}
              <span style={{ color: theme.comment }} className="font-normal">/{incidents.length}</span>
            </span>
          </div>

          <span style={{ color: theme.border }}>│</span>

          <div className="flex items-center gap-1.5">
            <span style={{ color: theme.comment }} className="uppercase text-[10px] tracking-wider font-semibold">Radiative FRP:</span>
            <span style={{ color: theme.orange }} className="font-bold tabular-nums">
              {globalKpis.totalFrpGw.toFixed(2)} <span className="font-normal text-[10px]" style={{ color: theme.subtext }}>GW</span>
            </span>
          </div>

          <span style={{ color: theme.border }}>│</span>

          <div className="flex items-center gap-1.5">
            <span style={{ color: theme.comment }} className="uppercase text-[10px] tracking-wider font-semibold">Burn Area:</span>
            <span style={{ color: theme.red }} className="font-bold tabular-nums">
              {Math.round(globalKpis.totalBurnedHa).toLocaleString()} <span className="font-normal text-[10px]" style={{ color: theme.subtext }}>ha</span>
            </span>
            <span className="text-[10px]" style={{ color: theme.comment }}>
              (+{simHourOffset.toFixed(1)}h)
            </span>
          </div>

          <span style={{ color: theme.border }} className="hidden lg:inline">│</span>

          <div className="hidden lg:flex items-center gap-1.5">
            <span style={{ color: theme.comment }} className="uppercase text-[10px] tracking-wider font-semibold">Hull Clusters:</span>
            <span style={{ color: theme.green }} className="font-bold tabular-nums">
              {thermalClusters.length}
            </span>
          </div>

          <span style={{ color: theme.border }} className="hidden xl:inline">│</span>

          <div className="hidden xl:flex items-center gap-1.5">
            <span style={{ color: theme.comment }} className="uppercase text-[10px] tracking-wider font-semibold">Peak Pop Exposure:</span>
            <span style={{ color: theme.red }} className="font-bold tabular-nums">
              {globalKpis.highestRiskIncident
                ? `${(globalKpis.highestRiskIncident.incident.population_at_risk / 1000).toFixed(1)}k`
                : '0'}
            </span>
          </div>
        </div>

        {/* Theater Quick-Jump Segmented Control */}
        <div className="flex items-center gap-2 shrink-0">
          <span style={{ color: theme.comment }} className="text-[10px] uppercase tracking-wider">Theater:</span>
          <div className="flex items-center rounded-[2px] border p-0.5" style={{ backgroundColor: theme.crust, borderColor: theme.border }}>
            {THEATER_BUTTONS.map(({ id, label }) => {
              const active = activeTheater === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectTheater(id)}
                  className="px-2 py-0.5 rounded-[2px] text-[10px] transition font-medium"
                  style={{
                    backgroundColor: active ? theme.blue : 'transparent',
                    color: active ? theme.crust : theme.subtext,
                    fontWeight: active ? 'bold' : 'normal'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
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
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10 font-mono">
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <div
                    className="px-2.5 py-1 rounded-[2px] border text-[10px] flex items-center gap-2 backdrop-blur-md"
                    style={{
                      backgroundColor: `${theme.crust}dd`,
                      borderColor: theme.border
                    }}
                  >
                    <button
                      onClick={() => handleSelectTheater('GLOBAL')}
                      className="flex items-center gap-1 hover:opacity-80 transition"
                      style={{ color: theme.cyan }}
                      title="Reset View to Global Command Map"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>:GlobalView</span>
                    </button>
                    <span style={{ color: theme.border }}>│</span>
                    <span style={{ color: theme.comment }}>CRS:</span>
                    <span style={{ color: theme.yellow }}>WGS84 / EPSG:4326</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pointer-events-auto">
                  <div
                    className="flex items-center rounded-[2px] border p-0.5 backdrop-blur-md"
                    style={{ backgroundColor: `${theme.crust}dd`, borderColor: theme.border }}
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
                    <span className="px-2 text-[10px] font-bold tabular-nums" style={{ color: theme.yellow }}>
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
                    className="px-2.5 py-1 rounded-[2px] border text-[10px] flex items-center gap-1.5 backdrop-blur-md transition hover:opacity-90"
                    style={{
                      backgroundColor: `${theme.crust}dd`,
                      borderColor: theme.border,
                      color: rightDrawerOpen ? theme.yellow : theme.comment
                    }}
                  >
                    <span>{rightDrawerOpen ? 'close_inspector ▶' : '◀ open_inspector'}</span>
                  </button>
                </div>
              </div>

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
                  : activeBuffer === 'ROTHERMEL_CORE_RS'
                  ? `[split] buffer://src/physics/rothermel_gaussian_core.rs [RO]`
                  : activeBuffer === 'FIREFINDER_TUI'
                  ? `[split] buffer://osborne_firefinder_lookout.rs [${primaryTower.name} ◈ ${secondaryTower.name}]`
                  : `[split] buffer://doc/pyrowatch_reference.txt [HELP]`
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

                {activeBuffer === 'FIREFINDER_TUI' && (
                  <div className="p-3 text-xs space-y-3 font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div
                        className="md:col-span-5 p-3 rounded-sm border flex flex-col items-center justify-center space-y-2"
                        style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                      >
                        <div className="flex items-center justify-between w-full text-[11px]">
                          <span style={{ color: theme.magenta }} className="font-bold">
                            OSBORNE AZIMUTH RING (0° - 360°)
                          </span>
                          <span style={{ color: theme.yellow }} className="font-bold">
                            {formatBearingDms(activePrimaryBearing)}
                          </span>
                        </div>

                        <div className="relative w-48 h-48 my-1 select-none flex items-center justify-center">
                          <svg viewBox="0 0 200 200" className="w-full h-full">
                            <defs>
                              <radialGradient id="brassGrad" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={theme.mantle} />
                                <stop offset="85%" stopColor={theme.bg} />
                                <stop offset="100%" stopColor={theme.crust} />
                              </radialGradient>
                            </defs>
                            {/* Outer Flange Ring */}
                            <circle cx="100" cy="100" r="97" fill="url(#brassGrad)" stroke={theme.border} strokeWidth="2" />
                            <circle cx="100" cy="100" r="91" fill="none" stroke={`${theme.yellow}30`} strokeWidth="1" />
                            <circle cx="100" cy="100" r="76" fill="none" stroke={theme.border} strokeWidth="0.8" />

                            {/* Concentric Range Rings */}
                            <circle cx="100" cy="100" r="54" fill="none" stroke={theme.border} strokeWidth="0.6" strokeDasharray="2 3" />
                            <circle cx="100" cy="100" r="32" fill="none" stroke={theme.border} strokeWidth="0.6" strokeDasharray="2 3" />

                            {/* Hairline Crosshairs */}
                            <line x1="100" y1="24" x2="100" y2="176" stroke={theme.border} strokeWidth="0.7" />
                            <line x1="24" y1="100" x2="176" y2="100" stroke={theme.border} strokeWidth="0.7" />

                            {/* Azimuth Graduation Ticks (Every 5 deg = 72 ticks) */}
                            {Array.from({ length: 72 }).map((_, i) => {
                              const angle = (i * 5 * Math.PI) / 180;
                              const is30 = i % 6 === 0;
                              const is10 = i % 2 === 0;
                              const r1 = is30 ? 76 : is10 ? 81 : 85;
                              const r2 = 91;
                              const x1 = 100 + r1 * Math.sin(angle);
                              const y1 = 100 - r1 * Math.cos(angle);
                              const x2 = 100 + r2 * Math.sin(angle);
                              const y2 = 100 - r2 * Math.cos(angle);
                              return (
                                <line
                                  key={i}
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  stroke={is30 ? theme.yellow : is10 ? theme.subtext : theme.comment}
                                  strokeWidth={is30 ? 1.5 : is10 ? 1 : 0.6}
                                />
                              );
                            })}

                            {/* 30-deg Numerical Labels */}
                            {[
                              { deg: 0, text: 'N', col: theme.red, bold: true },
                              { deg: 30, text: '30', col: theme.comment, bold: false },
                              { deg: 60, text: '60', col: theme.comment, bold: false },
                              { deg: 90, text: 'E', col: theme.fg, bold: true },
                              { deg: 120, text: '120', col: theme.comment, bold: false },
                              { deg: 150, text: '150', col: theme.comment, bold: false },
                              { deg: 180, text: 'S', col: theme.fg, bold: true },
                              { deg: 210, text: '210', col: theme.comment, bold: false },
                              { deg: 240, text: '240', col: theme.comment, bold: false },
                              { deg: 270, text: 'W', col: theme.fg, bold: true },
                              { deg: 300, text: '300', col: theme.comment, bold: false },
                              { deg: 330, text: '330', col: theme.comment, bold: false }
                            ].map(({ deg, text: lbl, col, bold }) => {
                              const angle = (deg * Math.PI) / 180;
                              const r = 68;
                              const x = 100 + r * Math.sin(angle);
                              const y = 100 - r * Math.cos(angle) + 3;
                              return (
                                <text
                                  key={deg}
                                  x={x}
                                  y={y}
                                  fill={col}
                                  fontSize={bold ? '9' : '7'}
                                  fontWeight={bold ? 'bold' : 'normal'}
                                  fontFamily="monospace"
                                  textAnchor="middle"
                                >
                                  {lbl}
                                </text>
                              );
                            })}

                            {/* Rotating Alidade Sight Arm */}
                            <g transform={`rotate(${activePrimaryBearing}, 100, 100)`}>
                              {/* Rear Sighting Vane (Peep aperture) */}
                              <rect x="96" y="168" width="8" height="12" fill={theme.surface} stroke={theme.border} strokeWidth="1" rx="1" />
                              <circle cx="100" cy="174" r="1.5" fill={theme.bg} />

                              {/* Alidade Rule Arm */}
                              <line x1="100" y1="20" x2="100" y2="180" stroke={theme.magenta} strokeWidth="1.8" />

                              {/* Front Sight Vane (Objective bracket with wire) */}
                              <polygon points="100,10 94,24 106,24" fill={theme.magenta} />
                              <line x1="100" y1="12" x2="100" y2="24" stroke={theme.yellow} strokeWidth="1" />

                              {/* Center Pivot Collar */}
                              <circle cx="100" cy="100" r="7" fill={theme.crust} stroke={theme.yellow} strokeWidth="1.5" />
                              <circle cx="100" cy="100" r="2.5" fill={theme.magenta} />
                            </g>
                          </svg>
                        </div>

                        <div className="w-full space-y-1 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span style={{ color: theme.subtext }}>Manual Alidade Azimuth:</span>
                            <span style={{ color: theme.cyan }} className="font-bold">
                              {manualAzimuthDeg.toFixed(1)}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="359.9"
                            step="0.5"
                            value={manualAzimuthDeg}
                            onChange={(e) => {
                              setManualAzimuthDeg(parseFloat(e.target.value));
                              setIsManualAim(true);
                              lookoutSound.playKeyClick();
                            }}
                            className="w-full accent-fuchsia-500 cursor-pointer"
                          />
                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => {
                                setIsManualAim(false);
                                setVimStatusMsg(':firefinder sight locked onto selected incident');
                                lookoutSound.playSquelch();
                              }}
                              className="px-2 py-0.5 rounded-sm border"
                              style={{
                                backgroundColor: !isManualAim ? `${theme.magenta}25` : theme.surface,
                                borderColor: !isManualAim ? theme.magenta : theme.border,
                                color: theme.fg
                              }}
                            >
                              Lock to Incident
                            </button>
                            <button
                              onClick={() => {
                                setIsManualAim(true);
                                lookoutSound.playKeyClick();
                              }}
                              className="px-2 py-0.5 rounded-sm border"
                              style={{
                                backgroundColor: isManualAim ? `${theme.cyan}25` : theme.surface,
                                borderColor: isManualAim ? theme.cyan : theme.border,
                                color: theme.fg
                              }}
                            >
                              Manual Sweep
                            </button>
                          </div>
                        </div>
                      </div>

                      <div
                        className="md:col-span-4 p-3 rounded-sm border space-y-2.5"
                        style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                      >
                        <div style={{ color: theme.cyan }} className="font-bold text-[11px]">
                          SIGHTING TELEMETRY (TOWER A ➜ TARGET)
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px]" style={{ color: theme.comment }}>
                            Primary Lookout Tower (A):
                          </label>
                          <select
                            value={primaryTowerId}
                            onChange={(e) => {
                              setPrimaryTowerId(e.target.value);
                              lookoutSound.playSquelch();
                            }}
                            className="w-full text-xs p-1 rounded-sm border bg-transparent font-mono focus:outline-none"
                            style={{ borderColor: theme.border, color: theme.fg, backgroundColor: theme.bg }}
                          >
                            {HISTORIC_LOOKOUT_TOWERS.map((t) => (
                              <option key={t.id} value={t.id} style={{ backgroundColor: theme.crust }}>
                                {t.name} ({t.elevationFt} ft)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="p-2 rounded-sm border space-y-1 text-[11px]" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                          <div className="flex justify-between">
                            <span style={{ color: theme.comment }}>Azimuth Bearing:</span>
                            <span style={{ color: theme.yellow }} className="font-bold">
                              {formatBearingDms(activePrimaryBearing)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: theme.comment }}>Mariner Quadrant:</span>
                            <span style={{ color: theme.green }} className="font-bold">
                              {formatBearingQuadrant(activePrimaryBearing)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: theme.comment }}>Military Mils:</span>
                            <span style={{ color: theme.cyan }} className="font-bold">
                              {formatBearingMils(activePrimaryBearing)} mils
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: theme.comment }}>Back-Azimuth:</span>
                            <span style={{ color: theme.subtext }}>
                              {formatBearingDms((activePrimaryBearing + 180) % 360)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1">
                          <label className="text-[10px]" style={{ color: theme.comment }}>
                            Secondary Triangulation Lookout (B):
                          </label>
                          <select
                            value={secondaryTowerId}
                            onChange={(e) => {
                              setSecondaryTowerId(e.target.value);
                              lookoutSound.playSquelch();
                            }}
                            className="w-full text-xs p-1 rounded-sm border bg-transparent font-mono focus:outline-none"
                            style={{ borderColor: theme.border, color: theme.fg, backgroundColor: theme.bg }}
                          >
                            {HISTORIC_LOOKOUT_TOWERS.map((t) => (
                              <option key={t.id} value={t.id} style={{ backgroundColor: theme.crust }}>
                                {t.name} ({t.elevationFt} ft)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex justify-between text-[11px] p-1.5 rounded-sm border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                          <span style={{ color: theme.comment }}>Tower B Bearing:</span>
                          <span style={{ color: theme.cyan }} className="font-bold">
                            {formatBearingDms(secondaryBearingToTarget)}
                          </span>
                        </div>
                      </div>

                      <div
                        className="md:col-span-3 p-3 rounded-sm border flex flex-col justify-between space-y-2"
                        style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                      >
                        <div className="space-y-2">
                          <div style={{ color: theme.yellow }} className="font-bold text-[11px]">
                            ▲ CROSS-BEARING TRIANGULATION
                          </div>

                          {triangulationSolution ? (
                            <div className="space-y-1.5 text-[11px]">
                              <div className="p-2 rounded-sm border space-y-1" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                                <div style={{ color: theme.comment }} className="text-[10px]">
                                  Triangulated Ground Fix:
                                </div>
                                <div style={{ color: theme.orange }} className="font-bold">
                                  {formatCoordinatesHemisphere(
                                    triangulationSolution.lat,
                                    triangulationSolution.lon,
                                    3
                                  )}
                                </div>
                                <div style={{ color: theme.green }} className="text-[10px]">
                                  Confidence Radius: ±{triangulationSolution.errorRadiusKm} km
                                </div>
                              </div>

                              <div className="flex justify-between text-[10px]">
                                <span style={{ color: theme.comment }}>Dist from Tower A:</span>
                                <span style={{ color: theme.magenta }} className="font-bold">
                                  {triangulationSolution.distFromAkm.toFixed(1)} km
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span style={{ color: theme.comment }}>Dist from Tower B:</span>
                                <span style={{ color: theme.cyan }} className="font-bold">
                                  {triangulationSolution.distFromBkm.toFixed(1)} km
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 text-[10px] text-center italic" style={{ color: theme.comment }}>
                              Sightlines are parallel or diverging. Adjust tower selection or bearings to achieve cross-bearing intersection.
                            </div>
                          )}
                        </div>

                        {triangulationSolution && (
                          <button
                            onClick={() => {
                              setCamera({
                                centerLat: triangulationSolution.lat,
                                centerLon: triangulationSolution.lon,
                                zoom: 4.8
                              });
                              lookoutSound.playSquelch();
                              setVimStatusMsg(`:project -> Centered on triangulated smoke column`);
                            }}
                            className="w-full py-1.5 rounded-sm font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                            style={{ backgroundColor: theme.yellow, color: theme.crust }}
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                            <span>:FlyToTriangulation</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeBuffer === 'HELP_DOCS' && (
                  <div className="p-4 text-xs font-mono space-y-4" style={{ color: theme.fg }}>
                    <div className="p-3 rounded-sm border" style={{ backgroundColor: theme.mantle, borderColor: theme.border }}>
                      <h2 className="text-sm font-bold mb-1" style={{ color: theme.yellow }}>
                        PYROWATCH-CORE // OPERATOR CHEAT SHEET &amp; REFERENCE MANUAL
                      </h2>
                      <p style={{ color: theme.subtext }}>
                        Digital Fire Lookout &amp; Orbital Wildfire Telemetry Terminal styled as an authentic Neovim workspace.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 rounded-sm border space-y-2" style={{ backgroundColor: theme.mantle, borderColor: theme.border }}>
                        <div style={{ color: theme.cyan }} className="font-bold text-xs">
                          KEYBOARD WORKFLOW &amp; SHORTCUTS
                        </div>
                        <table className="w-full text-left text-[11px]">
                          <tbody>
                            <tr className="border-b" style={{ borderColor: `${theme.border}40` }}>
                              <td className="py-1" style={{ color: theme.yellow }}>j / k</td>
                              <td style={{ color: theme.subtext }}>Cycle next / previous thermal anomaly</td>
                            </tr>
                            <tr className="border-b" style={{ borderColor: `${theme.border}40` }}>
                              <td className="py-1" style={{ color: theme.yellow }}>/ or Ctrl+K</td>
                              <td style={{ color: theme.subtext }}>Open Telescope fuzzy finder modal</td>
                            </tr>
                            <tr className="border-b" style={{ borderColor: `${theme.border}40` }}>
                              <td className="py-1" style={{ color: theme.yellow }}>Space</td>
                              <td style={{ color: theme.subtext }}>Toggle forward simulation clock (1x / 5x)</td>
                            </tr>
                            <tr className="border-b" style={{ borderColor: `${theme.border}40` }}>
                              <td className="py-1" style={{ color: theme.yellow }}>:b1 - :b5</td>
                              <td style={{ color: theme.subtext }}>Switch buffer (1:GIS, 2:CSV, 3:Rust, 4:Firefinder, 5:Help)</td>
                            </tr>
                            <tr className="border-b" style={{ borderColor: `${theme.border}40` }}>
                              <td className="py-1" style={{ color: theme.yellow }}>:audio on/off</td>
                              <td style={{ color: theme.subtext }}>Toggle VHF radio &amp; thermal sound engine</td>
                            </tr>
                            <tr className="border-b" style={{ borderColor: `${theme.border}40` }}>
                              <td className="py-1" style={{ color: theme.yellow }}>:ignite</td>
                              <td style={{ color: theme.subtext }}>Click anywhere on map to deploy custom spot fire</td>
                            </tr>
                            <tr>
                              <td className="py-1" style={{ color: theme.yellow }}>:vlat / :dozer</td>
                              <td style={{ color: theme.subtext }}>Dispatch DC-10 retardant drop or bulldozer break</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="p-3 rounded-sm border space-y-2" style={{ backgroundColor: theme.mantle, borderColor: theme.border }}>
                        <div style={{ color: theme.orange }} className="font-bold text-xs">
                          PHYSICAL &amp; DISPERSION FORMULATIONS
                        </div>
                        <div className="space-y-1.5 text-[11px]" style={{ color: theme.subtext }}>
                          <div>
                            <strong style={{ color: theme.magenta }}>Rothermel (1972) Surface Spread:</strong>
                            <div className="p-1 rounded font-mono text-[10px]" style={{ backgroundColor: theme.bg }}>
                              R = [I_R * xi * (1 + phi_w + phi_s)] / (rho_b * epsilon * Q_ig)
                            </div>
                          </div>
                          <div>
                            <strong style={{ color: theme.magenta }}>Byram (1959) Fireline Intensity:</strong>
                            <div className="p-1 rounded font-mono text-[10px]" style={{ backgroundColor: theme.bg }}>
                              I_B = H * w * R  ==&gt;  L_f = 0.0775 * (I_B)^0.46 (m)
                            </div>
                          </div>
                          <div>
                            <strong style={{ color: theme.magenta }}>Albini (1979) Firebrand Spotting:</strong>
                            <div className="p-1 rounded font-mono text-[10px]" style={{ backgroundColor: theme.bg }}>
                              D_spot = 0.00078 * U_canopy * sqrt(H_flame) * (1 + Slope/100)
                            </div>
                          </div>
                          <div>
                            <strong style={{ color: theme.magenta }}>Wooster (2005) Biomass Combustion:</strong>
                            <div className="p-1 rounded font-mono text-[10px]" style={{ backgroundColor: theme.bg }}>
                              Biomass (kg/s) = FRP (MW) * 0.368 kg/MJ
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
                {/* Precision Telemetry Master Card */}
                <div
                  className="p-3 rounded-[2px] border space-y-2.5 font-mono"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold"
                        style={{ backgroundColor: theme.surface, color: theme.cyan }}
                      >
                        {selectedSim.incident.incident_id}
                      </span>
                      <span className="font-bold text-xs truncate" style={{ color: theme.fg }}>
                        {selectedSim.incident.name}
                      </span>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider shrink-0"
                      style={{
                        backgroundColor: `${selectedSim.fre.severityColor}20`,
                        color: selectedSim.fre.severityColor,
                        border: `1px solid ${selectedSim.fre.severityColor}40`
                      }}
                    >
                      {selectedSim.fre.severityClass}
                    </span>
                  </div>

                  {/* 2-Column Key-Value Specs */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-1 border-t" style={{ borderColor: theme.border }}>
                    <div className="flex justify-between">
                      <span style={{ color: theme.comment }}>Coords:</span>
                      <span style={{ color: theme.orange }} className="font-medium tabular-nums">
                        {selectedSim.incident.latitude.toFixed(3)}°, {selectedSim.incident.longitude.toFixed(3)}°
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.comment }}>FRP:</span>
                      <span style={{ color: theme.red }} className="font-bold tabular-nums">
                        {selectedSim.incident.frp.toFixed(1)} MW
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.comment }}>Sensor:</span>
                      <span style={{ color: theme.green }} className="font-medium">
                        {selectedSim.incident.satellite_sensor} ({selectedSim.incident.confidence_pct}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.comment }}>Temp:</span>
                      <span style={{ color: theme.yellow }} className="font-medium tabular-nums">
                        {selectedSim.incident.brightness_temp_k.toFixed(1)} K
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.comment }}>Fuel:</span>
                      <span style={{ color: theme.magenta }} className="font-medium truncate max-w-[120px]">
                        {selectedSim.incident.fuel_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: theme.comment }}>Region:</span>
                      <span style={{ color: theme.cyan }} className="font-medium truncate max-w-[120px]">
                        {selectedSim.incident.region}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rothermel Physical Spread Metrics */}
                <div
                  className="p-3 rounded-[2px] border space-y-2.5 font-mono"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: theme.fg }} className="font-bold uppercase tracking-wider text-[10px]">
                      ROTHERMEL SURFACE SPREAD METRICS
                    </span>
                    <span style={{ color: theme.comment }} className="text-[10px]">
                      Model: {FUEL_MODEL_SPECS[selectedSim.incident.fuel_type].code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className="p-2 rounded-[2px] border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px] uppercase font-medium">
                        Rate of Spread (R)
                      </div>
                      <div style={{ color: theme.orange }} className="text-sm font-bold tabular-nums">
                        {selectedSim.rothermel.rateOfSpreadMpm.toFixed(1)}{' '}
                        <span className="text-[10px] font-normal" style={{ color: theme.subtext }}>m/min</span>
                      </div>
                      <div style={{ color: theme.comment }} className="text-[10px] tabular-nums">
                        {selectedSim.rothermel.rateOfSpreadKmh.toFixed(2)} km/h
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-[2px] border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px] uppercase font-medium">
                        Fireline Intensity (I_B)
                      </div>
                      <div style={{ color: theme.red }} className="text-sm font-bold tabular-nums">
                        {Math.round(selectedSim.rothermel.firelineIntensityKwm).toLocaleString()}{' '}
                        <span className="text-[10px] font-normal" style={{ color: theme.subtext }}>kW/m</span>
                      </div>
                      <div style={{ color: theme.comment }} className="text-[10px] tabular-nums">
                        Flame Length: {selectedSim.rothermel.flameLengthM.toFixed(1)} m
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-[2px] border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px] uppercase font-medium">
                        Radiative Energy (FRE)
                      </div>
                      <div style={{ color: theme.yellow }} className="text-sm font-bold tabular-nums">
                        {selectedSim.fre.freTerajoules.toFixed(2)}{' '}
                        <span className="text-[10px] font-normal" style={{ color: theme.subtext }}>TJ</span>
                      </div>
                      <div style={{ color: theme.comment }} className="text-[10px] tabular-nums">
                        PM2.5 Q: {(selectedSim.fre.pm25EmissionRateGs / 1000).toFixed(2)} kg/s
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-[2px] border"
                      style={{ backgroundColor: theme.mantle, borderColor: theme.border }}
                    >
                      <div style={{ color: theme.comment }} className="text-[10px] uppercase font-medium">
                        Sim Burn Area (+{simHourOffset.toFixed(0)}h)
                      </div>
                      <div style={{ color: theme.green }} className="text-sm font-bold tabular-nums">
                        {Math.round(selectedSim.rothermel.simulatedBurnAreaHa).toLocaleString()}{' '}
                        <span className="text-[10px] font-normal" style={{ color: theme.subtext }}>ha</span>
                      </div>
                      <div style={{ color: theme.comment }} className="text-[10px] tabular-nums">
                        {selectedSim.rothermel.ellipseMajorAxisKm.toFixed(1)} × {selectedSim.rothermel.ellipseMinorAxisKm.toFixed(1)} km
                      </div>
                    </div>
                  </div>

                  {/* Albini Spotting Banner */}
                  <div
                    className="p-2 rounded-[2px] border text-[11px] flex items-center justify-between"
                    style={{
                      backgroundColor: `${theme.orange}10`,
                      borderColor: `${theme.orange}40`,
                      color: theme.orange
                    }}
                  >
                    <span className="font-medium">Albini Spotting Radius:</span>
                    <span className="font-bold tabular-nums">
                      {selectedSim.rothermel.spotting.maxSpottingDistanceKm} km ({selectedSim.rothermel.spotting.spottingRiskLevel})
                    </span>
                  </div>

                  {selectedSim.rothermel.isExtinguished && (
                    <div
                      className="p-2 rounded-[2px] border text-[11px] font-bold text-center"
                      style={{ backgroundColor: `${theme.cyan}15`, borderColor: theme.cyan, color: theme.cyan }}
                    >
                      DORMANT: Dead Fuel Moisture Exceeds Extinction Threshold
                    </div>
                  )}

                  {selectedSim.rothermel.suppressedByRetardant && (
                    <div
                      className="p-2 rounded-[2px] border text-[11px] font-bold text-center"
                      style={{ backgroundColor: `${theme.red}15`, borderColor: theme.red, color: theme.red }}
                    >
                      PHOS-CHEK APPLIED: Spread Suppressed by 65%
                    </div>
                  )}
                </div>

                {/* Tactical Incident Suppression Command Card */}
                <div
                  className="p-3 rounded-[2px] border space-y-2.5 font-mono"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: theme.red }} className="font-bold flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Tactical Suppression Dispatch</span>
                    </span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: theme.green }}>
                      Containment: {selectedSim.rothermel.effectiveContainmentPct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <button
                      onClick={() => {
                        applyTacticalSuppression(selectedSim.incident.incident_id, 'VLAT');
                        lookoutSound.playVlatRadio();
                        setVimStatusMsg(`:vlat -> Deployed DC-10 Phos-Chek retardant drop on ${selectedSim.incident.incident_id}`);
                      }}
                      className="p-2 rounded-[2px] border font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition"
                      style={{ backgroundColor: `${theme.red}20`, borderColor: theme.red, color: theme.red }}
                    >
                      <Plane className="w-3.5 h-3.5" />
                      <span>Deploy VLAT Drop</span>
                    </button>

                    <button
                      onClick={() => {
                        applyTacticalSuppression(selectedSim.incident.incident_id, 'DOZER');
                        lookoutSound.playSquelch();
                        setVimStatusMsg(`:dozer -> Bulldozer crew cutting mineral soil line on ${selectedSim.incident.incident_id}`);
                      }}
                      className="p-2 rounded-[2px] border font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition"
                      style={{ backgroundColor: `${theme.yellow}20`, borderColor: theme.yellow, color: theme.yellow }}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Cut Dozer Line</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Rothermel Sensitivity Sandbox Sliders */}
                <div
                  className="p-3 rounded-[2px] border space-y-2.5 font-mono"
                  style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: theme.yellow }} className="font-bold flex items-center gap-1.5 text-xs">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Rothermel What-If Sandbox</span>
                    </span>
                    <button
                      onClick={() => {
                        resetIncidentOverrides(selectedSim.incident.incident_id);
                        lookoutSound.playKeyClick();
                        setVimStatusMsg(`:reset overrides on ${selectedSim.incident.incident_id}`);
                      }}
                      className="text-[10px] underline hover:opacity-80 transition"
                      style={{ color: theme.comment }}
                    >
                      reset_baseline
                    </button>
                  </div>

                  <div className="space-y-2 text-[10px]">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span style={{ color: theme.subtext }}>Wind Speed (10m):</span>
                        <span style={{ color: theme.cyan }} className="font-bold tabular-nums">
                          {(selectedSim.incident.overrides?.windSpeedMps ?? selectedSim.incident.wind_vector.speed_mps).toFixed(1)} m/s ({((selectedSim.incident.overrides?.windSpeedMps ?? selectedSim.incident.wind_vector.speed_mps) * 2.237).toFixed(0)} mph)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="35"
                        step="0.5"
                        value={selectedSim.incident.overrides?.windSpeedMps ?? selectedSim.incident.wind_vector.speed_mps}
                        onChange={(e) => {
                          updateIncidentOverrides(selectedSim.incident.incident_id, {
                            windSpeedMps: parseFloat(e.target.value)
                          });
                          lookoutSound.playKeyClick();
                        }}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span style={{ color: theme.subtext }}>Dead Fuel Moisture (%):</span>
                        <span style={{ color: theme.orange }} className="font-bold tabular-nums">
                          {(selectedSim.incident.overrides?.deadFuelMoisturePct ?? selectedSim.incident.ambient_humidity_pct).toFixed(0)}% (M_x={Math.round(FUEL_MODEL_SPECS[selectedSim.incident.fuel_type].moistureExtinction * 100)}%)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="35"
                        step="1"
                        value={selectedSim.incident.overrides?.deadFuelMoisturePct ?? selectedSim.incident.ambient_humidity_pct}
                        onChange={(e) => {
                          updateIncidentOverrides(selectedSim.incident.incident_id, {
                            deadFuelMoisturePct: parseFloat(e.target.value)
                          });
                          lookoutSound.playKeyClick();
                        }}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span style={{ color: theme.subtext }}>Terrain Slope Grade (%):</span>
                        <span style={{ color: theme.green }} className="font-bold tabular-nums">
                          {(selectedSim.incident.overrides?.slopePct ?? selectedSim.incident.slope_deg).toFixed(0)}% slope
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="2"
                        value={selectedSim.incident.overrides?.slopePct ?? selectedSim.incident.slope_deg}
                        onChange={(e) => {
                          updateIncidentOverrides(selectedSim.incident.incident_id, {
                            slopePct: parseFloat(e.target.value)
                          });
                          lookoutSound.playKeyClick();
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 2D Gaussian Plume Chart */}
                <GaussianPlumeChart
                  profile={selectedSim.plumeProfile}
                  emissionRateGs={selectedSim.fre.pm25EmissionRateGs}
                  windSpeedMps={getEffectiveWindSpeedMps(selectedSim.incident)}
                  theme={theme}
                />

                {/* Wind Rose & Topographic Slope */}
                <WindRoseCompass
                  bearingDeg={getEffectiveWindBearingDeg(selectedSim.incident)}
                  speedMps={getEffectiveWindSpeedMps(selectedSim.incident)}
                  slopeDeg={getEffectiveSlopeDeg(selectedSim.incident)}
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
                        {selectedSim.rothermel.effectiveContainmentPct}%
                      </span>
                    </div>
                    <div
                      className="w-full h-2 rounded-sm overflow-hidden border"
                      style={{ backgroundColor: theme.crust, borderColor: theme.border }}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${selectedSim.rothermel.effectiveContainmentPct}%`,
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
              title="Telescope: Find Thermal Anomalies (/)"
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
              title="Live Physics Preview (rothermel.rs)"
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
            title=":IngestFIRMS // NASA VIIRS & MODIS NRT Telemetry Parser"
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
