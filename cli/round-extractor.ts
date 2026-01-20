// Round extraction logic from Claude Code session data
import type { ClaudeRawEntry, Round, RoundEntry, RoundListOutput, ThinkingMetadata } from './types.ts';
import * as fs from 'node:fs/promises';

export interface SystemEntryInput {
  type: string;
  uuid?: string;
  message?: {
    role: string;
    content: string;
  };
  parentUuid?: string | null;
  isSidechain?: boolean;
  userType?: string;
  cwd?: string;
  sessionId?: string;
  version?: string;
  gitBranch?: string;
  timestamp?: string;
  thinkingMetadata?: ThinkingMetadata;
  todos?: unknown[];
  [key: string]: unknown;
}

// Fields that should be extracted from actual session entries
const CONTEXT_FIELDS = [
  'cwd',
  'sessionId',
  'version',
  'gitBranch',
  'userType',
  'isSidechain',
  'thinkingMetadata',
  'todos',
] as const;

export function extractContextFields(entries: ClaudeRawEntry[]): Partial<ClaudeRawEntry> {
  if (entries.length === 0) {
    return {};
  }

  // Find first entry with context fields (usually the first user or system entry)
  for (const entry of entries) {
    const context: Partial<ClaudeRawEntry> = {};

    for (const field of CONTEXT_FIELDS) {
      if (field in entry && entry[field] !== undefined) {
        context[field] = entry[field];
      }
    }

    // If we found at least one context field, return it
    if (Object.keys(context).length > 0) {
      return context;
    }
  }

  return {};
}

