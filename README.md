# PyroWatch-Core

A client-side geospatial wildfire telemetry tracker, atmospheric smoke dispersion simulator, and orbital hotspot analyzer built with a Neovim TUI aesthetic.

The entire application lives in one file, `src/PyroWatchCore.tsx`. The physics engine, Canvas renderer, UI, themes, and the 56 synthetic incidents are all in that component, so you can read it top to bottom or drop it into any React + Tailwind project.

PyroWatch-Core pairs a 60fps HTML5 Canvas GIS projection engine with physical fire modeling. It implements the Rothermel (1972) surface fire spread model, Byram's fireline intensity, Wooster's Fire Radiative Energy (FRE) integration, and a 2D Gaussian smoke plume dispersion model across NASA FIRMS (VIIRS and MODIS) satellite detection schemas.

## Why I Made This

This project started after I fell down a rabbit hole and developed a sudden interest in fire lookouts, backcountry fire spotting, and the physics of wildfire behavior across different terrains.

What began with reading about remote USFS lookout towers, Osborne Firefinders, and how spotters track azimuth bearings on smoke columns eventually turned into reading papers on orbital thermal anomalies (NASA FIRMS), fuel moisture extinction, and how wind and topography turn a small brush ignition into a complex megafire.

At the same time, I wanted an interface that matched the speed, keyboard workflow, and color palettes of custom Neovim setups (`tokyonight`, `catppuccin`, `gruvbox`, `kanagawa`, `rose-pine`). Instead of building another standard web dashboard, I built a digital fire lookout terminal structured like a Neovim environment, complete with `bufferline` tabs, a `telescope` fuzzy finder, `lualine` status bars, and an interactive `:command` prompt.

## Core Architecture

### 1. Wildfire & Atmospheric Physics Engine

* **Rothermel Surface Fire Spread Model:** Computes real-time Rate of Spread ($R$ in $\text{m/min}$ and $\text{km/h}$), Reaction Intensity ($I_R$), dimensionless wind multiplier ($\phi_W$), and topographic slope factor ($\phi_S$) across six fuel bed models (`Chaparral`, `Boreal Forest`, `Mediterranean Scrub`, `Eucalyptus Bush`, `Savanna Grassland`, `Tropical Rainforest`).
* **Byram's Fireline Intensity & Elliptical Growth:** Derives active flame length ($L_f$) and models forward elliptical burn area expansion ($\text{ha}$) over a 24-hour simulation horizon.
* **2D Gaussian Smoke Plume Model:** Evaluates downwind particulate matter ($\text{PM}_{2.5}$ in $\mu\text{g/m}^3$) along the wind vector using Pasquill-Gifford stability dispersion coefficients ($\sigma_y, \sigma_z$):

$$
C(x, y) = \frac{Q}{2\pi u \sigma_y \sigma_z} \exp\left(-\frac{y^2}{2\sigma_y^2}\right)
$$

* **Fire Radiative Energy (FRE) Integration:** Time-integrates orbital Fire Radiative Power ($\text{MW}$) into Gigajoules ($\text{GJ}$) and Terajoules ($\text{TJ}$), estimating dry biomass combustion rates ($\text{kg/s}$) using Wooster's radiative coefficient ($0.368\text{ kg/MJ}$).

### 2. 60FPS GIS Cartography Viewport

* **Dynamic FRP Pulse Rings:** Orbital anomaly markers whose pulse frequency and radius scale with radiated megawatts.
* **Directional Plume Vector Cones:** Renders 6-hour, 12-hour, and 24-hour downwind smoke drift corridors on the map canvas.
* **Hotspot Cluster Tessellation:** Groups proximate thermal anomalies within $15\text{ km}$ into buffered convex hull polygons using a Monotone Chain spatial hull algorithm.
* **Theater Presets:** Camera views for Global Command, California / Sierra Nevada, Mediterranean Basin, Canadian Boreal, SE Australia Bush, Amazonia, and Central African Savanna.

### 3. Neovim TUI & Keyboard Workflow

* **Colorschemes:** Live-switch between `tokyonight-storm`, `catppuccin-mocha`, `gruvbox-material`, `kanagawa-wave`, and `rose-pine`, updating both the UI split borders and the GIS vector canvas.
* **Buffers & Horizontal Splits:** Keep the interactive GIS map open while inspecting `2: firms_nrt.csv` (tabular telemetry) or `3: rothermel_plume.rs` (Rust struct evaluation preview) in a horizontal split below the canvas.
* **Telescope Fuzzy Finder:** Press `/` or `Ctrl+K` to filter 55+ global thermal anomalies by name, fuel type, satellite sensor, or region with a live physics preview pane.
* **NASA FIRMS NRT Ingestion & Export:** Paste raw NASA FIRMS CSV or GeoJSON payloads via `:Ingest` and export simulated perimeter and dispersion calculations back to `.csv` or `.geojson`.

## Keybindings & Ex-Commands

| Key / Command | Action |
| :--- | :--- |
| `j` / `k` | Cycle next / previous wildfire anomaly in the buffer |
| `/` or `Ctrl+K` | Open Telescope fuzzy finder modal with physics preview |
| `Space` | Toggle forward dispersion simulation playback (`1x` / `5x`) |
| `:` | Focus the bottom Ex-command line |
| `:colorscheme <name>` | Switch theme (`tokyonight`, `catppuccin`, `gruvbox`, `kanagawa`, `rose-pine`) |
| `:sim play` / `:sim pause` | Start or pause the 24-hour forward spread and smoke plume clock |
| `:w csv` / `:w geojson` | Export active filtered and simulated telemetry to disk |
| `:b1` / `:b2` / `:b3` | Switch between GIS viewport, CSV table split, and Rust physics buffer |
| `:e!` or `:reset` | Reset dataset and simulation clock to initial epoch |

## Installation

Requires Node.js 20.19 or newer.

```bash
git clone https://github.com/tahaenasraoui-debug/pyrowatch-core.git
cd pyrowatch-core
npm install
npm run dev
```

Open the `localhost` URL that Vite prints (usually `http://localhost:5173`).

### Production build

```bash
npm run build     # outputs to dist/
npm run preview   # serves the built app locally
```

`dist/` is plain static files, so it can be hosted anywhere (GitHub Pages, Netlify, Vercel, Cloudflare Pages). For GitHub Pages under a repo path, set `base: '/pyrowatch-core/'` in `vite.config.ts` before building.

## Repository Structure

```text
pyrowatch-core/
├── public/
├── src/
│   ├── PyroWatchCore.tsx   # The whole app: physics, canvas, UI, themes, data
│   ├── main.tsx            # Vite entry point
│   └── index.css           # Tailwind import
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE
```

Stack: React, TypeScript, Vite, Tailwind CSS v4, `lucide-react`. There is no backend and no API key. Everything runs in the browser.

## References & Data Attribution

* **Rothermel, R. C. (1972).** *A mathematical model for predicting fire spread in wildland fuels.* USDA Forest Service Research Paper INT-115.
* **Anderson, H. E. (1983).** *Predicting wind-driven wild land fire size and shape.* USDA Forest Service Research Paper INT-305.
* **Wooster, M. J., Roberts, G., Perry, G. L. W., & Kaufman, Y. J. (2005).** *Retrieval of biomass combustion rates and totals from fire radiative power observations: FRP derivation and calibration relationships between biomass consumption and fire radiative energy release.* Journal of Geophysical Research: Atmospheres.
* **NASA FIRMS:** Fire Information for Resource Management System (VIIRS S-NPP / NOAA-20 and MODIS Terra / Aqua NRT schemas).

## License

MIT
