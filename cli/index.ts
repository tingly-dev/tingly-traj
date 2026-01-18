#!/usr/bin/env node
// CLI for extracting and rendering rounds from Claude Code session data
import { readSessionFile, extractRounds, listRounds, extractRound, prependSystemEntries, loadSystemEntries, extractContextFields } from './round-extractor.ts';
import { renderFileToHtml } from './html-renderer.ts';
import type { RoundListOutput, Round } from './types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const USAGE = `
Usage: tingly-traj-cli <command> [options]

Commands:
  list <file>                    List all rounds in a session file
  extract <file> [options]       Extract rounds
  render <rounds.json> [options] Render a .json file to a single HTML
  render-all <dir> [options]     Scan dir for .json files and batch render
  help                           Show this help message

Options for extract:
  -o, --output <dir>             Output directory (default: ./output)
  -r, --round <num>              Extract specific round to stdout
  -k, --keyword <keyword>        Extract rounds matching keyword
  -s, --system <file>            Prepend system entries from JSON file
  --render                       Auto-render extracted rounds to HTML

Options for render/render-all:
  -o, --output <dir>             Output directory (default: ./output)
  --theme <theme>                Theme: light or dark (default: light)

Examples:
  # List all rounds
  pnpm cli list traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl

  # Extract all rounds to tb-bugfix-ci.json
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -o ./output

  # Extract a specific round (to stdout)
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -r 0 > round-0.jsonl

  # Extract rounds by keyword (filename uses round range)
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -k "bugfix" -o ./output

  # Extract with system prompt prepended
  pnpm cli extract session.jsonl -s system.json -o ./output

  # Extract and auto-render to HTML
  pnpm cli extract session.jsonl --render --theme dark -o ./output

  # Render a single .json file to HTML
  pnpm cli render ./output/tb-bugfix-ci.json -o ./html --theme dark

  # Batch render all .json files in a directory
  pnpm cli render-all ./output -o ./html --theme dark
