/** Writes docs/places.md – every place name lessons can use. Run: npm run lesson:places */
import { mkdirSync, writeFileSync } from 'node:fs';
import { findPlace, placeNames } from '../src/core/places';

const names = placeNames().sort((a, b) => a.localeCompare(b));
const rows = names.map((n) => { const p = findPlace(n)!; return `| ${n} | ${p[0]} | ${p[1]} |`; });
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/places.md', import.meta.url), `# Built-in places (${names.length})\n\nUse these names anywhere a lesson expects a place (\`"at": "Hastings"\`). Matching ignores case and accents, and common alternative names work too (e.g. "Constantinople" → Istanbul, "Peking" → Beijing). Anything else: use \`[longitude, latitude]\`.\n\n| Name | Longitude | Latitude |\n|---|---|---|\n${rows.join('\n')}\n`);
console.log(`wrote docs/places.md (${names.length} places)`);
