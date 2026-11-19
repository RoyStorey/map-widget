/**
 * Validate one or more lesson files:  npm run lesson:check -- public/lessons/*.json
 * Exits with code 1 if any lesson has errors. Use --json for machine-readable output.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
  // the gallery index (lessons/index.json): check that every listed file exists
  if (data && typeof data === 'object' && Array.isArray((data as any).lessons) && !(data as any).format) {
    const missing = (data as any).lessons.filter((l: any) => !l?.file || !existsSync(join(dirname(f), l.file)));
    if (missing.length) failed = true;
    const msg = missing.length ? missing.map((l: any) => `✗ lessons: "${l?.file}" not found next to the index.`).join('\n') : `✓ Gallery index – ${(data as any).lessons.length} lessons listed.`;
    if (json) out.push({ file: f, ok: !missing.length, index: true, errors: missing.map((l: any) => ({ path: 'lessons', message: `"${l?.file}" not found` })), warnings: [] });
    else console.log(`\n${f}\n${msg}`);
    continue;
  }
  const r = validateLesson(data);
  if (!r.ok) failed = true;
  if (json) out.push({ file: f, ok: r.ok, errors: r.errors, warnings: r.warnings, stats: r.stats });
  else console.log(`\n${f}\n${formatIssues(r)}`);
}
if (json) console.log(JSON.stringify(out, null, 2));
process.exit(failed ? 1 : 0);
