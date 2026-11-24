import type {
  LookoutTower,
  NvimThemeId,
  NvimThemePalette,
  TheaterPreset,
  TheaterRegion
} from './types';

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

export const HISTORIC_LOOKOUT_TOWERS: LookoutTower[] = [
  {
    id: 'TWR-TAMALPAIS',
    name: 'East Peak Fire Lookout',
    region: 'Mount Tamalpais, Marin CA',
    latitude: 37.9235,
    longitude: -122.5965,
    elevationFt: 2571,
    established: 1934,
    status: 'ACTIVE_STAFFED'
  },
  {
    id: 'TWR-BUCK-ROCK',
    name: 'Buck Rock Lookout',
    region: 'Sequoia National Forest, CA',
    latitude: 36.7328,
    longitude: -118.8617,
    elevationFt: 8502,
    established: 1923,
    status: 'ACTIVE_STAFFED'
  },
  {
    id: 'TWR-BLACK-MTN',
    name: 'Black Mountain Lookout',
    region: 'San Diego County, CA',
    latitude: 33.155,
    longitude: -116.821,
    elevationFt: 4048,
    established: 1926,
    status: 'ACTIVE_STAFFED'
  },
  {
    id: 'TWR-DEVILS-HEAD',
    name: 'Devils Head Lookout',
    region: 'Pike National Forest, Colorado',
    latitude: 39.2589,
    longitude: -105.1011,
    elevationFt: 9748,
    established: 1912,
    status: 'HISTORIC_PRESERVED'
  },
  {
    id: 'TWR-SIERRA-BUTTES',
    name: 'Sierra Buttes Lookout',
    region: 'Tahoe National Forest, CA',
    latitude: 39.5936,
    longitude: -120.6403,
    elevationFt: 8591,
    established: 1915,
    status: 'HISTORIC_PRESERVED'
  },
  {
    id: 'TWR-PIC-DU-MIDI',
    name: 'Pic du Midi de Bigorre',
    region: 'Hautes-Pyrénées, France',
    latitude: 42.9369,
    longitude: 0.1411,
    elevationFt: 9439,
    established: 1882,
    status: 'AUTOMATED_OPTICAL'
  }
];

export const THEATER_PRESETS: Record<TheaterRegion, TheaterPreset> = {
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

export const THEATER_BUTTONS: ReadonlyArray<{ id: TheaterRegion; label: string }> = [
  { id: 'GLOBAL', label: 'Global' },
  { id: 'CALIFORNIA', label: 'California' },
  { id: 'MEDITERRANEAN', label: 'Med Basin' },
  { id: 'BOREAL_CANADA', label: 'Boreal' },
  { id: 'AUSTRALIA', label: 'Australia' },
  { id: 'AMAZONIA', label: 'Amazon' },
  { id: 'SAVANNA_AFRICA', label: 'Africa' }
];

export const WORLD_LANDMASS_POLYGONS: Array<{ name: string; coords: Array<[number, number]> }> = [
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

export const THEATER_TOPO_RIDGES: Array<{
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
