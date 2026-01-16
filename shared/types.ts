// Shared types between frontend and backend

export interface SessionInfo {
  sessionId: string;
  display: string;
  project: string;
  timestamp: number;
  messageCount?: number;
}

export interface Message {
  type: 'user' | 'assistant' | 'file-history-snapshot';
  messageId: string;
  timestamp: number;
  content: string;
  role?: string;
}

export interface SessionDetail {
  sessionId: string;
  display: string;
  project: string;
  createdAt: number;
  messages: Message[];
}

export interface ProjectSummary {
  path: string;
  name: string;
  sessionCount: number;
  lastActivity: number;
}

export interface SessionsQuery {
  project?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SessionsResponse {
  sessions: SessionInfo[];
  total: number;
  hasMore: boolean;
}
