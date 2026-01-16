// Types for Claude Code data structures
import type { SessionInfo, SessionDetail, ProjectSummary, SessionsResponse } from '../../shared/types.ts';

export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  project: string;
  timestamp: number;
  sessionId: string;
}

export interface SessionMessage {
  type: 'user' | 'assistant' | 'file-history-snapshot';
  messageId: string;
  timestamp: number;
  message?: {
    content: string;
    role: string;
  };
  snapshot?: {
    messageId: string;
    timestamp: number;
    trackedFileBackups: Record<string, unknown>;
  };
  isSnapshotUpdate?: boolean;
}

export interface ClaudeFsService {
  getHistoryEntries(): Promise<HistoryEntry[]>;
  getSessionInfos(query?: { project?: string; search?: string; limit?: number; offset?: number }): Promise<SessionsResponse>;
  getSessionDetail(sessionId: string, projectPath: string): Promise<SessionDetail | null>;
  getProjectSummaries(): Promise<ProjectSummary[]>;
  getRawSessionData(sessionId: string, projectPath: string): Promise<string | null>;
}
