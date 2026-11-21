// Launch Radar v2's entrypoint (radar-3 model): one snapshot in, a ranked board, a dashboard, and
// a dossier out. Standard library only, no network at runtime, deterministic: two runs on the
// same snapshot write identical bytes.
//
// Usage: node main.ts <snapshot.json> <output-dir>
//        node main.ts <snapshot.json> <output-dir> --model <json>   (override model constants)
//        node main.ts <snapshot.json> <output-dir> --no-dossier    (staging run, before the
//                                                                     screenshots are taken)
//
// The dossier is built last from the output directory itself, with the vendored make.fun library,
// so what this program writes is byte for byte what the gate rebuilds. The page reads data.js,
// which this program writes from the same board, so the page, the board and the screenshots all
// show one set of numbers. The page also carries a model sandbox: sliders that recompute every
// row's implied value live from the snapshot figures. The sandbox never rewrites board.json —
// the submitted ranking is the radar-3 model's, fixed at build time.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, buildRadar, boardIssue, dataScript, parseSnapshot, MODEL, MODEL_VERSION } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier's bytes, the rest refuse. */
const TEXT_CAP = 65_536;
const SHOT_CAP = { max: 4, max_bytes: 524_288 };
const DASH_CAP = { max_files: 400, max_bytes: 4_194_304 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read a file as UTF-8, or fail with the path in the message. */
function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(`cannot read ${filePath}`);
  }
}

/** Write a file, making its directory first, and return its byte size. */
function writeFile(filePath: string, data: string | Buffer): number {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
  return Buffer.byteLength(data);
}

/** Copy a directory's regular files into `to`, skipping dot-names, and name what was copied. */
function copyDir(from: string, to: string): string[] {
  if (!fs.existsSync(from)) return [];
  fs.mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || !entry.isFile()) continue;
    fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
    names.push(entry.name);
  }
  return names;
}

/** The entrypoint's own usage text. */
function usage(): string {
  return 'Usage: node main.ts <snapshot.json> <output-dir> [--model <json>] [--no-dossier]\n';
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 2 || args[0] === '-h' || args[0] === '--help') {
    process.stderr.write(usage());
    process.exitCode = 2;
    return;
  }
  const snapshotPath = args[0];
  const outDir = args[1];
  let noDossier = false;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--no-dossier') {
      noDossier = true;
    } else if (args[i] === '--model' && i + 1 < args.length) {
      const overrides = JSON.parse(readFile(args[i + 1]!)) as Partial<typeof MODEL>;
      Object.assign(MODEL, overrides);
      i++;
    } else {
      process.stderr.write(usage());
      process.exitCode = 2;
      return;
    }
  }
  const snapshot = parseSnapshot(JSON.parse(readFile(snapshotPath)));
  const board = buildBoard(snapshot, MODEL);
  const issue = boardIssue(snapshot, board);
  if (issue !== null) {
    throw new Error(`board invalid: ${issue}`);
  }
  const radar = buildRadar(snapshot, MODEL);

  fs.mkdirSync(outDir, { recursive: true });
  const boardBytes = writeFile(path.join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  const dataBytes = writeFile(path.join(outDir, 'data.js'), dataScript(radar));
  const pageFiles = copyDir(path.join(__dirname, 'dashboard'), path.join(outDir, 'dashboard'));
  const shots = copyDir(path.join(__dirname, 'screenshots'), path.join(outDir, 'screenshots'));
  if (shots.length < 3) {
    throw new Error(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) throw new Error(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  }

  let dossierBytes = 0;
  if (!noDossier) {
    // The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
    const dossier = buildDossier(outDir, { text_max_bytes: TEXT_CAP, screenshots: SHOT_CAP, dashboard: DASH_CAP });
    dossierBytes = writeFile(path.join(outDir, 'dossier.json'), dossier);
  }

  const first = board[0]!;
  const last = board[board.length - 1]!;
  process.stdout.write(`launch radar v2: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n`);
  process.stdout.write(`launch radar v2: rank 1 is ${first.slug} at $${first.implied_value_usd.toLocaleString('en-US')} implied, rank ${board.length} at $${last.implied_value_usd.toLocaleString('en-US')}\n`);
  process.stdout.write(`launch radar v2: board.json ${board.length} rows, ${boardBytes} bytes; data.js ${dataBytes} bytes; dashboard ${pageFiles.length} files; screenshots ${shots.length} images${noDossier ? '' : `; dossier.json ${dossierBytes} bytes`}\n`);
}

main();
