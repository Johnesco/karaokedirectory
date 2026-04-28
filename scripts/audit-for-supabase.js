#!/usr/bin/env node
/**
 * Supabase Migration Audit — Spike #44
 *
 * Checks data.js for every issue that would cause a SQL constraint violation.
 * Run this BEFORE generating seed.sql to catch all problems at once.
 *
 * Usage: node scripts/audit-for-supabase.js
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const dataSource = fs.readFileSync(dataPath, 'utf-8');
const match = dataSource.match(/const\s+karaokeData\s*=\s*(\{[\s\S]*\});?\s*$/);
if (!match) { console.error('Could not parse data.js'); process.exit(1); }
const data = eval(`(${match[1]})`);

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const VALID_FREQUENCIES = ['every', 'first', 'second', 'third', 'fourth', 'last', 'once'];
const TAG_IDS = new Set(Object.keys(data.tagDefinitions));
const TIME_RE = /^\d{2}:\d{2}$/;

const issues = [];
const warn = (venue, msg) => issues.push({ venue: venue.name || venue.id, id: venue.id, msg, level: 'ERROR' });
const info = (venue, msg) => issues.push({ venue: venue.name || venue.id, id: venue.id, msg, level: 'WARN' });

// --- Check each venue ---
const seenIds = new Set();

for (const v of data.listings) {
  // Duplicate IDs
  if (seenIds.has(v.id)) warn(v, `Duplicate venue ID: "${v.id}"`);
  seenIds.add(v.id);

  // Required fields
  if (!v.id) warn(v, 'Missing id');
  if (!v.name) warn(v, 'Missing name');

  // Tags: must exist in tagDefinitions
  if (v.tags) {
    for (const tag of v.tags) {
      if (!TAG_IDS.has(tag)) {
        warn(v, `Tag "${tag}" not in tagDefinitions. Did you mean "${findClosestTag(tag)}"?`);
      }
    }
  }

  // Schedule validation
  if (!v.schedule || v.schedule.length === 0) {
    info(v, 'No schedule entries');
  } else {
    for (let i = 0; i < v.schedule.length; i++) {
      const s = v.schedule[i];
      const prefix = `schedule[${i}]`;

      // Frequency
      if (!VALID_FREQUENCIES.includes(s.frequency)) {
        warn(v, `${prefix}: invalid frequency "${s.frequency}"`);
      }

      // Day validation for recurring
      if (s.frequency !== 'once') {
        if (!s.day) {
          warn(v, `${prefix}: recurring event (${s.frequency}) missing day`);
        } else if (!VALID_DAYS.includes(s.day)) {
          // Check if it's just a casing issue
          const capitalized = s.day.charAt(0).toUpperCase() + s.day.slice(1).toLowerCase();
          if (VALID_DAYS.includes(capitalized)) {
            info(v, `${prefix}: day "${s.day}" should be "${capitalized}" (casing)`);
          } else {
            warn(v, `${prefix}: invalid day "${s.day}"`);
          }
        }
      }

      // Date validation for one-time events
      if (s.frequency === 'once') {
        if (!s.date) {
          warn(v, `${prefix}: one-time event missing date`);
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
          warn(v, `${prefix}: date "${s.date}" not in YYYY-MM-DD format`);
        }
      }

      // Time format
      if (s.startTime && !TIME_RE.test(s.startTime)) {
        warn(v, `${prefix}: startTime "${s.startTime}" not in HH:MM format`);
      }
      if (s.endTime && !TIME_RE.test(s.endTime)) {
        warn(v, `${prefix}: endTime "${s.endTime}" not in HH:MM format`);
      }
      if (!s.startTime) warn(v, `${prefix}: missing startTime`);
      if (!s.endTime) info(v, `${prefix}: endTime is null (venue only advertises start time)`);
    }
  }

  // Host: empty-string name with no company is effectively null
  if (v.host && typeof v.host === 'object') {
    const hasName = v.host.name && v.host.name.trim() !== '';
    const hasCompany = v.host.company && v.host.company.trim() !== '';
    if (!hasName && !hasCompany) {
      info(v, 'Host object exists but has no name or company (will be treated as null)');
    }
  }

  // Coordinates: should be reasonable for Austin area
  if (v.coordinates) {
    const { lat, lng } = v.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      warn(v, `Coordinates not numeric: lat=${lat}, lng=${lng}`);
    } else {
      // Austin area roughly: lat 29.5-31.0, lng -98.5 to -97.0
      if (lat < 29.0 || lat > 31.5) info(v, `Latitude ${lat} seems far from Austin`);
      if (lng < -99.0 || lng > -96.5) info(v, `Longitude ${lng} seems far from Austin`);
    }
  }

  // Socials: check for obviously broken URLs
  if (v.socials && typeof v.socials === 'object') {
    for (const [platform, url] of Object.entries(v.socials)) {
      if (url && typeof url === 'string' && !url.startsWith('http')) {
        warn(v, `socials.${platform}: URL doesn't start with http: "${url}"`);
      }
    }
  }
}

// --- Report ---
const errors = issues.filter(i => i.level === 'ERROR');
const warnings = issues.filter(i => i.level === 'WARN');

console.log('=== Supabase Migration Audit ===');
console.log(`Venues scanned: ${data.listings.length}`);
console.log(`Tags defined: ${TAG_IDS.size}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log('');

if (errors.length > 0) {
  console.log('--- ERRORS (will cause SQL failures) ---');
  for (const e of errors) {
    console.log(`  [${e.id}] ${e.msg}`);
  }
  console.log('');
}

if (warnings.length > 0) {
  console.log('--- WARNINGS (data quality) ---');
  for (const w of warnings) {
    console.log(`  [${w.id}] ${w.msg}`);
  }
  console.log('');
}

if (errors.length === 0) {
  console.log('No errors found. Safe to generate seed.sql.');
} else {
  console.log(`Fix ${errors.length} error(s) before generating seed.sql.`);
  process.exit(1);
}

// --- Helper ---
function findClosestTag(input) {
  const lower = input.toLowerCase();
  let best = null, bestDist = Infinity;
  for (const tag of TAG_IDS) {
    const dist = levenshtein(lower, tag.toLowerCase());
    if (dist < bestDist) { bestDist = dist; best = tag; }
  }
  return best;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i-1][j] + 1, dp[i][j-1] + 1,
        dp[i-1][j-1] + (a[i-1] !== b[j-1] ? 1 : 0)
      );
  return dp[m][n];
}
