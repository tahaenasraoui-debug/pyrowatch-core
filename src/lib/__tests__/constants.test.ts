import { describe, expect, it } from 'vitest';
import { LookoutSoundEngine } from '../audio';
import {
  HISTORIC_LOOKOUT_TOWERS,
  NVIM_THEMES,
  THEATER_BUTTONS,
  THEATER_PRESETS
} from '../constants';
import { INITIAL_FIRMS_INCIDENTS } from '../incidents';
import { FUEL_MODEL_SPECS } from '../physics';

describe('Theater Presets, Dataset Integrity & Audio Safety', () => {
  it('aligns all 7 Theater quick-jump buttons with THEATER_PRESETS keys', () => {
    expect(THEATER_BUTTONS).toHaveLength(7);
    const presetKeys = Object.keys(THEATER_PRESETS);
    expect(presetKeys).toHaveLength(7);

    for (const btn of THEATER_BUTTONS) {
      const preset = THEATER_PRESETS[btn.id];
      expect(preset).toBeDefined();
      expect(Number.isFinite(preset.centerLat)).toBe(true);
      expect(Number.isFinite(preset.centerLon)).toBe(true);
      expect(preset.zoom).toBeGreaterThan(0);
    }

    const ids = THEATER_BUTTONS.map((b) => b.id);
    expect(ids).toContain('AUSTRALIA');
    expect(ids).toContain('AMAZONIA');
    expect(ids).toContain('SAVANNA_AFRICA');
  });

  it('contains 53 valid built-in synthetic FIRMS incidents with unique IDs', () => {
    expect(INITIAL_FIRMS_INCIDENTS).toHaveLength(53);

    const seenIds = new Set<string>();
    for (const inc of INITIAL_FIRMS_INCIDENTS) {
      expect(seenIds.has(inc.incident_id)).toBe(false);
      seenIds.add(inc.incident_id);

      expect(THEATER_PRESETS[inc.region]).toBeDefined();
      expect(FUEL_MODEL_SPECS[inc.fuel_type]).toBeDefined();
      expect(inc.latitude).toBeGreaterThanOrEqual(-90);
      expect(inc.latitude).toBeLessThanOrEqual(90);
      expect(inc.longitude).toBeGreaterThanOrEqual(-180);
      expect(inc.longitude).toBeLessThanOrEqual(180);
      expect(inc.frp).toBeGreaterThan(0);
    }
  });

  it('defines all 5 Neovim colorschemes and historic lookout towers', () => {
    expect(Object.keys(NVIM_THEMES)).toHaveLength(5);
    expect(HISTORIC_LOOKOUT_TOWERS.length).toBeGreaterThanOrEqual(6);
  });

  it('handles LookoutSoundEngine operations safely without Web Audio API', () => {
    const engine = new LookoutSoundEngine();
    expect(engine.enabled).toBe(false);
    expect(engine.setEnabled(true)).toBe(true);
    expect(engine.setEnabled(true)).toBe(true);
    expect(() => engine.updateThermalPower(485.6)).not.toThrow();
    expect(() => engine.playSquelch()).not.toThrow();
    expect(() => engine.playKeyClick()).not.toThrow();
    expect(() => engine.playVlatRadio()).not.toThrow();
    expect(engine.toggle()).toBe(false);
  });
});
