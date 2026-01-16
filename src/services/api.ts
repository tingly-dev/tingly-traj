// API service for communicating with backend
import type { SessionDetail, ProjectSummary, SessionsQuery, SessionsResponse } from '../../shared/types.ts';

const API_BASE = '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  // Get sessions with optional filters
  async getSessions(query?: SessionsQuery): Promise<SessionsResponse> {
    const params = new URLSearchParams();
    if (query?.project) params.set('project', query.project);
    if (query?.search) params.set('search', query.search);
    if (query?.limit) params.set('limit', query.limit.toString());
    if (query?.offset) params.set('offset', query.offset.toString());

    const url = `${API_BASE}/sessions${params.toString() ? `?${params}` : ''}`;
    return fetchJson<SessionsResponse>(url);
  },

  // Get session detail
  async getSession(sessionId: string, project: string): Promise<SessionDetail> {
    return fetchJson<SessionDetail>(`${API_BASE}/sessions/${sessionId}?project=${encodeURIComponent(project)}`);
  },

  // Get all projects
  async getProjects(): Promise<ProjectSummary[]> {
    return fetchJson<ProjectSummary[]>(`${API_BASE}/projects`);
  },
};
