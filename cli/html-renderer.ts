// HTML renderer for Claude Code rounds
import type { Round, ClaudeRawEntry } from './types.ts';
import * as path from 'node:path';

interface RenderOptions {
  title?: string;
  theme?: 'light' | 'dark';
  sourceFile?: string;
}

interface GroupedEntry {
  id: string | null;
  entries: ClaudeRawEntry[];
  firstEntry: ClaudeRawEntry;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Check if a user message is a tool result (system-generated, not actual user input)
 */
function isToolResultUserEntry(entry: ClaudeRawEntry): boolean {
  if (entry.type === 'user' && entry.message && typeof entry.message === 'object') {
    const content = (entry.message as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      return content.some((item: unknown) =>
        typeof item === 'object' && item !== null && (item as Record<string, unknown>).type === 'tool_result'
      );
    }
  }
  return false;
}

/**
 * Group entries by message.id
 */
function groupEntriesById(entries: { rawContent: string }[]): GroupedEntry[] {
  const grouped = new Map<string | null, GroupedEntry>();

  for (const roundEntry of entries) {
    const parsed = JSON.parse(roundEntry.rawContent) as ClaudeRawEntry;
    // Handle message.id which may be undefined, fall back to uuid
    const messageId: string | null = (parsed.message && typeof parsed.message === 'object' && 'id' in parsed.message)
      ? ((parsed.message.id as string | undefined) ?? parsed.uuid ?? null)
      : (parsed.uuid ?? null);

    if (!grouped.has(messageId)) {
      grouped.set(messageId, {
        id: messageId,
        entries: [],
        firstEntry: parsed,
      });
    }

    grouped.get(messageId)!.entries.push(parsed);
  }

  // Convert map to array, preserving order
  const result: GroupedEntry[] = [];
  const seenIds = new Set<string | null>();

  for (const roundEntry of entries) {
    const parsed = JSON.parse(roundEntry.rawContent) as ClaudeRawEntry;
    const messageId: string | null = (parsed.message && typeof parsed.message === 'object' && 'id' in parsed.message)
      ? ((parsed.message.id as string | undefined) ?? parsed.uuid ?? null)
      : (parsed.uuid ?? null);

    if (!seenIds.has(messageId)) {
      seenIds.add(messageId);
      result.push(grouped.get(messageId)!);
    }
  }

  return result;
}

/**
 * Format text content with basic markdown-like styling
 */
function formatTextContent(text: string): string {
  // Escape first
  let formatted = escapeHtml(text);

  // Basic code blocks
  formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  return `<div class="text-content">${formatted}</div>`;
}

/**
 * Get message type icon and label
 */
function getMessageTypeInfo(type: string): { icon: string; label: string; class: string } {
  const types: Record<string, { icon: string; label: string; class: string }> = {
    user: { icon: '👤', label: 'User', class: 'user-message' },
    assistant: { icon: '🤖', label: 'Assistant', class: 'assistant-message' },
    system: { icon: '⚙️', label: 'System', class: 'system-message' },
    summary: { icon: '📋', label: 'Summary', class: 'summary-message' },
    'file-history-snapshot': { icon: '📸', label: 'Snapshot', class: 'snapshot-message' },
    'queue-operation': { icon: '🔄', label: 'Queue', class: 'queue-message' },
  };
  return types[type] || { icon: '📨', label: type, class: 'unknown-message' };
}

/**
 * Check if a grouped entry is effectively empty (no meaningful content)
 */
function isEmptyEntry(grouped: GroupedEntry): boolean {
  const content = grouped.firstEntry.message?.content;

  // No content at all
  if (!content) return true;

  // String content - check if empty or only whitespace
  if (typeof content === 'string') {
    return !content.trim();
  }

  // Array content - check if all items are empty
  if (Array.isArray(content)) {
    for (const item of content as Array<Record<string, unknown>>) {
      const itemType = item.type as string;
      if (itemType === 'text') {
        if ((item.text as string)?.trim()) return false;
      } else if (itemType === 'tool_use') {
        // tool_use with input is not empty
        const toolInput = item.input;
        if (toolInput && typeof toolInput === 'object' && Object.keys(toolInput).length > 0) {
          return false;
        }
      } else if (itemType === 'tool_result') {
        // tool_result with content is not empty
        if (item.content) return false;
      } else if (itemType === 'thinking') {
        if ((item.text as string)?.trim()) return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Generate HTML for a grouped entry (combines multiple entries with same message.id)
 */
function renderGroupedEntry(grouped: GroupedEntry): string {
  const firstEntry = grouped.firstEntry;

  // Skip empty system entries
  if (firstEntry.type === 'system' && isEmptyEntry(grouped)) {
    return '';
  }

  const typeInfo = getMessageTypeInfo(firstEntry.type);

  // Use timestamp from first entry and uuid from first entry
  const timestamp = firstEntry.timestamp ? new Date(firstEntry.timestamp).toLocaleString() : '';
  const uuid = firstEntry.uuid ? `<span class="uuid" title="${escapeHtml(firstEntry.uuid)}">${firstEntry.uuid.substring(0, 8)}...</span>` : '';

  // Combine all content from entries with same id
  let combinedContent = '<div class="content-array">';

  for (const entry of grouped.entries) {
    const content = entry.message?.content;
    if (!content) continue;

    if (typeof content === 'string') {
      // Handle string content - display as-is with HTML escaping
      combinedContent += `<pre class="content-text">${escapeHtml(content)}</pre>`;
    } else if (Array.isArray(content)) {
      for (const item of content as Array<Record<string, unknown>>) {
        const itemType = item.type as string;

        if (itemType === 'text') {
          combinedContent += `<div class="content-item text">${formatTextContent((item.text as string) || '')}</div>`;
        } else if (itemType === 'tool_use') {
          const toolName = (item.name as string) || 'unknown';
          const toolInput = item.input;
          const hasInput = toolInput && typeof toolInput === 'object' && Object.keys(toolInput).length > 0;

          combinedContent += `<div class="content-item tool-use">
            <span class="tool-badge">🔧 Tool Use</span>
            <span class="tool-name">${escapeHtml(toolName)}</span>
            ${hasInput ? `<pre class="tool-input-content">${escapeHtml(JSON.stringify(toolInput, null, 2))}</pre>` : ''}
          </div>`;
        } else if (itemType === 'tool_result') {
          const isError = (item.is_error as boolean) || false;
          const resultContent = item.content || '';
          combinedContent += `<div class="content-item tool-result ${isError ? 'error' : ''}">
            <span class="tool-badge">${isError ? '❌' : '✅'} Tool Result</span>
            ${item.tool_use_id ? `<span class="tool-id">${escapeHtml(item.tool_use_id as string)}</span>` : ''}
            <pre class="result-content">${escapeHtml(String(resultContent))}</pre>
          </div>`;
        } else if (itemType === 'thinking') {
          const thinkingText = (item.text as string) || '';
          if (thinkingText.trim()) {
            combinedContent += `<details class="content-item thinking" open>
              <summary>💭 Thinking</summary>
              <pre class="thinking-content">${escapeHtml(thinkingText)}</pre>
            </details>`;
          }
        } else {
          combinedContent += `<div class="content-item unknown">
            <span class="item-type">${escapeHtml(itemType)}</span>
          </div>`;
        }
      }
    }
  }

  combinedContent += '</div>';

  return `
    <div class="entry ${typeInfo.class}">
      <div class="entry-header">
        <span class="entry-icon">${typeInfo.icon}</span>
        <span class="entry-type">${typeInfo.label}</span>
        <span class="entry-meta">
          ${uuid}
          ${timestamp ? `<span class="timestamp">${timestamp}</span>` : ''}
          ${grouped.entries.length > 1 ? `<span class="group-info">${grouped.entries.length} parts</span>` : ''}
        </span>
      </div>
      <div class="entry-content">
        ${combinedContent}
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a complete round
 */
export function renderRoundToHtml(round: Round, options: RenderOptions = {}): string {
  const fileBasename = options.sourceFile ? path.basename(options.sourceFile, '.jsonl') : 'Unknown';
  const { title = `${fileBasename} - Round #${round.roundNumber}`, theme = 'light' } = options;

  // Group entries by message.id
  const groupedEntries = groupEntriesById(round.entries);

  // Render grouped entries
  const entriesHtml = groupedEntries.map(g => renderGroupedEntry(g)).filter(html => html).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Claude Code Session</title>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f7fa;
      --bg-entry: #f8f9fa;
      --text-primary: #1a1a1a;
      --text-secondary: #666666;
      --border-color: #e1e8ed;
      --accent-color: #2563eb;
      --user-bg: #e3f2fd;
      --assistant-bg: #f0f9ff;
      --system-bg: #fff3e0;
      --error-bg: #fee2e2;
      --success-bg: #dcfce7;
    }

    .dark-theme {
      --bg-primary: #1a1a1a;
      --bg-secondary: #2d2d2d;
      --bg-entry: #252525;
      --text-primary: #e5e5e5;
      --text-secondary: #a0a0a0;
      --border-color: #404040;
      --accent-color: #3b82f6;
      --user-bg: #1e3a5f;
      --assistant-bg: #0c4a6e;
      --system-bg: #3d2914;
      --error-bg: #3f1a1a;
      --success-bg: #1a3f1a;
    }

    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: var(--bg-secondary);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
    }

    .header h1 {
      margin: 0 0 10px 0;
      font-size: 1.8em;
    }

    .header .meta {
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    .brand {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .entry {
      background: var(--bg-entry);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }

    .entry-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9em;
    }

    .entry-icon { font-size: 1.2em; }
    .entry-type { font-weight: 600; }

    .entry-meta {
      margin-left: auto;
      display: flex;
      gap: 15px;
      color: var(--text-secondary);
      font-size: 0.85em;
    }

    .group-info {
      background: var(--accent-color);
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
    }

    .uuid {
      font-family: monospace;
      cursor: help;
    }

    .entry-content {
      padding: 16px;
    }

    .user-message { border-left: 4px solid #2563eb; }
    .assistant-message { border-left: 4px solid #0891c2; }
    .system-message { border-left: 4px solid #f59e0b; }

    .command {
      background: var(--user-bg);
      padding: 12px 16px;
      border-radius: 8px;
      display: inline-block;
    }

    .command-name {
      background: #2563eb;
      color: white;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-weight: 600;
    }

    .command-args {
      margin-left: 10px;
      color: var(--text-secondary);
    }

    .content-array {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .content-item {
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      border-left: 3px solid var(--border-color);
    }

    .tool-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
      margin-right: 8px;
    }

    .tool-use .tool-badge { background: #8b5cf6; color: white; }
    .tool-name {
      font-weight: 600;
      color: var(--accent-color);
    }

    .tool-input-content {
      margin: 10px 0 0 0;
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      font-size: 0.85em;
      overflow-x: auto;
      max-height: 250px;
      overflow-y: auto;
    }

    .tool-result { border-left-color: #10b981; }
    .tool-result.error { border-left-color: #ef4444; }
    .tool-result .tool-badge { background: #10b981; color: white; }
    .tool-result.error .tool-badge { background: #ef4444; color: white; }

    .result-content {
      margin: 10px 0 0 0;
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      font-size: 0.9em;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }

    .thinking {
      border-left-color: #a855f7;
    }

    .thinking summary {
      cursor: pointer;
      font-weight: 600;
      color: #a855f7;
    }

    .thinking-content {
      margin: 10px 0 0 0;
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      font-size: 0.9em;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .summary {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--system-bg);
      border-radius: 8px;
    }

    pre, code {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.9em;
    }

    .content-text, .content-json {
      margin: 0;
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
    }

    .text-content {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .text-content pre {
      background: var(--bg-primary);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }

    .queue-message {
      opacity: 0.7;
      font-size: 0.9em;
    }

    .no-content {
      color: var(--text-secondary);
      font-style: italic;
    }
  </style>
</head>
<body class="${theme === 'dark' ? 'dark-theme' : ''}">
  <div class="container">
    <div class="header">
      <span class="brand">Tingly Traj</span>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span>📦 ${round.entries.length} entries</span>
        <span>🕐 ${new Date(round.startTimestamp).toLocaleString()} - ${new Date(round.endTimestamp).toLocaleString()}</span>
      </div>
      <div class="meta" style="margin-top: 10px;">
        <strong>Instruction:</strong> ${escapeHtml(round.summary)}
      </div>
    </div>

    <div class="entries">
      ${entriesHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML filename for a round
 */
export function getHtmlFilename(sourceFile: string, roundId: number): string {
  const basename = path.basename(sourceFile, '.jsonl');
  return `${basename}-${roundId}.html`;
}

/**
 * Generate HTML filename for a complete file
 */
export function getFileHtmlFilename(sourceFile: string): string {
  const basename = path.basename(sourceFile, '.jsonl');
  return `${basename}.html`;
}

/**
 * Generate HTML for all rounds in a file
 */
export function renderFileToHtml(rounds: Round[], sourceFile: string, options: RenderOptions = {}): string {
  const fileBasename = path.basename(sourceFile, '.jsonl');
  const { theme = 'light' } = options;
  const title = `Tingly Traj - ${fileBasename}`;

  // Render all rounds
  const roundsHtml = rounds.map((round) => {
    const groupedEntries = groupEntriesById(round.entries);
    const entriesHtml = groupedEntries.map(g => renderGroupedEntry(g)).filter(html => html).join('\n');

    return `
    <div class="round" id="round-${round.roundNumber}">
      <div class="round-header">
        <h2>Round #${round.roundNumber}</h2>
        <div class="round-meta">
          <span>📦 ${round.entries.length} entries</span>
          <span>🕐 ${new Date(round.startTimestamp).toLocaleString()} - ${new Date(round.endTimestamp).toLocaleString()}</span>
        </div>
        <div class="round-summary">
          <strong>Instruction:</strong> ${escapeHtml(round.summary)}
        </div>
      </div>
      <div class="entries">
        ${entriesHtml}
      </div>
    </div>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f7fa;
      --bg-entry: #f8f9fa;
      --text-primary: #1a1a1a;
      --text-secondary: #666666;
      --border-color: #e1e8ed;
      --accent-color: #2563eb;
      --user-bg: #e3f2fd;
      --assistant-bg: #f0f9ff;
      --system-bg: #fff3e0;
      --error-bg: #fee2e2;
      --success-bg: #dcfce7;
    }

    .dark-theme {
      --bg-primary: #1a1a1a;
      --bg-secondary: #2d2d2d;
      --bg-entry: #252525;
      --text-primary: #e5e5e5;
      --text-secondary: #a0a0a0;
      --border-color: #404040;
      --accent-color: #3b82f6;
      --user-bg: #1e3a5f;
      --assistant-bg: #0c4a6e;
      --system-bg: #3d2914;
      --error-bg: #3f1a1a;
      --success-bg: #1a3f1a;
    }

    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .page-header {
      background: var(--bg-secondary);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
    }

    .brand {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .page-header h1 {
      margin: 0 0 10px 0;
      font-size: 1.8em;
    }

    .page-header .meta {
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    .toc {
      background: var(--bg-secondary);
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
    }

    .toc h2 {
      margin: 0 0 15px 0;
      font-size: 1.2em;
    }

    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 10px;
    }

    .toc-item a {
      display: block;
      padding: 10px 15px;
      background: var(--bg-entry);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-primary);
      transition: background 0.2s;
    }

    .toc-item a:hover {
      background: var(--accent-color);
      color: white;
    }

    .round {
      margin-bottom: 40px;
      scroll-margin-top: 100px;
    }

    .round-header {
      background: var(--bg-secondary);
      padding: 20px 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      border: 1px solid var(--border-color);
    }

    .round-header h2 {
      margin: 0 0 10px 0;
      font-size: 1.5em;
    }

    .round-meta {
      color: var(--text-secondary);
      font-size: 0.9em;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }

    .round-summary {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--border-color);
      font-size: 0.9em;
    }

    .entry {
      background: var(--bg-entry);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }

    .entry-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9em;
    }

    .entry-icon { font-size: 1.2em; }
    .entry-type { font-weight: 600; }

    .entry-meta {
      margin-left: auto;
      display: flex;
      gap: 15px;
      color: var(--text-secondary);
      font-size: 0.85em;
    }

    .group-info {
      background: var(--accent-color);
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
    }

    .uuid {
      font-family: monospace;
      cursor: help;
    }

    .entry-content {
      padding: 16px;
    }

    .user-message { border-left: 4px solid #2563eb; }
    .assistant-message { border-left: 4px solid #0891c2; }
    .system-message { border-left: 4px solid #f59e0b; }

    .command {
      background: var(--user-bg);
      padding: 12px 16px;
      border-radius: 8px;
      display: inline-block;
    }

    .command-name {
      background: #2563eb;
      color: white;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-weight: 600;
    }

    .command-args {
      margin-left: 10px;
      color: var(--text-secondary);
    }

    .content-array {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .content-item {
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      border-left: 3px solid var(--border-color);
    }

    .tool-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 600;
      margin-right: 8px;
    }

    .tool-use .tool-badge { background: #8b5cf6; color: white; }
    .tool-name {
      font-weight: 600;
      color: var(--accent-color);
    }

    .tool-input-content {
      margin: 10px 0 0 0;
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      font-size: 0.85em;
      overflow-x: auto;
      max-height: 250px;
      overflow-y: auto;
    }

    .tool-result { border-left-color: #10b981; }
    .tool-result.error { border-left-color: #ef4444; }
    .tool-result .tool-badge { background: #10b981; color: white; }
    .tool-result.error .tool-badge { background: #ef4444; color: white; }

    .result-content {
      margin: 10px 0 0 0;
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      font-size: 0.9em;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }

    .thinking {
      border-left-color: #a855f7;
    }

    .thinking summary {
      cursor: pointer;
      font-weight: 600;
      color: #a855f7;
    }

    .thinking-content {
      margin: 10px 0 0 0;
      padding: 12px;
      background: var(--bg-primary);
      border-radius: 6px;
      font-size: 0.9em;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .summary {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--system-bg);
      border-radius: 8px;
    }

    pre, code {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.9em;
    }

    .content-text, .content-json {
      margin: 0;
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 300px;
      overflow-y: auto;
    }

    .text-content {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .text-content pre {
      background: var(--bg-primary);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }

    .queue-message {
      opacity: 0.7;
      font-size: 0.9em;
    }

    .no-content {
      color: var(--text-secondary);
      font-style: italic;
    }
  </style>
</head>
<body class="${theme === 'dark' ? 'dark-theme' : ''}">
  <div class="container">
    <div class="page-header">
      <span class="brand">Tingly Traj</span>
      <h1>${escapeHtml(fileBasename)}</h1>
      <div class="meta">
        <span>📊 ${rounds.length} rounds</span>
      </div>
    </div>

    <div class="toc">
      <h2>📑 Table of Contents</h2>
      <ul class="toc-list">
        ${rounds.map(round => `
          <li class="toc-item">
            <a href="#round-${round.roundNumber}">
              <strong>Round #${round.roundNumber}</strong><br>
              <small>${escapeHtml(round.summary.length > 80 ? round.summary.substring(0, 80) + '...' : round.summary)}</small>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>

    ${roundsHtml}
  </div>
</body>
</html>`;
}
