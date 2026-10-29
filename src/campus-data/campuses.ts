import data from './spatial.json' with { type: 'json' };
import type { CampusData, CampusId } from '../shared/contracts';
export const campuses = data as unknown as Record<CampusId, CampusData>;