`;

function printRoundList(output: RoundListOutput): void {
  console.log(`\n📁 File: ${output.filePath}`);
  console.log(`📊 Total rounds: ${output.totalRounds}\n`);
  console.log('─'.repeat(80));

  for (const round of output.rounds) {
    const date = new Date(round.startTimestamp).toLocaleString();
    console.log(`\n  Round #${round.number}`);
    console.log(`  📅 ${date}`);
    console.log(`  📝 ${round.summary}`);
    console.log(`  📦 Entries: ${round.entryCount}`);
  }
  console.log('\n' + '─'.repeat(80));
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];

  // Common option parsing
  const parseOutputOptions = (argsRest: string[]) => {
    let outputDir = './output';
    let theme: 'light' | 'dark' = 'light';

    for (let i = 0; i < argsRest.length; i++) {
      if (argsRest[i] === '-o' || argsRest[i] === '--output') {
        if (i + 1 < argsRest.length) {
          outputDir = argsRest[i + 1];
          i++;
        } else {
          console.error('❌ Error: --output requires a path');
          process.exit(1);
        }
      } else if (argsRest[i] === '--theme') {
        if (i + 1 < argsRest.length) {
          const t = argsRest[i + 1];
          if (t === 'light' || t === 'dark') {
            theme = t;
          } else {
            console.error('❌ Error: --theme must be "light" or "dark"');
            process.exit(1);
          }
          i++;
        }
      }
    }

    return { outputDir, theme };
  };

  // Extract options parsing
  const parseExtractOptions = (argsRest: string[]) => {
    let outputDir = './output';
    let roundNum: number | null = null;
    let keyword: string | null = null;
    let systemFile: string | null = null;
    let render = false;
    let theme: 'light' | 'dark' = 'light';

    for (let i = 0; i < argsRest.length; i++) {
      if (argsRest[i] === '-o' || argsRest[i] === '--output') {
        if (i + 1 < argsRest.length) {
          outputDir = argsRest[i + 1];
          i++;
        } else {
          console.error('❌ Error: --output requires a path');
          process.exit(1);
        }
      } else if (argsRest[i] === '-r' || argsRest[i] === '--round') {
        if (i + 1 < argsRest.length) {
          const num = parseInt(argsRest[i + 1], 10);
          if (isNaN(num) || num < 0) {
            console.error('❌ Error: --round requires a non-negative integer');
            process.exit(1);
          }
          roundNum = num;
          i++;
        } else {
          console.error('❌ Error: --round requires a number');
          process.exit(1);
        }
      } else if (argsRest[i] === '-k' || argsRest[i] === '--keyword') {
        if (i + 1 < argsRest.length) {
          keyword = argsRest[i + 1];
          i++;
        } else {
          console.error('❌ Error: --keyword requires a string');
          process.exit(1);
        }
      } else if (argsRest[i] === '-s' || argsRest[i] === '--system') {
        if (i + 1 < argsRest.length) {
          systemFile = argsRest[i + 1];
          i++;
        } else {
          console.error('❌ Error: --system requires a file path');
          process.exit(1);
        }
      } else if (argsRest[i] === '--render') {
        render = true;
      } else if (argsRest[i] === '--theme') {
        if (i + 1 < argsRest.length) {
          const t = argsRest[i + 1];
          if (t === 'light' || t === 'dark') {
            theme = t;
          } else {
            console.error('❌ Error: --theme must be "light" or "dark"');
            process.exit(1);
          }
          i++;
        }
      }
    }

    return { outputDir, roundNum, keyword, systemFile, render, theme };
  };

  if (command === 'list') {
    if (args.length < 2) {
      console.error('❌ Error: File path required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    try {
      const entries = await readSessionFile(filePath);
      const rounds = extractRounds(entries);
      const output = listRounds(rounds, filePath);
      printRoundList(output);
    } catch (error) {
      console.error(`❌ Error reading file: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'extract') {
    if (args.length < 2) {
      console.error('❌ Error: File path required');
      console.log(USAGE);
      process.exit(1);
    }

    const filePath = args[1];
    const { outputDir, roundNum, keyword, systemFile, render, theme } = parseExtractOptions(args.slice(2));

    try {
      // Read session file first to extract context fields
      const entries = await readSessionFile(filePath);
      const contextFields = extractContextFields(entries);

      // Load system entries if provided, merging with context from actual session
      let systemEntries: any[] = [];
      if (systemFile) {
        try {
          systemEntries = await loadSystemEntries(systemFile, contextFields);
          if (systemEntries.length > 0) {
            console.log(`📋 Loaded ${systemEntries.length} system entr${systemEntries.length === 1 ? 'y' : 'ies'} from: ${systemFile}`);
            if (Object.keys(contextFields).length > 0) {
              console.log(`   Merged context fields: ${Object.keys(contextFields).join(', ')}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error loading system file: ${(error as Error).message}`);
          process.exit(1);
        }
      }

      let allRounds = extractRounds(entries);

      if (allRounds.length === 0) {
        console.log('⚠️  No rounds found in file');
        process.exit(0);
      }

      // Prepend system entries to all rounds if provided
      if (systemEntries.length > 0) {
        allRounds = prependSystemEntries(allRounds, systemEntries);
      }

      // Extract specific round (output to stdout)
      if (roundNum !== null) {
        // Don't pass systemEntries here since they're already prepended to allRounds
        const content = extractRound(allRounds, roundNum);
        if (content === null) {
          console.error(`❌ Error: Round ${roundNum} not found. Total rounds: ${allRounds.length}`);
          process.exit(1);
        }
        console.log(content);
        process.exit(0);
      }

      // Keyword search
      if (keyword !== null) {
        const matchedRounds = allRounds.filter(r =>
          r.summary.toLowerCase().includes(keyword.toLowerCase())
        );

        if (matchedRounds.length === 0) {
          console.log(`⚠️  No rounds found matching keyword: "${keyword}"`);
          process.exit(0);
        }

        await ensureDir(outputDir);

        const basename = path.basename(filePath, '.jsonl');
        // Use numeric suffix in filename (e.g., tb-bugfix-ci.0.json or tb-bugfix-ci.0-3.json)
        const firstRound = matchedRounds[0].roundNumber;
        const lastRound = matchedRounds[matchedRounds.length - 1].roundNumber;
        const filename = matchedRounds.length === 1
          ? `${basename}.${firstRound}.json`
          : `${basename}.${firstRound}-${lastRound}.json`;
        const outputPath = path.join(outputDir, filename);
        await fs.writeFile(outputPath, JSON.stringify(matchedRounds, null, 2), 'utf-8');

        console.log(`\n✅ Found ${matchedRounds.length} rounds matching "${keyword}"`);
        console.log(`   Extracted to: ${outputPath}\n`);
        for (const round of matchedRounds) {
          console.log(`  Round #${round.roundNumber}: ${round.summary.substring(0, 60)}${round.summary.length > 60 ? '...' : ''}`);
        }
        console.log('');

        // Auto-render if requested
        if (render) {
          const htmlOutputDir = path.join(outputDir, 'html');
          await ensureDir(htmlOutputDir);

          console.log(`\n📁 Rendering ${matchedRounds.length} rounds to HTML`);
          console.log(`   Output: ${htmlOutputDir} (${theme} theme)`);

          const html = renderFileToHtml(matchedRounds, outputPath, { theme });
          const htmlFilename = path.basename(filename, '.json');
          const htmlPath = path.join(htmlOutputDir, `${htmlFilename}.html`);
          await fs.writeFile(htmlPath, html, 'utf-8');

          console.log(`\n✅ Rendered to: ${htmlPath}\n`);
        }
        process.exit(0);
      }

      // Default: extract all rounds
      await ensureDir(outputDir);

      const basename = path.basename(filePath, '.jsonl');
      const outputPath = path.join(outputDir, `${basename}.json`);
      await fs.writeFile(outputPath, JSON.stringify(allRounds, null, 2), 'utf-8');

      console.log(`\n✅ Extracted ${allRounds.length} rounds to: ${outputPath}\n`);
      for (const round of allRounds) {
        console.log(`  Round #${round.roundNumber}: ${round.summary.substring(0, 60)}${round.summary.length > 60 ? '...' : ''}`);
      }
      console.log('');

      // Auto-render if requested
      if (render) {
        const htmlOutputDir = path.join(outputDir, 'html');
        await ensureDir(htmlOutputDir);

        console.log(`\n📁 Rendering ${allRounds.length} rounds to HTML`);
        console.log(`   Output: ${htmlOutputDir} (${theme} theme)`);

        const html = renderFileToHtml(allRounds, outputPath, { theme });
        const htmlPath = path.join(htmlOutputDir, `${basename}.html`);
        await fs.writeFile(htmlPath, html, 'utf-8');

        console.log(`\n✅ Rendered to: ${htmlPath}\n`);
      }
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'render') {
    if (args.length < 2) {
      console.error('❌ Error: rounds.json file path required');
      console.log(USAGE);
      process.exit(1);
    }

    const roundsJsonPath = args[1];
    const { outputDir, theme } = parseOutputOptions(args.slice(2));

    try {
      await ensureDir(outputDir);

      // Read rounds from JSON file
      const jsonContent = await fs.readFile(roundsJsonPath, 'utf-8');
      const rounds = JSON.parse(jsonContent) as Round[];

      if (rounds.length === 0) {
        console.log('⚠️  No rounds found in file');
        process.exit(0);
      }

      console.log(`\n📁 Rendering ${rounds.length} rounds to HTML`);
      console.log(`   Input: ${roundsJsonPath}`);
      console.log(`   Output: ${outputDir} (${theme} theme)`);

      // Render all rounds to a single HTML file
      const html = renderFileToHtml(rounds, roundsJsonPath, { theme });
      const basename = path.basename(roundsJsonPath, '.json');
      const outputPath = path.join(outputDir, `${basename}.html`);
      await fs.writeFile(outputPath, html, 'utf-8');

      console.log(`\n✅ Rendered to: ${outputPath}\n`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else if (command === 'render-all') {
    if (args.length < 2) {
      console.error('❌ Error: Directory path required');
      console.log(USAGE);
      process.exit(1);
    }

    const inputDir = args[1];
    const { outputDir, theme } = parseOutputOptions(args.slice(2));

    try {
      await ensureDir(outputDir);

      // Scan directory for .json files
      const files = await fs.readdir(inputDir);
      const roundsJsonFiles = files.filter(f => f.endsWith('.json'));

      if (roundsJsonFiles.length === 0) {
        console.log('⚠️  No .json files found in directory');
        process.exit(0);
      }

      console.log(`\n📁 Found ${roundsJsonFiles.length} .json files`);
      console.log(`   Input: ${inputDir}`);
      console.log(`   Output: ${outputDir} (${theme} theme)`);
      console.log('─'.repeat(80));

      let successCount = 0;
      for (const file of roundsJsonFiles) {
        const jsonPath = path.join(inputDir, file);
        try {
          // Read rounds from JSON file
          const jsonContent = await fs.readFile(jsonPath, 'utf-8');
          const rounds = JSON.parse(jsonContent) as Round[];

          if (rounds.length === 0) {
            console.log(`  ⚠️  ${file}: No rounds found, skipping`);
            continue;
          }

          // Render all rounds to a single HTML file
          const html = renderFileToHtml(rounds, jsonPath, { theme });
          const basename = path.basename(file, '.json');
          const outputPath = path.join(outputDir, `${basename}.html`);
          await fs.writeFile(outputPath, html, 'utf-8');
          successCount++;
          console.log(`  ✅ ${file} → ${basename}.html (${rounds.length} rounds)`);
        } catch (error) {
          console.log(`  ❌ ${file}: ${(error as Error).message}`);
        }
      }

      console.log('─'.repeat(80));
      console.log(`\n✅ Successfully rendered ${successCount}/${roundsJsonFiles.length} files\n`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  } else {
    console.error(`❌ Unknown command: ${command}`);
    console.log(USAGE);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
