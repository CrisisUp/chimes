/**
 * Integration tests — verify that modules communicate correctly through
 * their exported APIs and callback wiring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ──────────────────────────────────────────────────────────────
   1. countries.json → countries.js data pipeline
   ────────────────────────────────────────────────────────────── */
describe('countries data pipeline', () => {
  let COUNTRIES, COUNTRY_ORDER, DEFAULT_COUNTRY, neighborsOf, charForCell;

  beforeEach(async () => {
    const mod = await import('./countries.js');
    COUNTRIES = mod.COUNTRIES;
    COUNTRY_ORDER = mod.COUNTRY_ORDER;
    DEFAULT_COUNTRY = mod.DEFAULT_COUNTRY;
    neighborsOf = mod.neighborsOf;
    charForCell = mod.charForCell;
  });

  it('loads all 13 countries from JSON', () => {
    expect(Object.keys(COUNTRIES)).toHaveLength(13);
  });

  it('each country has required fields', () => {
    for (const [id, country] of Object.entries(COUNTRIES)) {
      expect(country.id).toBe(id);
      expect(country.name).toBeTruthy();
      expect(country.roof).toContain('.webp');
      expect(country.writing).toMatch(/^(horizontal|vertical)$/);
      expect(typeof country.cloth).toBe('string');
      expect(country.cloth.length).toBeGreaterThan(100);
      expect(country.title).toBeTruthy();
      expect(country.aside).toBeTruthy();
      expect(country.eyebrow).toBeTruthy();
    }
  });

  it('cloth strings are joined with full-width space', () => {
    for (const country of Object.values(COUNTRIES)) {
      expect(country.cloth).toContain('　');
    }
  });

  it('COUNTRY_ORDER has all 13 countries', () => {
    expect(COUNTRY_ORDER).toHaveLength(13);
    for (const id of COUNTRY_ORDER) {
      expect(COUNTRIES[id]).toBeDefined();
    }
  });

  it('DEFAULT_COUNTRY is china', () => {
    expect(DEFAULT_COUNTRY).toBe('china');
    expect(COUNTRIES[DEFAULT_COUNTRY]).toBeDefined();
  });

  it('neighborsOf wraps around correctly', () => {
    const first = neighborsOf(COUNTRY_ORDER[0]);
    expect(first.left).toBe(COUNTRY_ORDER[COUNTRY_ORDER.length - 1]);
    expect(first.right).toBe(COUNTRY_ORDER[1]);

    const last = neighborsOf(COUNTRY_ORDER[COUNTRY_ORDER.length - 1]);
    expect(last.left).toBe(COUNTRY_ORDER[COUNTRY_ORDER.length - 2]);
    expect(last.right).toBe(COUNTRY_ORDER[0]);
  });

  it('charForCell maps horizontal text to grid', () => {
    const text = 'ABCDEF';
    // row 0, col 0 → 'A'; row 0, col 1 → 'B'; row 1, col 0 → 'D'
    expect(charForCell(text, 0, 0, 3, 2, 'horizontal')).toBe('A');
    expect(charForCell(text, 1, 0, 3, 2, 'horizontal')).toBe('B');
    expect(charForCell(text, 0, 1, 3, 2, 'horizontal')).toBe('D');
  });

  it('charForCell maps vertical text to grid', () => {
    const text = 'ABCDEF';
    // vertical: colFromRight = gridW-1-i
    expect(charForCell(text, 2, 0, 3, 2, 'vertical')).toBe('A');
    expect(charForCell(text, 1, 0, 3, 2, 'vertical')).toBe('C');
    expect(charForCell(text, 0, 0, 3, 2, 'vertical')).toBe('E');
  });
});

/* ──────────────────────────────────────────────────────────────
   2. country-chimes.json → chimes.js profile pipeline
   ────────────────────────────────────────────────────────────── */
