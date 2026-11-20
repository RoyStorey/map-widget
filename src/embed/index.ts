/**
 * map-widget/embed — the embeddable historical map.
 *
 *   import { mountMap, type MapSpec } from 'map-widget/embed';
 *   const handle = mountMap(document.getElementById('map')!, spec, { theme: 'light' });
 *   // …later
 *   handle.destroy();
 *
 * See docs/embedding.md.
 */
export { mountMap, type AtlasMapHandle, type MountOptions, type MapSource } from './AtlasMap';
export type { MapSpec, SpecSide, SpecChange, SpecTerritory, SpecCountries, SpecWaypoint, SpecMove, SpecRoute, SpecEvent, SpecEra, SpecLabel, SpecArrow, SpecView, SpecChapter, Place, When, Detail } from '../spec/spec';
export { isMapSpec } from '../spec/spec';
export { validateMap, formatIssues, type ValidationResult, type Issue } from '../spec/validate';
