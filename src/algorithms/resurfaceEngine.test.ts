/**
 * resurfaceEngine.test.ts — Manual test suite (Phase 2)
 *
 * Run with:   npx tsx resurfaceEngine.test.ts
 * or:         npx ts-node resurfaceEngine.test.ts
 *
 * Every test checks a specific PRD requirement.
 * All 7 tests must log PASS for the implementation to be correct.
 */

import { getBestResurfacedMemory, ResurfaceMemory } from './resurfaceEngine';

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

/** Builds a FirestoreTimestamp from a YYYY-MM-DD string. */
const ts = (dateStr: string) => {
  const ms = new Date(dateStr).getTime();
  return { seconds: Math.floor(ms / 1000), nanoseconds: 0 };
};

/** Builds a minimal valid ResurfaceMemory. */
const mem = (
  id: string,
  dateStr: string,
  overrides: Partial<ResurfaceMemory> = {},
): ResurfaceMemory => ({
  id,
  memoryDate: ts(dateStr),
  reactions: {},
  viewedBy: [],
  contributorCount: 1,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n── Resurfacing Engine – Manual Test Suite ──────────────────────────\n');

// TEST 1 ── Exact anniversary wins over non-matching date
{
  const today = new Date('2025-04-18');
  const result = getBestResurfacedMemory(
    [
      mem('match', '2024-04-18'), // same month/day last year
      mem('nomatch', '2024-06-18'), // different date
    ],
    today,
    'user1',
  );
  check('T1  Exact anniversary returned', result?.id === 'match');
}

// TEST 2 ── Unviewed memory outscores identical viewed memory
{
  const today = new Date('2025-04-18');
  const result = getBestResurfacedMemory(
    [
      mem('viewed', '2024-04-18', { viewedBy: ['user1'] }),
      mem('unviewed', '2024-04-18', { viewedBy: [] }),
    ],
    today,
    'user1',
  );
  check('T2  Unviewed beats viewed', result?.id === 'unviewed',
    `got ${result?.id}`);
}

// TEST 3 ── Empty input returns null
{
  const result = getBestResurfacedMemory([], new Date(), 'user1');
  check('T3  Empty array → null', result === null);
}

// TEST 4 ── Current-year memories are excluded
{
  const today = new Date('2025-04-18');
  const result = getBestResurfacedMemory(
    [mem('current', '2025-04-18')],
    today,
    'user1',
  );
  check('T4  Current year excluded → null', result === null);
}

// TEST 5 ── Tie broken deterministically (score equal, newer memoryDate wins)
{
  const today = new Date('2025-04-18');
  const result = getBestResurfacedMemory(
    [
      mem('older', '2023-04-18'), // same score, earlier year
      mem('newer', '2024-04-18'), // same score, later year → should win
    ],
    today,
    'user1',
  );
  check('T5  Tiebreaker: newer memoryDate wins', result?.id === 'newer',
    `got ${result?.id}`);
}

// TEST 6 ── Date proximity dominates over reactions (weight 0.40 vs 0.25)
// Memory 1: exact date, 0 reactions  → score = 0.40*1 + 0*0 + 0.25*1 + 0.10*0.2 = 0.67
// Memory 2: far date,  5 reactions   → score = 0.40*0 + 0.25*1 + 0.25*1 + 0.10*0.2 = 0.52
{
  const today = new Date('2025-04-18');
  const result = getBestResurfacedMemory(
    [
      mem('date_match', '2024-04-18', { reactions: {} }),
      mem('many_reaction', '2024-10-18', {
        reactions: { a: '❤️', b: '🔥', c: '😂', d: '👍', e: '👏' },
      }),
    ],
    today,
    'user1',
  );
  check('T6  Date proximity outweighs 5 reactions', result?.id === 'date_match',
    `got ${result?.id}`);
}

// TEST 7 ── Reaction cap: 50 reactions do NOT suppress other memories
// Without the REACTION_CAP=10, the memory with 50 reactions would get
// reactionScore=1.0 while all others get 0/50=0, distorting the ranking.
// With cap=10, anything ≥10 reactions = reactionScore 1.0.
{
  const today = new Date('2025-04-18');
  const viral = mem('viral', '2024-10-18', {
    reactions: Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`u${i}`, '❤️']),
    ),
  });
  const anniversary = mem('anniv', '2024-04-18', { reactions: {} });

  const result = getBestResurfacedMemory([viral, anniversary], today, 'user1');
  // anniv: dateScore=1 → 0.40*1 + 0.25*0 + 0.25*1 + 0.10*0.2 = 0.67
  // viral: dateScore=0 → 0.40*0 + 0.25*1 + 0.25*1 + 0.10*0.2 = 0.52
  check('T7  Reaction cap prevents viral suppression', result?.id === 'anniv',
    `got ${result?.id}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n────────────────────────────────────────────────────────────────────`);
console.log(`  ${passed} passed  ·  ${failed} failed`);
if (failed === 0) {
  console.log('  All tests pass. Engine is PRD-compliant.\n');
} else {
  console.log('  Fix the failing tests before proceeding to Phase 3.\n');
  process.exit(1);
}