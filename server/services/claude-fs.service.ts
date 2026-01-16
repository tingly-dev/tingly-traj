// Service for reading Claude Code session data from filesystem
import type { HistoryEntry, SessionMessage, ClaudeFsService } from '../types/claude.types.ts';
import type { SessionInfo, SessionDetail, ProjectSummary, Message } from '../../shared/types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Parse a single JSONL line safely
function parseJSONL(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// Read and parse history.jsonl
async function readHistory(): Promise<HistoryEntry[]> {
  try {
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    const entries: HistoryEntry[] = [];

    for (const line of lines) {
      const parsed = parseJSONL(line);
      if (parsed && typeof parsed === 'object' && 'sessionId' in parsed) {
        entries.push(parsed as HistoryEntry);
      }
    }
    return entries;
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
}

// Read and parse a session JSONL file
async function readSessionFile(sessionPath: string): Promise<SessionMessage[]> {
  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.trim().split('\n');
    const messages: SessionMessage[] = [];

    for (const line of lines) {
      const parsed = parseJSONL(line);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        messages.push(parsed as SessionMessage);
      }
    }
    return messages;
  } catch (error) {
    console.error('Error reading session file:', error);
    return [];
  }
}

// Get project path encoding for directory names
function encodeProjectPath(projectPath: string): string {
  return '-' + projectPath.replace(/^\//, '').replace(/\//g, '-');
}

function decodeProjectPath(encoded: string): string {
  return '/' + encoded.replace(/^-/, '').replace(/-/g, '/');
}

// Convert SessionMessage to Message
function convertMessage(msg: any): Message {
  // Handle both uuid and messageId fields
  const id = (msg as any).uuid || (msg as any).messageId || '';

  // Handle both ISO string and number timestamps
  let timestamp: number;
  if (typeof msg.timestamp === 'string') {
    timestamp = new Date(msg.timestamp).getTime();
  } else if (typeof msg.snapshot?.timestamp === 'string') {
    timestamp = new Date(msg.snapshot.timestamp).getTime();
  } else {
    timestamp = msg.timestamp || Date.now();
  }

  if (msg.type === 'file-history-snapshot') {
    return {
      type: 'file-history-snapshot',
      messageId: id,
      timestamp,
      content: '[File history snapshot]',
    };
  }

  return {
    type: msg.type,
    messageId: id,
    timestamp,
    content: msg.message?.content || '',
    role: msg.message?.role,
  };
}

export const claudeFsService: ClaudeFsService = {
  // Get all history entries
  async getHistoryEntries(): Promise<HistoryEntry[]> {
    return readHistory();
  },

  // Get session infos with optional filtering
  async getSessionInfos(query?: {
    project?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: SessionInfo[]; total: number; hasMore: boolean }> {
    const entries = await readHistory();
    let filtered = entries.filter((e) => e.sessionId && e.project);

    if (query?.project) {
      filtered = filtered.filter((e) => e.project === query.project);
    }

    if (query?.search) {
      const searchLower = query.search.toLowerCase();
      filtered = filtered.filter((e) =>
        e.display.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;

    const sessions = filtered
      .slice(offset, offset + limit)
      .map((e) => ({
        sessionId: e.sessionId,
        display: e.display,
        project: e.project,
        timestamp: e.timestamp,
      }));

    return {
      sessions,
      total,
      hasMore: offset + limit < total,
    };
  },

  // Get full session detail
  async getSessionDetail(
    sessionId: string,
    projectPath: string
  ): Promise<SessionDetail | null> {
    const encodedProject = encodeProjectPath(projectPath);
    const sessionPath = path.join(PROJECTS_DIR, encodedProject, `${sessionId}.jsonl`);

    console.log(`Reading session from: ${sessionPath}`);

    const messages = await readSessionFile(sessionPath);
    console.log(`Found ${messages.length} messages`);

    if (messages.length === 0) {
      return null;
    }

    // Get the original history entry for metadata
    const entries = await readHistory();
    const entry = entries.find((e) => e.sessionId === sessionId);

    return {
      sessionId,
      display: entry?.display || '',
      project: projectPath,
      createdAt: messages[0]?.timestamp || Date.now(),
      messages: messages.map(convertMessage),
    };
  },

  // Get project summaries
  async getProjectSummaries(): Promise<ProjectSummary[]> {
    const entries = await readHistory();

    const projectMap = new Map<string, { count: number; lastActivity: number }>();

    for (const entry of entries) {
      if (!entry.project) continue;

      const existing = projectMap.get(entry.project);
      if (existing) {
        existing.count++;
        if (entry.timestamp > existing.lastActivity) {
          existing.lastActivity = entry.timestamp;
        }
      } else {
        projectMap.set(entry.project, {
          count: 1,
          lastActivity: entry.timestamp,
        });
      }
    }

    return Array.from(projectMap.entries())
      .map(([path, data]) => ({
        path,
        name: path.split('/').pop() || path,
        sessionCount: data.count,
        lastActivity: data.lastActivity,
      }))
      .sort((a, b) => b.lastActivity - a.lastActivity);
  },

  // Get raw session file content for export
  async getRawSessionData(sessionId: string, projectPath: string): Promise<string | null> {
    const encodedProject = encodeProjectPath(projectPath);
    const sessionPath = path.join(PROJECTS_DIR, encodedProject, `${sessionId}.jsonl`);

    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Error reading session file for export:', error);
      return null;
    }
  },
};