export async function loadSystemEntries(filePath: string, contextFields?: Partial<ClaudeRawEntry>): Promise<ClaudeRawEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in system file: ${filePath}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`System file must contain a JSON array: ${filePath}`);
  }

  if (parsed.length === 0) {
    return [];
  }

  const entries: ClaudeRawEntry[] = [];

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Invalid entry in system file: ${filePath}`);
    }

    const entry = { ...item } as SystemEntryInput;

    // Merge context fields from actual session (override system file values)
    if (contextFields) {
      for (const field of CONTEXT_FIELDS) {
        if (field in contextFields) {
          (entry as any)[field] = contextFields[field];
        }
      }
    }

    // Augment with uuid if missing
    if (!entry.uuid) {
      entry.uuid = crypto.randomUUID();
    }

    // Ensure type is set
    if (!entry.type) {
      entry.type = 'system';
    }

    entries.push(entry as ClaudeRawEntry);
  }

  return entries;
}

function parseJSONL(line: string): ClaudeRawEntry | null {
  try {
    return JSON.parse(line) as ClaudeRawEntry;
  } catch {
    return null;
  }
}

function getDisplayContent(entry: ClaudeRawEntry): string | undefined {
  if (entry.type === 'user' || entry.type === 'assistant') {
    const content = entry.message?.content;
    if (typeof content === 'string') {
      // Extract command if present
      const commandMatch = content.match(/<command-name>(\/[^<]+)<\/command-name>/);
      if (commandMatch) {
        const argsMatch = content.match(/<command-args>([^<]*)<\/command-args>/);
        const args = argsMatch ? argsMatch[1].trim() : '';
        return `${commandMatch[1]}${args ? ' ' + args.substring(0, 50) + (args.length > 50 ? '...' : '') : ''}`;
      }
      // Return first 100 chars of content
      return content.substring(0, 100) + (content.length > 100 ? '...' : '');
    }
    if (Array.isArray(content)) {
      // Find text content or tool_result content
      const textItem = content.find((item: any) => item.type === 'text');
      if (textItem?.text) {
        return textItem.text.substring(0, 100) + (textItem.text.length > 100 ? '...' : '');
      }
      const toolResultItem = content.find((item: any) => item.type === 'tool_result');
      if (toolResultItem?.content) {
        const contentStr = String(toolResultItem.content);
        return contentStr.substring(0, 100) + (contentStr.length > 100 ? '...' : '');
      }
    }
  }
  return undefined;
}

export async function readSessionFile(filePath: string): Promise<ClaudeRawEntry[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const entries: ClaudeRawEntry[] = [];

  for (const line of lines) {
    const parsed = parseJSONL(line);
    if (parsed) {
      entries.push(parsed);
    }
  }
  return entries;
}

/**
 * Check if a user message is a tool result (should not start a new round)
 */
function isToolResult(entry: ClaudeRawEntry): boolean {
  if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
    // Check if the content contains tool_result items
    return entry.message.content.some((item: any) => item.type === 'tool_result');
  }
  return false;
}

/**
 * Check if a user message is an interrupt/interruption message
 * These have content like "[Request interrupted by user for tool use]"
 */
function isInterruptMessage(entry: ClaudeRawEntry): boolean {
  if (entry.type === 'user' && Array.isArray(entry.message?.content)) {
    const textItem = entry.message.content.find((item: any) => item.type === 'text');
    if (textItem?.text) {
      return textItem.text.includes('[Request interrupted by user');
    }
  }
  return false;
}

/**
 * Extract rounds from session entries based on parentUuid chain.
 *
 * A "round" starts when:
 * - A user message is NOT a tool_result (not system-generated)
 * - A user message is NOT isMeta (not command metadata)
 * - A user message is NOT an interrupt (not "[Request interrupted by user]")
 * - The parentUuid chain eventually leads to null or an assistant
 *
 * This handles cases where user messages have parentUuid pointing to other user messages
 * (like interrupts), but they still represent a new round/interaction.
 */
export function extractRounds(entries: ClaudeRawEntry[]): Round[] {
  const rounds: Round[] = [];

  // Build a map of uuid -> message type for quick lookup
  const uuidToType = new Map<string, string>();
  const uuidToParent = new Map<string, string | null>();

  for (const entry of entries) {
    if (entry.uuid) {
      uuidToType.set(entry.uuid, entry.type);
      uuidToParent.set(entry.uuid, entry.parentUuid ?? null);
    }
  }

  // Find the ultimate parent type by walking up the parentUuid chain
  function getUltimateParentType(uuid: string | null): string | null {
    if (!uuid) return null;
    let currentUuid: string | null = uuid;
    let visited = new Set<string>();
    let steps = 0;
    const maxSteps = 100; // Prevent infinite loops

    while (currentUuid && steps < maxSteps) {
      if (visited.has(currentUuid)) break; // Circular reference
      visited.add(currentUuid);

      const type = uuidToType.get(currentUuid);
      if (type === 'assistant' || type === 'system') {
        return type;
      }

      currentUuid = uuidToParent.get(currentUuid) ?? null;
      steps++;
    }
    return null; // Reached root without finding assistant/system
  }

  let currentRoundEntries: RoundEntry[] = [];
  let roundNumber = 0;
  let lastAssistantUuid: string | null = null;

  for (const entry of entries) {
    const uuid = entry.uuid || crypto.randomUUID();
    const parentUuid = entry.parentUuid ?? null;
    const timestamp = entry.timestamp || new Date().toISOString();

    const roundEntry: RoundEntry = {
      type: entry.type,
      uuid,
      parentUuid,
      timestamp,
      rawContent: JSON.stringify(entry),
      displayContent: getDisplayContent(entry),
    };

    // Check if this user message starts a new round
    // Exclude tool results, interrupt messages, and meta messages
    const ultimateParentType = getUltimateParentType(parentUuid);
    const isNewRoundStart = entry.type === 'user' && !entry.isMeta && !isToolResult(entry) && !isInterruptMessage(entry);

    if (isNewRoundStart) {
      // Save previous round if exists
      if (currentRoundEntries.length > 0) {
        rounds.push(createRound(roundNumber, currentRoundEntries));
        roundNumber++;
      }
      currentRoundEntries = [roundEntry];
      lastAssistantUuid = null;
    } else if (currentRoundEntries.length > 0) {
      // Add to current round
      currentRoundEntries.push(roundEntry);
      if (entry.type === 'assistant') {
        lastAssistantUuid = uuid;
      }
    } else {
      // Entries before first user message (summaries, etc.)
      currentRoundEntries.push(roundEntry);
    }
  }

  // Don't forget the last round
  if (currentRoundEntries.length > 0) {
    rounds.push(createRound(roundNumber, currentRoundEntries));
  }

  return rounds;
}

function createRound(roundNumber: number, entries: RoundEntry[]): Round {
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  // Find the first meaningful user message for summary
  let summaryEntry = firstEntry;
  for (const entry of entries) {
    if (entry.type === 'user' && entry.displayContent && !entry.displayContent.startsWith('[')) {
      summaryEntry = entry;
      break;
    }
  }

  const summary = summaryEntry.displayContent || `Round ${roundNumber}`;

  return {
    roundNumber,
    startUuid: firstEntry.uuid,
    startTimestamp: firstEntry.timestamp,
    endTimestamp: lastEntry.timestamp,
    entries,
    summary,
  };
}

export function listRounds(rounds: Round[], filePath: string): RoundListOutput {
  return {
    filePath,
    totalRounds: rounds.length,
    rounds: rounds.map((r) => ({
      number: r.roundNumber,
      summary: r.summary,
      entryCount: r.entries.length,
      startTimestamp: r.startTimestamp,
    })),
  };
}

export function extractRound(rounds: Round[], roundNumber: number, systemEntries?: ClaudeRawEntry[]): string | null {
  const round = rounds.find((r) => r.roundNumber === roundNumber);
  if (!round) {
    return null;
  }
  const lines: string[] = [];

  // Prepend system entries
  if (systemEntries && systemEntries.length > 0) {
    for (const entry of systemEntries) {
      lines.push(JSON.stringify(entry));
    }
  }

  // Add round entries
  for (const e of round.entries) {
    lines.push(e.rawContent);
  }

  return lines.join('\n');
}

export function prependSystemEntries(rounds: Round[], systemEntries: ClaudeRawEntry[]): Round[] {
  if (systemEntries.length === 0) {
    return rounds;
  }

  return rounds.map((round) => {
    const systemRoundEntries: RoundEntry[] = systemEntries.map((entry) => {
      let displayContent: string | undefined;
      const content = entry.message?.content;
      if (typeof content === 'string') {
        displayContent = content.substring(0, 100);
      } else if (Array.isArray(content)) {
        const textItem = content.find((item: any) => item.type === 'text');
        if (textItem?.text) {
          displayContent = textItem.text.substring(0, 100);
        }
      }

      return {
        type: entry.type,
        uuid: entry.uuid || crypto.randomUUID(),
        parentUuid: null,
        timestamp: entry.timestamp || new Date().toISOString(),
        rawContent: JSON.stringify(entry),
        displayContent,
      };
    });

    return {
      ...round,
      entries: [...systemRoundEntries, ...round.entries],
    };
  });
}

/**
 * Check if entries contain thinking metadata
 * Only returns true if any message content has a non-empty "thinking" field
 */
export function hasThinking(entries: ClaudeRawEntry[]): boolean {
  for (const entry of entries) {
    // Check message content for "thinking" field
    const content = entry.message?.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'object' && item !== null && 'thinking' in item) {
          const thinkingValue = (item as any).thinking;
          if (thinkingValue && typeof thinkingValue === 'string' && thinkingValue.trim() !== '') {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Extract rounds that contain thinking from a list of rounds
 */
export function extractRoundsWithThinking(rounds: Round[]): Round[] {
  return rounds.filter((round) => {
    // Check if any entry in this round has thinking
    for (const entry of round.entries) {
      const parsedEntry = JSON.parse(entry.rawContent) as ClaudeRawEntry;
      const content = parsedEntry.message?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (typeof item === 'object' && item !== null && 'thinking' in item) {
            const thinkingValue = (item as any).thinking;
            if (thinkingValue && typeof thinkingValue === 'string' && thinkingValue.trim() !== '') {
              return true;
            }
          }
        }
      }
    }
    return false;
  });
}
