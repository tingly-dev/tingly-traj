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

```bash
# See help for details
pnpm cli --help
```

### List all rounds

```bash
pnpm cli list path/to/cc-session.jsonl
```

### Extract rounds

```bash
# Extract all rounds → outputs: {basename}.json
pnpm cli extract path/to/cc-session.jsonl -o ./output

# Extract specific round → outputs to stdout
pnpm cli extract path/to/cc-session.jsonl -r 0 > round-0.jsonl

# Search by keyword → outputs: {basename}.{first}-{last}.json
pnpm cli extract path/to/cc-session.jsonl -k "bugfix" -o ./output

# Extract with system prompt prepended
pnpm cli extract session.jsonl -s system.json -o ./output

# Extract and auto-render to HTML
pnpm cli extract session.jsonl --render --theme dark -o ./output
# Or short
pnpm cli extract session.jsonl --render -o ./output
```

### Render HTML

```bash
# Render single file → outputs: {basename}.html (single page with TOC)
pnpm cli render ./output/cc-session.json -o ./html --theme dark

# Batch render directory → scans for .json/.jsonl files, renders each to HTML
pnpm cli batch-render ./output -o ./html --theme dark

# Batch render recursively (includes subdirectories)
pnpm cli batch-render ./data -o ./html -r --theme dark
```

## Project Structure

```
tingly-traj/
├── cli/          # CLI tool
├── server/       # Express server
├── src/          # React frontend
└── shared/       # Shared code
```
