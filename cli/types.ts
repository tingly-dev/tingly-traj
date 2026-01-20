// Types for CLI round extraction

export interface ThinkingMetadata {
  level?: string;
  disabled?: boolean;
  triggers?: unknown[];
}

export interface ClaudeRawEntry {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text: string }>;
  };
  isMeta?: boolean;
  thinkingMetadata?: ThinkingMetadata;
  [key: string]: unknown;
}

export interface RoundEntry {
  type: string;
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  rawContent: string;
  displayContent?: string;
}

export interface Round {
  roundNumber: number;
  startUuid: string;
  startTimestamp: string;
  endTimestamp: string;
  entries: RoundEntry[];
  summary: string;
}

export interface RoundListOutput {
  filePath: string;
  totalRounds: number;
  rounds: Array<{
    number: number;
    summary: string;
    entryCount: number;
    startTimestamp: string;
  }>;
}
