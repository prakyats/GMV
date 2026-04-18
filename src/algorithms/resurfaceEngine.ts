/**
 * resurfaceEngine.ts — PRD Scoring Engine (Layer 1)
 *
 * Pure function. No side effects. No imports from the rest of the app.
 * This is your interview centrepiece — every line should be explainable
 * on a whiteboard.
 *
 * Algorithm:
 *   score = 0.40 * dateProximity
 *         + 0.25 * reactionScore
 *         + 0.25 * staleness
 *         + 0.10 * diversity
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface ResurfaceMemory {
  id: string;
  memoryDate?: FirestoreTimestamp | null;
  createdAt?: FirestoreTimestamp | null;
  reactions?: Record<string, string> | null;
  viewedBy?: string[] | null;
  contributorCount?: number | null;
}

// ---------------------------------------------------------------------------
// Internal date helpers
// ---------------------------------------------------------------------------

/**
 * Normalises any date to the 2004 baseline (a leap year) so that
 * month/day comparisons are year-invariant.
 * Feb 29 → Feb 28 so non-leap years never produce NaN or mismatches.
 */
const normaliseDate = (d: Date): Date => {
  if (d.getMonth() === 1 && d.getDate() === 29) {
    return new Date(2004, 1, 28);
  }
  return new Date(2004, d.getMonth(), d.getDate());
};

/**
 * Day-of-year on the 2004 baseline (1 = Jan 1, 366 = Dec 31).
 * Using Jan 0 (= Dec 31 of prev year) as the JS epoch for the diff so
 * Jan 1 comes out as day 1, not day 0.
 */
const normalisedDoy = (d: Date): number => {
  const n = normaliseDate(d);
  const start = new Date(2004, 0, 0); // Dec 31 2003
  return Math.floor((n.getTime() - start.getTime()) / 86_400_000);
};

/** True when two dates share the same month/day (year-invariant). */
const isSameMonthDay = (a: Date, b: Date): boolean => {
  const na = normaliseDate(a);
  const nb = normaliseDate(b);
  return na.getMonth() === nb.getMonth() && na.getDate() === nb.getDate();
};

/**
 * Circular day difference that handles the Dec/Jan year-wrap correctly.
 * e.g. Dec 30 vs Jan 2 = 3 days, not 363.
 */
const circularDayDiff = (doyA: number, doyB: number, year: number): number => {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  const diff = Math.abs(doyA - doyB);
  return Math.min(diff, daysInYear - diff);
};

/** Converts a Firestore Timestamp to a JS Date. Returns null on bad input. */
const tsToDate = (m: ResurfaceMemory): Date | null => {
  const ts = m.memoryDate ?? m.createdAt;
  if (!ts || typeof ts.seconds !== 'number') return null;
  return new Date(ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6);
};

/** Returns millisecond timestamp for tiebreaking. */
const tsToMs = (m: ResurfaceMemory): number => {
  const ts = m.memoryDate ?? m.createdAt;
  if (!ts || typeof ts.seconds !== 'number') return 0;
  return ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const WEIGHTS = {
  date: 0.40,
  reaction: 0.25,
  staleness: 0.25,
  diversity: 0.10,
} as const;

/**
 * PRD spec caps reaction normalisation at 10 to prevent a single viral
 * memory (say 50 reactions) from crushing every other score to near-zero.
 * Interview talking point: "I cap maxReactions at 10 so the reaction signal
 * stays meaningful even in groups with very uneven engagement."
 */
const REACTION_CAP = 10;

const scoreMemory = (
  m: ResurfaceMemory,
  today: Date,
  userId: string,
  maxReactions: number,
): number => {
  const d = tsToDate(m);
  if (!d) return 0;

  // --- 1. DATE PROXIMITY (0 → 1) ------------------------------------------
  // Full score for exact anniversary (same month/day in any prior year).
  // Partial score for ±1 or ±2 days. Zero for everything else.
  // Circular diff handles Dec 30 → Jan 1 wrap correctly.
  const todayDoy = normalisedDoy(today);
  const memDoy = normalisedDoy(d);
  const diff = circularDayDiff(todayDoy, memDoy, today.getFullYear());

  let dateScore = 0;
  if (isSameMonthDay(d, today)) {
    dateScore = 1.0;
  } else if (diff === 1) {
    dateScore = 0.625; // 1.0 - 1 * 0.375
  } else if (diff === 2) {
    dateScore = 0.25;  // 1.0 - 2 * 0.375
  }

  // --- 2. REACTION SCORE (0 → 1) ------------------------------------------
  // Normalised against min(maxReactions, REACTION_CAP) so one viral memory
  // can't suppress all others.
  const reactionCount = Object.keys(m.reactions ?? {}).length;
  const cap = Math.min(maxReactions, REACTION_CAP);
    const reactionScore = cap === 0 ? 0 : Math.min(reactionCount, cap) / cap;

  // --- 3. STALENESS (0.3 → 1.0) -------------------------------------------
  // Unviewed memories get 1.0 (highest staleness = most worth resurfacing).
  // Already viewed by this user gets 0.3 (still possible but deprioritised).
  const viewed = Array.isArray(m.viewedBy) && m.viewedBy.includes(userId);
  const staleness = viewed ? 0.3 : 1.0;

  // --- 4. DIVERSITY (0 → 1) -----------------------------------------------
  // contributorCount is stored on the memory doc at write time (snapshot of
  // how many unique contributors had posted to the vault at that moment).
  // Cap at 5: a memory posted when 5+ people were active = full diversity.
  const diversity = Math.min((m.contributorCount ?? 1) / 5, 1.0);

  return (
    WEIGHTS.date * dateScore +
    WEIGHTS.reaction * reactionScore +
    WEIGHTS.staleness * staleness +
    WEIGHTS.diversity * diversity
  );
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the single best memory to surface today, or null if none qualify.
 *
 * Rules:
 *   - Only memories from PRIOR years are considered (not the current year).
 *   - A memory must have score > 0 to be returned.
 *   - Ties broken by most recent memoryDate, then document ID.
 */
export const getBestResurfacedMemory = (
  memories: ResurfaceMemory[],
  today: Date,
  userId: string,
): ResurfaceMemory | null => {
  if (!memories || memories.length === 0) return null;

  // Filter: valid date AND from a prior year
  const valid = memories.filter((m) => {
    const d = tsToDate(m);
    return d !== null && d.getFullYear() < today.getFullYear();
  });

  if (valid.length === 0) return null;

  // Compute maxReactions across valid pool before scoring
  const maxReactions = Math.max(
    0,
    ...valid.map((m) => Object.keys(m.reactions ?? {}).length),
  );

  // Score and sort: score DESC, then time DESC, then id DESC (fully deterministic)
  const scored = valid
    .map((m) => ({ memory: m, score: scoreMemory(m, today, userId, maxReactions) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const tDiff = tsToMs(b.memory) - tsToMs(a.memory);
      if (tDiff !== 0) return tDiff;
      return b.memory.id.localeCompare(a.memory.id);
    });

  const best = scored[0];
  return best.score > 0 ? best.memory : null;
};