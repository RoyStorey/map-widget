/**
 * map-widget/spec — the atlas-map@1 format without any browser code: types,
 * the validator and the place gazetteer. Safe to use in Node (build scripts,
 * tests, content checks).
 *
 *   import { validateMap, formatIssues } from 'map-widget/spec';
 *   const r = validateMap(spec);
 *   if (!r.ok) throw new Error(formatIssues(r));
 */
export * from './spec';
export { validateMap, formatIssues, type ValidationResult, type Issue } from './validate';
export { findPlace, suggestPlaces, placeNames, placeCount } from '../core/places';
