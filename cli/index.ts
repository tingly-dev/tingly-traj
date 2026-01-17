#!/usr/bin/env node
// CLI for extracting and rendering rounds from Claude Code session data
import { readSessionFile, extractRounds, listRounds, extractRound } from './round-extractor.ts';
import { renderFileToHtml } from './html-renderer.ts';
import type { RoundListOutput, Round } from './types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const USAGE = `
Usage: cc-pick-cli <command> [options]

Commands:
  list <file>                    List all rounds in a session file
  extract <file> [options]       Extract rounds
  render <rounds.json> [options] Render rounds.json to a single HTML
  render-all <dir> [options]     Scan dir for *-rounds.json and batch render
  help                           Show this help message

Options for extract:
  -o, --output <dir>             Output directory (default: ./output)
  -r, --round <num>              Extract specific round to stdout
  -k, --keyword <keyword>        Extract rounds matching keyword

Options for render/render-all:
  -o, --output <dir>             Output directory (default: ./output)
  --theme <theme>                Theme: light or dark (default: light)

Examples:
  # List all rounds
  pnpm cli list traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl

  # Extract all rounds to rounds.json
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -o ./output

  # Extract a specific round (to stdout)
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -r 0 > round-0.jsonl

  # Extract rounds by keyword (filename uses round range)
  pnpm cli extract traj-yz-cc-tb/tb-bugfix/tb-bugfix-ci.jsonl -k "bugfix" -o ./output

  # Render a single rounds.json to HTML
  pnpm cli render ./output/tb-bugfix-ci-rounds.json -o ./html --theme dark

  # Batch render all *-rounds.json in a directory
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
      }
    }

    return { outputDir, roundNum, keyword };
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
    const { outputDir, roundNum, keyword } = parseExtractOptions(args.slice(2));

    try {
      const entries = await readSessionFile(filePath);
      const allRounds = extractRounds(entries);

      if (allRounds.length === 0) {
        console.log('⚠️  No rounds found in file');
        process.exit(0);
      }

      // Extract specific round (output to stdout)
      if (roundNum !== null) {
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
        // Use round range in filename (e.g., tb-bugfix-ci-rounds-0-3.json)
        const firstRound = matchedRounds[0].roundNumber;
        const lastRound = matchedRounds[matchedRounds.length - 1].roundNumber;
        const filename = matchedRounds.length === 1
          ? `${basename}-round-${firstRound}.json`
          : `${basename}-rounds-${firstRound}-${lastRound}.json`;
        const outputPath = path.join(outputDir, filename);
        await fs.writeFile(outputPath, JSON.stringify(matchedRounds, null, 2), 'utf-8');

        console.log(`\n✅ Found ${matchedRounds.length} rounds matching "${keyword}"`);
        console.log(`   Extracted to: ${outputPath}\n`);
        for (const round of matchedRounds) {
          console.log(`  Round #${round.roundNumber}: ${round.summary.substring(0, 60)}${round.summary.length > 60 ? '...' : ''}`);
        }
        console.log('');
        process.exit(0);
      }

      // Default: extract all rounds
      await ensureDir(outputDir);

      const basename = path.basename(filePath, '.jsonl');
      const outputPath = path.join(outputDir, `${basename}-rounds.json`);
      await fs.writeFile(outputPath, JSON.stringify(allRounds, null, 2), 'utf-8');

      console.log(`\n✅ Extracted ${allRounds.length} rounds to: ${outputPath}\n`);
      for (const round of allRounds) {
        console.log(`  Round #${round.roundNumber}: ${round.summary.substring(0, 60)}${round.summary.length > 60 ? '...' : ''}`);
      }
      console.log('');
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

      // Scan directory for *-rounds.json files
      const files = await fs.readdir(inputDir);
      const roundsJsonFiles = files.filter(f => f.endsWith('-rounds.json'));

      if (roundsJsonFiles.length === 0) {
        console.log('⚠️  No *-rounds.json files found in directory');
        process.exit(0);
      }

      console.log(`\n📁 Found ${roundsJsonFiles.length} rounds.json files`);
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
