import { JOURNEY_PHOTO_IDS, type JourneyState, type JourneyPhotoId } from './journey';
export const JOURNEY_STORAGE_KEY = 'campus-atlas:journey:v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
function storage(): StoragePort | null { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function parseJourney(value: unknown): JourneyState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(raw.sessionId) || !Array.isArray(raw.photos)) return null;
  if (typeof raw.flightCompleted !== 'boolean' || typeof raw.tutorialSeen !== 'boolean' || !JOURNEY_PHOTO_IDS.includes(raw.checkpoint as JourneyPhotoId)) return null;
  if (raw.bestFlight !== null && (typeof raw.bestFlight !== 'number' || !Number.isFinite(raw.bestFlight) || raw.bestFlight <= 0 || raw.bestFlight > 120)) return null;
  const photos = JOURNEY_PHOTO_IDS.filter(id => (raw.photos as unknown[]).includes(id));
  // A partial/corrupted envelope cannot assert a completed run.
  const flightCompleted = raw.flightCompleted && photos.length === JOURNEY_PHOTO_IDS.length && raw.bestFlight !== null;
  return { version: 1, sessionId: raw.sessionId, photos, flightCompleted, bestFlight: raw.bestFlight as number | null, tutorialSeen: raw.tutorialSeen, checkpoint: raw.checkpoint as JourneyPhotoId };
}
export function loadJourney(port: StoragePort | null = storage()): JourneyState | null {
  try { return parseJourney(JSON.parse(port?.getItem(JOURNEY_STORAGE_KEY) ?? 'null')); } catch { return null; }
}
/** False means the caller retains the state in memory; never writes photo pixels. */
export function saveJourney(state: JourneyState, port: StoragePort | null = storage()): boolean {
  try { const safe = parseJourney(state); if (!port || !safe) return false; port.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(safe)); return true; } catch { return false; }
}
