import type { CampusData } from '../shared/contracts';

export type QuestStatus = 'idle' | 'active' | 'completed';

export interface QuestState {
  status: QuestStatus;
  visited: string[];
}

export interface VisitResult {
  state: QuestState;
  message: string;
}

export function emptyQuest(): QuestState {
  return { status: 'idle', visited: [] };
}

export function startQuest(campus: CampusData): QuestState {
  return { status: campus.questOrder.length ? 'active' : 'completed', visited: [] };
}

export function visitQuest(campus: CampusData, state: QuestState, id: string): VisitResult {
  if (state.status !== 'active') {
    return { state, message: '请先开始探索任务。' };
  }
  if (state.visited.includes(id)) {
    return { state, message: '这一站已经记录过了。' };
  }
  if (campus.questOrder[state.visited.length] !== id) {
    return { state, message: '请先按照任务顺序记录当前一站。' };
  }
  const visited = [...state.visited, id];
  const completed = visited.length === campus.questOrder.length;
  return {
    state: { status: completed ? 'completed' : 'active', visited },
    message: completed ? '已记录最后一站，探索完成！' : '已记录这一站，继续寻找下一站。',
  };
}

/** Reject partial, reordered, duplicate, unknown or otherwise inconsistent progress. */
export function validateQuest(campus: CampusData, value: unknown): QuestState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const status = candidate.status;
  const visited = candidate.visited;
  if (status !== 'idle' && status !== 'active' && status !== 'completed') return null;
  if (!Array.isArray(visited) || !visited.every((id): id is string => typeof id === 'string')) return null;
  if (new Set(visited).size !== visited.length || visited.length > campus.questOrder.length) return null;
  const landmarkIds = new Set(campus.landmarks.map((landmark) => landmark.id));
  if (!visited.every((id, index) => id === campus.questOrder[index] && landmarkIds.has(id))) return null;
  if (status === 'idle' && visited.length !== 0) return null;
  if (status === 'active' && (campus.questOrder.length === 0 || visited.length >= campus.questOrder.length)) return null;
  if (status === 'completed' && visited.length !== campus.questOrder.length) return null;
  return { status, visited: [...visited] };
}