describe('chimes profile pipeline', () => {
  let COUNTRY_CHIMES;

  beforeEach(async () => {
    const mod = await import('./chimes.js');
    COUNTRY_CHIMES = (await import('./country-chimes.json')).default;
  });

  it('loads profiles for all 13 countries', () => {
    expect(Object.keys(COUNTRY_CHIMES)).toHaveLength(13);
  });

  it('each profile has all required fields', () => {
    const requiredKeys = [
      'freqs', 'partials', 'duration', 'attack', 'peak', 'droop',
      'noiseDur', 'noiseGain', 'noiseQ', 'noiseMul', 'shelfHz',
      'shelfGain', 'minIntervalMs'
    ];
    for (const [id, profile] of Object.entries(COUNTRY_CHIMES)) {
      for (const key of requiredKeys) {
        expect(profile[key], `${id}.${key}`).toBeDefined();
      }
      expect(profile.freqs.length).toBeGreaterThanOrEqual(4);
      expect(profile.partials.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('StringChimes falls back to china for unknown country', async () => {
    const { StringChimes } = await import('./chimes.js');
    const chimes = new StringChimes();
    chimes.setCountry('nonexistent');
    expect(chimes.profile).toEqual(COUNTRY_CHIMES.china);
  });

  it('StringChimes switches profile on setCountry', async () => {
    const { StringChimes } = await import('./chimes.js');
    const chimes = new StringChimes();
    chimes.setCountry('japan');
    expect(chimes.profile).toEqual(COUNTRY_CHIMES.japan);
    expect(chimes.profile.freqs[0]).toBe(659.25);
  });
});

/* ──────────────────────────────────────────────────────────────
   3. about-modal.js — DOM interaction
   ────────────────────────────────────────────────────────────── */
describe('about-modal integration', () => {
  let initAboutModal;

  beforeEach(async () => {
    // Set up minimal DOM
    document.body.innerHTML = `
      <button id="aboutBtn">About</button>
      <div id="aboutModal" hidden aria-hidden="true">
        <button id="aboutClose">Close</button>
        <button id="aboutCloseBg"></button>
      </div>
    `;
    const mod = await import('./modules/about-modal.js');
    initAboutModal = mod.initAboutModal;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens and closes the modal', () => {
    const { setAboutOpen, isAboutOpen } = initAboutModal({});
    expect(isAboutOpen()).toBe(false);

    setAboutOpen(true);
    expect(isAboutOpen()).toBe(true);
    const modal = document.getElementById('aboutModal');
    expect(modal.hidden).toBe(false);
    expect(modal.getAttribute('aria-hidden')).toBe('false');

    setAboutOpen(false);
    expect(isAboutOpen()).toBe(false);
    expect(modal.hidden).toBe(true);
    expect(modal.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onBeforeOpen when opening', () => {
    const onBeforeOpen = vi.fn();
    const { setAboutOpen } = initAboutModal({ onBeforeOpen });
    setAboutOpen(true);
    expect(onBeforeOpen).toHaveBeenCalledOnce();
  });

  it('clicking About button opens the modal', () => {
    const { isAboutOpen } = initAboutModal({});
    document.getElementById('aboutBtn').click();
    expect(isAboutOpen()).toBe(true);
  });

  it('clicking close button closes the modal', () => {
    const { setAboutOpen, isAboutOpen } = initAboutModal({});
    setAboutOpen(true);
    document.getElementById('aboutClose').click();
    expect(isAboutOpen()).toBe(false);
  });

  it('clicking backdrop closes the modal', () => {
    const { setAboutOpen, isAboutOpen } = initAboutModal({});
    setAboutOpen(true);
    document.getElementById('aboutCloseBg').click();
    expect(isAboutOpen()).toBe(false);
  });
});

/* ──────────────────────────────────────────────────────────────
   4. layout.js — responsive positioning
   ────────────────────────────────────────────────────────────── */
describe('layout integration', () => {
  let layoutAreaAboveCopy;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="stage" data-view="home">
        <div id="area"></div>
        <div class="eyebrow"></div>
        <div id="carouselViewport"></div>
        <div id="bottomCopy"></div>
      </div>
    `;
    // Mock matchMedia for desktop
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const mod = await import('./modules/layout.js');
    layoutAreaAboveCopy = mod.layoutAreaAboveCopy;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('clears inline styles on desktop', () => {
    const area = document.getElementById('area');
    area.style.bottom = '100px';
    layoutAreaAboveCopy();
    expect(area.style.bottom).toBe('');
    expect(area.style.top).toBe('');
  });

  it('positions area above copy on mobile home view', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const stage = document.getElementById('stage');
    const area = document.getElementById('area');
    const eyebrow = document.querySelector('.eyebrow');

    // Mock getBoundingClientRect
    stage.getBoundingClientRect = vi.fn().mockReturnValue({ top: 0, height: 900 });
    eyebrow.getBoundingClientRect = vi.fn().mockReturnValue({ top: 600 });

    layoutAreaAboveCopy();
    expect(area.style.top).toBe('auto');
    expect(area.style.bottom).toBeTruthy();
  });

  it('clears styles on mobile non-home view', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    document.getElementById('stage').dataset.view = 'destinations';
    const area = document.getElementById('area');
    area.style.bottom = '100px';

    layoutAreaAboveCopy();
    expect(area.style.bottom).toBe('');
  });
});

/* ──────────────────────────────────────────────────────────────
   5. navigation.js — callback wiring
   ────────────────────────────────────────────────────────────── */
describe('navigation callback wiring', () => {
  let initNavigation;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="stage">
        <div id="scene"></div>
        <div id="bottomCopy"></div>
        <div id="roofImg" src="">
        <div id="area" data-country="">
        <h1 id="pageTitle"></h1>
        <span id="eyebrowText"></span>
        <p id="pageAside"></p>
        <button id="btnLeft" data-country=""><span id="btnLeftIcon" src=""><span id="btnLeftLabel"></button>
        <button id="btnRight" data-country=""><span id="btnRightIcon" src=""><span id="btnRightLabel"></button>
      </div>
    `;
    // Mock matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const mod = await import('./modules/navigation.js');
    initNavigation = mod.initNavigation;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calls refreshBindings when country changes', async () => {
    const refreshBindings = vi.fn();
    const config = { country: 'china', gridW: 36, gridH: 40 };
    const nav = initNavigation({
      config,
      refreshBindings,
      rerender: () => {},
      onLayout: () => {}
    });

    // setCountryImmediate is called internally; verify bindings were refreshed
    expect(refreshBindings).toHaveBeenCalled();
  });

  it('calls rerender when country changes', async () => {
    const rerender = vi.fn();
    const config = { country: 'china', gridW: 36, gridH: 40 };
    const nav = initNavigation({
      config,
      refreshBindings: () => {},
      rerender,
      onLayout: () => {}
    });

    rerender.mockClear();
    nav.setCountry('japan', { animate: false });
    expect(rerender).toHaveBeenCalled();
  });

  it('calls onLayout when country changes', async () => {
    const onLayout = vi.fn();
    const config = { country: 'china', gridW: 36, gridH: 40 };
    const nav = initNavigation({
      config,
      refreshBindings: () => {},
      rerender: () => {},
      onLayout
    });

    onLayout.mockClear();
    nav.setCountry('japan', { animate: false });
    // onLayout is called via requestAnimationFrame inside applyCountryCopy
    await new Promise(r => requestAnimationFrame(r));
    expect(onLayout).toHaveBeenCalled();
  });

  it('updates CONFIG.country when switching countries', async () => {
    const config = { country: 'china', gridW: 36, gridH: 40 };
    const nav = initNavigation({
      config,
      refreshBindings: () => {},
      rerender: () => {},
      onLayout: () => {}
    });

    // Change to japan (animate: false for immediate switch)
    nav.setCountry('japan', { animate: false });
    expect(config.country).toBe('japan');
    expect(nav.getCurrentCountryId()).toBe('japan');
  });

  it('persists country to localStorage', async () => {
    const config = { country: 'china', gridW: 36, gridH: 40 };
    const nav = initNavigation({
      config,
      refreshBindings: () => {},
      rerender: () => {},
      onLayout: () => {}
    });

    nav.setCountry('france', { animate: false });
    expect(localStorage.getItem('budarina-country')).toBe('france');
  });

  it('updates side buttons DOM', async () => {
    const config = { country: 'china', gridW: 36, gridH: 40 };
    initNavigation({
      config,
      refreshBindings: () => {},
      rerender: () => {},
      onLayout: () => {}
    });

    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    // After init, buttons should have country data
    expect(btnLeft.dataset.country).toBeTruthy();
    expect(btnRight.dataset.country).toBeTruthy();
  });
});

/* ──────────────────────────────────────────────────────────────
   6. tweakpane.js — CONFIG creation
   ────────────────────────────────────────────────────────────── */

// Mock the Tweakpane CDN import
vi.mock('https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js', () => {
  class MockPane {
    constructor() { this.hidden = true; this.element = { classList: { add() {} } }; }
    addFolder() { return { addBinding: () => ({ on: () => ({}) }), addButton: () => ({ on: () => {} }), on: () => {} }; }
  }
  return { Pane: MockPane };
});

describe('tweakpane CONFIG creation', () => {
  let initTweakpane;

  beforeEach(async () => {
    document.body.innerHTML = `<button id="chatBtn"><span class="chat-btn__label">Play</span></button>`;
    const mod = await import('./modules/tweakpane.js');
    initTweakpane = mod.initTweakpane;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns a CONFIG object with all required fields', () => {
    const CONFIG = initTweakpane({ rerender: () => {}, onCountryChange: () => {} });
    expect(CONFIG.gravity).toBeDefined();
    expect(CONFIG.damping).toBeDefined();
    expect(CONFIG.width).toBeDefined();
    expect(CONFIG.height).toBeDefined();
    expect(CONFIG.gridW).toBeDefined();
    expect(CONFIG.gridH).toBeDefined();
    expect(CONFIG.country).toBe('china');
    expect(CONFIG.chimes).toBe(true);
    expect(typeof CONFIG.chimeVolume).toBe('number');
  });

  it('exposes isPaneEvent function', () => {
    initTweakpane({ rerender: () => {}, onCountryChange: () => {} });
    const { isPaneEvent } = initTweakpane;
    expect(typeof isPaneEvent).toBe('function');

    // Simulate click on Tweakpane panel
    const paneEl = document.createElement('div');
    paneEl.className = 'tp-dfwv';
    document.body.appendChild(paneEl);
    const event = { target: paneEl };
    expect(isPaneEvent(event)).toBe(true);
  });

  it('exposes refreshGridBindings function', () => {
    initTweakpane({ rerender: () => {}, onCountryChange: () => {} });
    const { refreshGridBindings } = initTweakpane;
    expect(typeof refreshGridBindings).toBe('function');
    // Should not throw
    expect(() => refreshGridBindings(40, 50)).not.toThrow();
  });
});
