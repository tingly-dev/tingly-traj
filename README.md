# Tingly Traj

Claude Code session trajectory management and visualization tool.

## Features

- **Web Service**: Full-stack app with Express + React
- **CLI Tool**: Extract, search, and render Claude Code session data
- **HTML Rendering**: Render session data as readable HTML pages

## Development

```bash
# Start dev environment (server + frontend)
pnpm dev
```

## Server Usage

The web server loads your local Claude Code data from `~/.claude/`:

- **History**: Reads `~/.claude/history.jsonl` for session list
- **Sessions**: Reads `~/.claude/projects/{project-path}/{session-id}.jsonl` for details

Once started via `pnpm dev`, access the web UI at `http://localhost:5173` to browse and search your Claude Code session history.

## CLI Usage

### List all rounds

```bash
pnpm cli list path/to/cc-session.jsonl
```

### Extract rounds

```bash
# Extract all rounds → outputs: {basename}-rounds.json
pnpm cli extract path/to/cc-session.jsonl -o ./output

# Extract specific round → outputs to stdout
pnpm cli extract path/to/cc-session.jsonl -r 0 > round-0.jsonl

# Search by keyword → outputs: {basename}-rounds-{first}-{last}.json
pnpm cli extract path/to/cc-session.jsonl -k "bugfix" -o ./output
```

### Render HTML

```bash
# Render single file → outputs: {basename}.html (single page with TOC)
pnpm cli render ./output/cc-session.jsonl -o ./html

# Batch render directory → scans for *-rounds.json, renders each to HTML
pnpm cli render-all ./output -o ./html --theme dark
```

## Project Structure

```
cc-pick/
├── cli/          # CLI tool
├── server/       # Express server
├── src/          # React frontend
└── shared/       # Shared code
```
