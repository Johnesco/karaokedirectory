#!/usr/bin/env node
/**
 * Seed script — converts js/data.js into SQL INSERT statements
 * for the JSONB-heavy schema defined in migrations/004_jsonb_redesign.sql
 *
 * Each venue becomes a single row: (id, name, active, data JSONB)
 * where `data` holds the rest of the venue object.
 *
 * Usage:  node supabase/seed-from-data.js > supabase/seed.sql
 *
 * Issue #47
 */

const fs = require('fs');
const path = require('path');

// Read data.js and evaluate it to get the object
const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const dataSource = fs.readFileSync(dataPath, 'utf-8');

// data.js assigns to `const karaokeData = { ... };` — extract the object
const match = dataSource.match(/const\s+karaokeData\s*=\s*(\{[\s\S]*\});?\s*$/);
if (!match) {
  console.error('Could not parse karaokeData from data.js');
  process.exit(1);
}

const karaokeData = eval(`(${match[1]})`);

// ---- Helpers ----

function esc(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function escBool(val) {
  return val ? 'true' : 'false';
}

function escJsonb(obj) {
  // PostgreSQL string-escape JSON, then cast to jsonb
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

// ---- Generate SQL ----

const lines = [];

lines.push('-- ============================================================================');
lines.push('-- Seed data generated from js/data.js (JSONB schema — issue #47)');
lines.push(`-- Generated: ${new Date().toISOString()}`);
lines.push('-- ============================================================================');
lines.push('');
lines.push('BEGIN;');
lines.push('');

// 1. Tags
lines.push('-- Tags');
for (const [id, def] of Object.entries(karaokeData.tagDefinitions)) {
  lines.push(
    `INSERT INTO tags (id, label, color, text_color) VALUES (${esc(id)}, ${esc(def.label)}, ${esc(def.color)}, ${esc(def.textColor)});`
  );
}
lines.push('');

// 2. Venues — one INSERT per venue. The full venue object goes into `data` JSONB
//    minus the three fields pulled out as columns (id, name, active).
lines.push('-- Venues');
for (const v of karaokeData.listings) {
  const { id, name, active, ...rest } = v;
  const isActive = active !== false; // default to true when omitted
  lines.push(
    `INSERT INTO venues (id, name, active, data) VALUES (${esc(id)}, ${esc(name)}, ${escBool(isActive)}, ${escJsonb(rest)});`
  );
}
lines.push('');

lines.push('COMMIT;');

// Output
console.log(lines.join('\n'));
