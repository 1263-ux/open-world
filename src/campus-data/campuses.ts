import data from './spatial.json';
import type { CampusData, CampusId } from '../shared/contracts';
export const campuses = data as unknown as Record<CampusId, CampusData>;
