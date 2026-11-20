/** Writes public/atlas-map.schema.json (JSON Schema draft-07 for atlas-map@1). Run: npm run map:schema */
import { writeFileSync } from 'node:fs';

const place = { description: 'Place name from the gazetteer (see docs/places.md) or [longitude, latitude].', oneOf: [{ type: 'string', minLength: 1 }, { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }] };
const when = { description: 'Year (1066, -499 = 500 BCE), "500 BCE", "Oct 1066", "1066-10-14" or "1944-06-06T06:30".', oneOf: [{ type: 'string', minLength: 1 }, { type: 'number' }] };
const color = { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' };
const sideRef = { description: 'A side id, or null for nobody.', type: ['string', 'null'] };
const view = { type: 'object', required: ['center', 'zoom'], additionalProperties: false, properties: { center: { $ref: '#/definitions/place' }, zoom: { type: 'number', minimum: 0, maximum: 18, description: 'World ≈ 1.5, continent ≈ 3, country ≈ 5, region ≈ 7, city ≈ 11, battlefield ≈ 12–14.' }, pitch: { type: 'number', minimum: 0, maximum: 70 }, bearing: { type: 'number' } } };

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'atlas-map.schema.json',
  title: 'Atlas map (atlas-map@1)',
  description: 'An interactive history map: sides, territories over time, moving armies/fleets, events and a short story in chapters.',
  type: 'object',
  required: ['format', 'title', 'start', 'end', 'sides'],
  additionalProperties: false,
  definitions: { place, when, view },
  properties: {
    $schema: { type: 'string' },
    format: { const: 'atlas-map@1' },
    title: { type: 'string', minLength: 1 },
    summary: { type: 'string' },
    start: { $ref: '#/definitions/when' },
    end: { $ref: '#/definitions/when' },
    detail: { enum: ['world', 'continent', 'region', 'city', 'battlefield'], description: 'Map scale: sets territory cell size and coastline detail.' },
    basemap: { type: 'string', description: 'parchment, dark-atlas, light-atlas, blueprint, ink, war-room, ofm-liberty, ofm-positron, esri-imagery, esri-ocean, …' },
    view: { $ref: '#/definitions/view' },
    playSeconds: { type: 'number', minimum: 5, maximum: 3600 },
    trails: { enum: ['full', 'fade'] },
    sides: { type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'name'], additionalProperties: false, properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' }, name: { type: 'string' }, color, capital: { $ref: '#/definitions/place' }, description: { type: 'string' } } } },
    territories: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      name: { type: 'string' }, area: { type: 'array', minItems: 3, items: { $ref: '#/definitions/place' } }, around: { $ref: '#/definitions/place' }, radiusKm: { type: 'number', exclusiveMinimum: 0 },
      owner: sideRef, includeSea: { type: 'boolean' },
      changes: { type: 'array', items: { type: 'object', required: ['side', 'start'], additionalProperties: false, properties: { side: sideRef, start: { $ref: '#/definitions/when' }, end: { $ref: '#/definitions/when' }, from: { $ref: '#/definitions/place' } } } },
    } } },
    countries: { type: 'array', items: { type: 'object', required: ['countries', 'side', 'at'], additionalProperties: false, properties: { countries: { type: 'array', items: { type: 'string' }, minItems: 1 }, side: sideRef, at: { $ref: '#/definitions/when' } } } },
    moves: { type: 'array', items: { type: 'object', required: ['name', 'side', 'path'], additionalProperties: false, properties: {
      name: { type: 'string' }, side: { type: 'string' }, kind: { enum: ['army', 'armor', 'fleet', 'ship', 'aircraft', 'caravan', 'explorer', 'other'] }, strength: { type: 'number' }, bySea: { type: 'boolean' },
      path: { type: 'array', minItems: 2, items: { type: 'object', required: ['at', 'time'], additionalProperties: false, properties: { at: { $ref: '#/definitions/place' }, time: { $ref: '#/definitions/when' } } } },
    } } },
    routes: { type: 'array', items: { type: 'object', required: ['name', 'stops'], additionalProperties: false, properties: { name: { type: 'string' }, stops: { type: 'array', minItems: 2, items: { $ref: '#/definitions/place' } }, color, ships: { type: 'number' }, bySea: { type: 'boolean' }, twoWay: { type: 'boolean' }, start: { $ref: '#/definitions/when' }, end: { $ref: '#/definitions/when' }, description: { type: 'string' } } } },
    events: { type: 'array', items: { type: 'object', required: ['title', 'time', 'at'], additionalProperties: false, properties: { title: { type: 'string' }, time: { $ref: '#/definitions/when' }, at: { $ref: '#/definitions/place' }, kind: { enum: ['battle', 'siege', 'founding', 'treaty', 'disaster', 'discovery', 'note'] }, text: { type: 'string' }, side: { type: 'string' }, until: { $ref: '#/definitions/when' }, zoom: { type: 'number' } } } },
    eras: { type: 'array', items: { type: 'object', required: ['name', 'start', 'end'], additionalProperties: false, properties: { name: { type: 'string' }, start: { $ref: '#/definitions/when' }, end: { $ref: '#/definitions/when' }, color } } },
    labels: { type: 'array', items: { type: 'object', required: ['text', 'at'], additionalProperties: false, properties: { text: { type: 'string' }, at: { $ref: '#/definitions/place' }, size: { enum: ['small', 'medium', 'large'] }, start: { $ref: '#/definitions/when' }, end: { $ref: '#/definitions/when' }, color } } },
    arrows: { type: 'array', items: { type: 'object', required: ['from', 'to'], additionalProperties: false, properties: { from: { $ref: '#/definitions/place' }, to: { $ref: '#/definitions/place' }, label: { type: 'string' }, value: { type: 'number' }, color, start: { $ref: '#/definitions/when' }, end: { $ref: '#/definitions/when' } } } },
    story: { type: 'array', items: { type: 'object', required: ['title', 'text', 'time'], additionalProperties: false, properties: {
      title: { type: 'string' }, text: { type: 'string', description: 'A caption of 1–3 sentences. **bold**, *italic*, [link](https://…).' }, time: { $ref: '#/definitions/when' }, until: { $ref: '#/definitions/when' }, view: { $ref: '#/definitions/view' }, image: { type: 'string' }, imageCaption: { type: 'string' },
    } } },
    sources: { type: 'array', items: { type: 'string' } },
  },
};
writeFileSync(new URL('../public/atlas-map.schema.json', import.meta.url), JSON.stringify(schema, null, 2) + '\n');
console.log('wrote public/atlas-map.schema.json');
