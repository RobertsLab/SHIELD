/**
 * Runtime loading of the data bundles in public/data/.
 *
 * Bundles are fetched on demand, cached for the life of the page, and shared
 * between every component that asks for the same resource. Moving the data out
 * of the JavaScript bundle keeps the Research and Map routes from downloading
 * the growth dataset and lets the hourly live snapshot cache independently of
 * the application code.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { assembleObservations } from './observations';

const IDLE = { status: 'idle', data: null, error: null };

const resources = new Map();

export function dataUrl(filename) {
  return `${import.meta.env.BASE_URL}data/${filename}`;
}

export async function fetchJson(filename) {
  const response = await fetch(dataUrl(filename), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${filename} (HTTP ${response.status})`);
  }
  return response.json();
}

function getEntry(key) {
  let entry = resources.get(key);
  if (!entry) {
    entry = { key, snapshot: IDLE, listeners: new Set(), promise: null };
    resources.set(key, entry);
  }
  return entry;
}

function publish(entry, snapshot) {
  entry.snapshot = snapshot;
  for (const listener of entry.listeners) listener();
}

/** Start loading `key` with `loader` unless it is loading or loaded already. */
export function loadResource(key, loader) {
  const entry = getEntry(key);
  const { status } = entry.snapshot;
  if (status === 'idle' || status === 'error') {
    publish(entry, { status: 'loading', data: null, error: null });
    entry.promise = Promise.resolve()
      .then(loader)
      .then(
        (data) => publish(entry, { status: 'ready', data, error: null }),
        (error) => publish(entry, { status: 'error', data: null, error })
      );
  }
  return entry.promise;
}

function useEntrySnapshot(key) {
  const entry = getEntry(key);
  return useSyncExternalStore(
    (listener) => {
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    () => entry.snapshot,
    () => entry.snapshot
  );
}

/**
 * Subscribe to a resource and load it if needed.
 * Returns `{ status, data, error, retry }` where status is
 * `idle | loading | ready | error`.
 */
export function useResource(key, loader) {
  const snapshot = useEntrySnapshot(key);
  useEffect(() => {
    if (getEntry(key).snapshot.status === 'idle') loadResource(key, loader);
  }, [key, loader]);
  return { ...snapshot, retry: () => loadResource(key, loader) };
}

/** Subscribe to a resource without triggering a load. */
export function usePeekResource(key) {
  return useEntrySnapshot(key);
}

/** Drop cached resources. Intended for tests. */
export function resetResources() {
  resources.clear();
}

// ---------------------------------------------------------------------------
// Named resources
// ---------------------------------------------------------------------------

export const OBSERVATIONS_KEY = 'observations';

async function loadObservations() {
  const [field, growth, survival] = await Promise.all([
    fetchJson('realObservations.json'),
    fetchJson('growthObservations.json'),
    fetchJson('survivalObservations.json'),
  ]);
  return assembleObservations({ field, growth, survival });
}

const loadArchivalTemperature = () => fetchJson('archivalTemperatureData.json');
const loadLiveTemperature = () => fetchJson('liveTemperature.json');

/** Combined field, growth, and survival observations with vocabularies. */
export function useObservations() {
  return useResource(OBSERVATIONS_KEY, loadObservations);
}

export function useArchivalTemperature() {
  return useResource('archivalTemperature', loadArchivalTemperature);
}

export function useLiveTemperature() {
  return useResource('liveTemperature', loadLiveTemperature);
}
