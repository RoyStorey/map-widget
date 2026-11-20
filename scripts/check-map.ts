/**
 * Validate one or more map files:  npm run map:check -- public/maps/*.json
 * Exits with code 1 if any map has errors. Use --json for machine-readable output.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { formatIssues, validateMap } from '../src/spec/validate';

const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('Usage: npm run map:check -- <map.json> [more.json…] [--json]');
  process.exit(2);
}
let failed = false;
const out: any[] = [];
for (const f of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    failed = true;
    if (json) out.push({ file: f, ok: false, errors: [{ path: '$', message: `Not valid JSON: ${(e as Error).message}` }], warnings: [] });
    else console.log(`\n${f}\n✗ Not valid JSON: ${(e as Error).message}`);
    continue;
  }
  // the gallery index (maps/index.json): check that every listed file exists
  if (data && typeof data === 'object' && Array.isArray((data as any).maps) && !(data as any).format) {
    const missing = (data as any).maps.filter((l: any) => !l?.file || !existsSync(join(dirname(f), l.file)));
    if (missing.length) failed = true;
    const msg = missing.length ? missing.map((l: any) => `✗ maps: "${l?.file}" not found next to the index.`).join('\n') : `✓ Gallery index – ${(data as any).maps.length} maps listed.`;
    if (json) out.push({ file: f, ok: !missing.length, index: true, errors: missing.map((l: any) => ({ path: 'maps', message: `"${l?.file}" not found` })), warnings: [] });
    else console.log(`\n${f}\n${msg}`);
    continue;
  }
  const r = validateMap(data);
  if (!r.ok) failed = true;
  if (json) out.push({ file: f, ok: r.ok, errors: r.errors, warnings: r.warnings, stats: r.stats });
  else console.log(`\n${f}\n${formatIssues(r)}`);
}
if (json) console.log(JSON.stringify(out, null, 2));
process.exit(failed ? 1 : 0);
