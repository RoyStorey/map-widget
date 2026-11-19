/**
 * Validate one or more lesson files:  npm run lesson:check -- public/lessons/*.json
 * Exits with code 1 if any lesson has errors. Use --json for machine-readable output.
 */
import { readFileSync } from 'node:fs';
import { formatIssues, validateLesson } from '../src/lesson/validate';

const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('Usage: npm run lesson:check -- <lesson.json> [more.json…] [--json]');
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
  const r = validateLesson(data);
  if (!r.ok) failed = true;
  if (json) out.push({ file: f, ok: r.ok, errors: r.errors, warnings: r.warnings, stats: r.stats });
  else console.log(`\n${f}\n${formatIssues(r)}`);
}
if (json) console.log(JSON.stringify(out, null, 2));
process.exit(failed ? 1 : 0);
