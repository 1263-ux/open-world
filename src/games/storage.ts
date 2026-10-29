import type { CampusData, CampusId } from '../shared/contracts';
import { emptyQuest, validateQuest, type QuestState } from './quest';

const STORAGE_KEY = 'campus-atlas:quests';
const VERSION = 1;

export type QuestProgress = Record<CampusId, QuestState>;

function freshProgress(): QuestProgress {
  return { huyu: emptyQuest(), yingxi: emptyQuest() };
}

/** Storage is optional: private browsing, denied access and malformed data are safe. */
export function loadProgress(campuses: Record<CampusId, CampusData>): QuestProgress {
  const result = freshProgress();
  try {
    if (typeof window === 'undefined') return result;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return result;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;
    const envelope = parsed as Record<string, unknown>;
    if (envelope.version !== VERSION || !envelope.campuses || typeof envelope.campuses !== 'object' || Array.isArray(envelope.campuses)) return result;
    const saved = envelope.campuses as Record<string, unknown>;
    for (const id of ['huyu', 'yingxi'] as const) {
      result[id] = validateQuest(campuses[id], saved[id]) ?? emptyQuest();
    }
  } catch {
    return result;
  }
  return result;
}

/** Returns false when progress could not be persisted; the in-memory experience still works. */
export function saveProgress(progress: QuestProgress): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, campuses: progress }));
    return true;
  } catch {
    return false;
  }
}
