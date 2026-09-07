/**
 * Static site metadata for the C. gigas outplant sites and the dashboard's
 * controlled vocabularies. Nothing here depends on the fetched data bundles.
 */

/** Geographic metadata for the real C. gigas outplant sites. */
export const SITE_LOCATIONS = {
  'Thorndyke Bay': {
    lat: 47.808,
    lng: -122.738,
    region: 'Thorndyke Bay, Hood Canal, WA',
    description:
      '10K-Seed + PolyIC outplants; protected inlet with warmer water and highly variable survival.',
    color: '#2563eb',
  },
  'Sequim Bay': {
    lat: 48.07,
    lng: -123.03,
    region: 'Sequim Bay, WA',
    description:
      'Effort A thermal-hardening + PolyIC outplants. Moderate temperatures with low background mortality.',
    color: '#0891b2',
  },
  'Palix River/Willapa Bay': {
    lat: 46.62,
    lng: -123.86,
    region: 'Palix River, Willapa Bay, WA',
    description:
      'Multi-year Effort E hardening outplants; estuary site with variable temperature.',
    color: '#d97706',
  },
  Westcott: {
    lat: 48.582,
    lng: -123.167,
    region: 'Westcott Bay, San Juan Island, WA',
    description:
      'Westcott Shellfish. Effort B (daily) & D (weekly) thermal-hardening outplants; cooler San Juan Island water.',
    color: '#6366f1',
  },
};

export const MAP_CENTER = { lat: 47.6, lng: -123.1 };
export const MAP_ZOOM = 7;

/** Display order of the treatment axis. Mirrors TREATMENT_ORDER in scripts/shield_data.py. */
export const TREATMENT_ORDER = [
  'Control',
  'Heat primed',
  'Freshwater primed',
  'Immune primed',
  'Combined stress primed',
  'Treated',
];

export const TREATMENT_COLORS = {
  Control: '#64748b',
  'Heat primed': '#dc2626',
  'Freshwater primed': '#0891b2',
  'Immune primed': '#7c3aed',
  'Combined stress primed': '#059669',
  Treated: '#f59e0b',
};

export const METRICS = ['Growth Volume', 'Temperature', 'Survival'];

export const FALLBACK_COLOR = '#64748b';

export function siteColor(site) {
  return SITE_LOCATIONS[site]?.color ?? FALLBACK_COLOR;
}
