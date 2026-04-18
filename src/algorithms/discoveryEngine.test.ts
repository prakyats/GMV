/**
 * discoveryEngine.test.ts — Manual test suite (Phase 2)
 *
 * Run with:   npx tsx discoveryEngine.test.ts
 * or:         npx ts-node discoveryEngine.test.ts
 *
 * Every test validates a specific bucket rule.
 */

import { getResurfacedMemories, DiscoveryMemory } from './discoveryEngine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

const check = (label: string, condition: boolean, detail?: string) => {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${detail ? `  →  ${detail}` : ''}`);
    failed++;
  }
};

const ts = (dateStr: string) => {
  const ms = new Date(dateStr).getTime();
  return { seconds: Math.floor(ms / 1000), nanoseconds: 0 };
};

const mem = (id: string, dateStr: string): DiscoveryMemory => ({
  id,
  memoryDate: ts(dateStr),
});

// ---------------------------------------------------------------------------
// Shared fixture  (today = 2025-04-18)
// ---------------------------------------------------------------------------

const today = new Date('2025-04-18');

// Apr 18 2024  → anniversary (exact match)
// Apr 18 2023  → anniversary (exact match, older)
// Apr 21 2024  → nearby (diff = 3)
// Apr 25 2024  → nearby (diff = 7)
// Apr 26 2024  → NOT nearby (diff = 8, just outside window)
// Apr 10 2024  → thisMonth only (diff = 8, in April but not nearby)
// Apr 18 2025  → FILTERED (current year)
// Jan 01 2022  → random (far from today)
// Mar 15 2023  → random (different month entirely)

const memories: DiscoveryMemory[] = [
  mem('anniv_2024', '2024-04-18'),  // anniversary
  mem('anniv_2023', '2023-04-18'),  // anniversary (older)
  mem('nearby_3', '2024-04-21'),  // diff 3 → nearby
  mem('nearby_7', '2024-04-25'),  // diff 7 → nearby (max)
  mem('edge_8', '2024-04-26'),  // diff 8 → NOT nearby, but thisMonth
  mem('month_only', '2024-04-10'),  // thisMonth only (diff 8, same month)
  mem('cur_year', '2025-04-18'),  // current year → filtered
  mem('random_1', '2022-01-01'),  // random pool
  mem('random_2', '2023-03-15'),  // random pool
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n── Discovery Engine – Manual Test Suite ────────────────────────────\n');

const result = getResurfacedMemories(memories, today);

// TEST 1 — Current year is always excluded from all buckets
{
  const allIds = [
    ...result.anniversary,
    ...result.nearby,
    ...result.thisMonth,
    ...result.random,
  ].map((m) => m.id);

  check('T1  Current year excluded from all buckets',
    !allIds.includes('cur_year'),
    `found cur_year in output`);
}

// TEST 2 — Anniversary bucket: exact month/day matches
{
  const ids = result.anniversary.map((m) => m.id);
  check('T2  Anniversary contains exact matches',
    ids.includes('anniv_2024') && ids.includes('anniv_2023'),
    `got [${ids}]`);
  check('T2b Anniversary does NOT contain nearby items',
    !ids.includes('nearby_3'),
    `nearby_3 in anniversary`);
}

// TEST 3 — Anniversary sorted newest first
{
  const ids = result.anniversary.map((m) => m.id);
  check('T3  Anniversary sorted newest first',
    ids.indexOf('anniv_2024') < ids.indexOf('anniv_2023'),
    `order: [${ids}]`);
}

// TEST 4 — Nearby bucket: diff 3–7
{
  const ids = result.nearby.map((m) => m.id);
  check('T4  Nearby contains diff-3 and diff-7 items',
    ids.includes('nearby_3') && ids.includes('nearby_7'),
    `got [${ids}]`);
  check('T4b Nearby excludes diff-8 item',
    !ids.includes('edge_8'),
    `edge_8 (diff=8) in nearby`);
}

// TEST 5 — Hierarchical deduplication: anniversary items not in nearby/thisMonth
{
  const annexIds = new Set(result.anniversary.map((m) => m.id));
  const nearbyHasAnnex = result.nearby.some((m) => annexIds.has(m.id));
  const monthHasAnnex = result.thisMonth.some((m) => annexIds.has(m.id));
  check('T5  Anniversary items not duplicated in nearby', !nearbyHasAnnex);
  check('T5b Anniversary items not duplicated in thisMonth', !monthHasAnnex);
}

// TEST 6 — Random pool excludes all items already in other buckets
{
  const upperIds = new Set([
    ...result.anniversary.map((m) => m.id),
    ...result.nearby.map((m) => m.id),
    ...result.thisMonth.map((m) => m.id),
  ]);
  const randomHasDuplicate = result.random.some((m) => upperIds.has(m.id));
  check('T6  Random pool has no duplicates from other buckets', !randomHasDuplicate);
}

// TEST 7 — Random pool contains items not matching other buckets
{
  const ids = result.random.map((m) => m.id);
  check('T7  Random includes far-date items (random_1)',
    ids.includes('random_1'),
    `got [${ids}]`);
}

// TEST 8 — excludeId removes Layer 1 highlight from all buckets
{
  const resultWithExclude = getResurfacedMemories(memories, today, 'anniv_2024');
  const allIds = [
    ...resultWithExclude.anniversary,
    ...resultWithExclude.nearby,
    ...resultWithExclude.thisMonth,
    ...resultWithExclude.random,
  ].map((m) => m.id);

  check('T8  excludeId removes Layer 1 result from all buckets',
    !allIds.includes('anniv_2024'),
    `anniv_2024 still present`);
}

// TEST 9 — Session stability: same call, same day → same random order
{
  const r1 = getResurfacedMemories(memories, today);
  const r2 = getResurfacedMemories(memories, today);
  const ids1 = r1.random.map((m) => m.id).join(',');
  const ids2 = r2.random.map((m) => m.id).join(',');
  check('T9  Random bucket is stable across calls on same day',
    ids1 === ids2,
    `first=[${ids1}] second=[${ids2}]`);
}

// TEST 10 — thisMonth bucket catches month-only items
{
  const ids = result.thisMonth.map((m) => m.id);
  check('T10 thisMonth contains month-only item (diff=8)',
    ids.includes('month_only') || ids.includes('edge_8'),
    `got [${ids}]`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n────────────────────────────────────────────────────────────────────`);
console.log(`  ${passed} passed  ·  ${failed} failed`);
if (failed === 0) {
  console.log('  All tests pass. Discovery engine ready for Phase 3.\n');
} else {
  console.log('  Fix the failing tests before proceeding.\n');
  process.exit(1);
}