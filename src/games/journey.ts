/** One journal run. Permanent photo stamps and old landmark quests are separate. */
export const JOURNEY_PHOTO_IDS = ['hall', 'garden', 'platform'] as const;
export type JourneyPhotoId = typeof JOURNEY_PHOTO_IDS[number];
export type JourneyCheckpoint = 'hall' | 'garden' | 'platform';
export interface JourneyState {
  version: 1;
  sessionId: string;
  photos: JourneyPhotoId[];
  flightCompleted: boolean;
  bestFlight: number | null;
  tutorialSeen: boolean;
  checkpoint: JourneyCheckpoint;
}
export type JourneyStage = JourneyPhotoId | 'flight' | 'complete';
export function createJourney(sessionId = `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`): JourneyState {
  return { version: 1, sessionId, photos: [], flightCompleted: false, bestFlight: null, tutorialSeen: false, checkpoint: 'hall' };
}
export function journeyStage(state: JourneyState): JourneyStage {
  return JOURNEY_PHOTO_IDS.find(id => !state.photos.includes(id)) ?? (state.flightCompleted ? 'complete' : 'flight');
}
export function recordJourneyPhoto(state: JourneyState, id: string): JourneyState {
  if (!JOURNEY_PHOTO_IDS.includes(id as JourneyPhotoId) || state.photos.includes(id as JourneyPhotoId)) return state;
  // Capture can be explored out of order; the objective always shows the first missing photo.
  return { ...state, photos: JOURNEY_PHOTO_IDS.filter(key => key === id || state.photos.includes(key)), checkpoint: id as JourneyCheckpoint };
}
export function recordJourneyFlight(state: JourneyState, result: { success: boolean; score: number }): JourneyState {
  if (!result.success || !Number.isFinite(result.score) || result.score <= 0 || result.score > 120 || JOURNEY_PHOTO_IDS.some(id => !state.photos.includes(id))) return state;
  return { ...state, flightCompleted: true, bestFlight: state.bestFlight === null ? result.score : Math.min(state.bestFlight, result.score), checkpoint: 'platform' };
}
