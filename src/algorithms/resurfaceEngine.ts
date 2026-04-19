/**
 * resurfaceEngine.ts — PRD Scoring Engine (Layer 1)
 *
 * Pure function. No imports from navigation, services, or any other app layer.
 * This is the interview centrepiece — every line is explainable on a whiteboard.
 *
 * Scoring formula:
 *   score = 0.50 * dateProximity
 *         + 0.25 * reactionScore   (K-smoothed, reaction-weighted)
 *         + 0.15 * diversityScore  (inverse-frequency per contributor)
 *         + 0.10 * recencyScore    (normalised createdAt within pool)
 *
 * viewedBy drives the UNSEEN > SEEN partition AFTER scoring.
 * This separates "quality" (score) from "freshness for this user" (partition),
 * which is a cleaner design than mixing them in one formula.
 */

// ---------------------------------------------------------------------------
// Types  (self-contained — no navigation imports)
// ---------------------------------------------------------------------------

export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
}

export interface ResurfaceMemory {
  id: string;
  memoryDate?: FirestoreTimestamp | null;
  createdAt?: FirestoreTimestamp | null;
  reactions?: Record<string, string> | null;
  viewedBy?: string[] | null;
  contributorCount?: number | null;
  createdBy?: { id: string; name: string } | null;
}

export type ScoredMemory<T extends ResurfaceMemory = ResurfaceMemory> = {
  memory: T;
  score: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  date:      0.50,
  reaction:  0.25,
  diversity: 0.15,
  recency:   0.10,
} as const;

/**
 * Emotional weight per emoji.
 * ❤️ carries more signal than 👍 — hearts are deliberate, thumbs are easy.
 * Unknown emojis get 0.5 (neutral default).
 */
const REACTION_WEIGHTS: Record<string, number> = {
  '❤️': 1.0,
  '😮': 0.9,
  '😂': 0.8,
  '👍': 0.6,
};

/**
 * K-smoothing constant for the reaction signal.
 * Prevents a memory with 1 reaction from scoring 1/1=100% while a memory
 * with 19 reactions only scores 19/20=95% of a "capped" memory.
 * With K=5: 1 reaction → 1/6=0.17, 15 reactions → 15/20=0.75, 20 → 20/25=0.80.
 * Interview answer: "K-smoothing gives reactions a Bayesian prior of ~5 neutral
 * reactions, so early reactions count less and the signal scales smoothly."
 */
const SMOOTHING_K = 5;

/**
 * Cap on weighted reaction sum before smoothing.
 * Prevents a viral memory (100 reactions) from completely dominating.
 * With CAP=20: any memory with ≥20 weighted reactions gets the same top score.
 */
const REACTION_CAP = 20;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Normalises to the 2004 baseline (a leap year) for year-invariant comparison. */
const normaliseToBaseline = (d: Date): Date => {
  if (d.getMonth() === 1 && d.getDate() === 29) return new Date(2004, 1, 28);
  return new Date(2004, d.getMonth(), d.getDate());
};

const normalisedDoy = (d: Date): number => {
  const n = normaliseToBaseline(d);
  const start = new Date(2004, 0, 0); // Dec 31 2003
  return Math.floor((n.getTime() - start.getTime()) / 86_400_000);
};

/** Circular day diff that handles the Dec 30 → Jan 2 wrap. */
const circularDayDiff = (doyA: number, doyB: number, year: number): number => {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  const diff = Math.abs(doyA - doyB);
  return Math.min(diff, daysInYear - diff);
};

const isSameMonthDay = (a: Date, b: Date): boolean => {
  const na = normaliseToBaseline(a);
  const nb = normaliseToBaseline(b);
  return na.getMonth() === nb.getMonth() && na.getDate() === nb.getDate();
};

/** Converts a Firestore Timestamp → JS Date using memoryDate first, then createdAt. */
const tsToDate = (m: ResurfaceMemory): Date | null => {
  const ts = m.memoryDate ?? m.createdAt;
  if (!ts || typeof ts.seconds !== 'number') return null;
  return new Date(ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6);
};

/** Returns ms timestamp from createdAt (server time). Used for recency + tiebreaking. */
const createdAtMs = (m: ResurfaceMemory): number => {
  const ts = m.createdAt;
  if (!ts || typeof ts.seconds !== 'number') return 0;
  return ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6;
};

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

/**
 * Scores a pool of memories with shared normalisation context.
 *
 * @param pool             Memories to score (must all be from prior years).
 * @param today            Current date.
 * @param isAnniversaryPool  When true, dateScore is forced to 1.0 for all items
 *                           since they were pre-filtered to exact anniversary
 *                           matches — re-computing dateScore would just add noise.
 */
export const getScoredMemories = <T extends ResurfaceMemory>(
  pool: T[],
  today: Date,
  isAnniversaryPool: boolean = false,
): ScoredMemory<T>[] => {
  if (pool.length === 0) return [];

  // --- Pool-level stats (computed once, used for normalisation) ---

  let minCreatedMs = Infinity;
  let maxCreatedMs = -Infinity;
  const contributorFreq: Record<string, number> = {};

  for (const m of pool) {
    const ms = createdAtMs(m);
    if (ms > 0) {
      if (ms < minCreatedMs) minCreatedMs = ms;
      if (ms > maxCreatedMs) maxCreatedMs = ms;
    }
    const key = m.createdBy?.id ?? 'unknown';
    contributorFreq[key] = (contributorFreq[key] ?? 0) + 1;
  }

  const timeRange = maxCreatedMs - minCreatedMs; // 0 if all same timestamp

  // --- Score each memory ---

  const scored: ScoredMemory<T>[] = pool.map(m => {

    // 1. DATE SCORE (0 → 1.0)
    // Full score for exact anniversary. Partial for ±1 or ±2 days.
    // Anniversary pool members skip this (already known to be exact matches).
    let dateScore = isAnniversaryPool ? 1.0 : 0;
    if (!isAnniversaryPool) {
      const d = tsToDate(m);
      if (d) {
        if (isSameMonthDay(d, today)) {
          dateScore = 1.0;
        } else {
          const diff = circularDayDiff(
            normalisedDoy(today),
            normalisedDoy(d),
            today.getFullYear(),
          );
          if (diff === 1) dateScore = 0.625;
          else if (diff === 2) dateScore = 0.25;
        }
      }
    }

    // 2. REACTION SCORE (0.05 → ~0.80 asymptotic)
    // K-smoothed so early reactions don't over-score.
    // Unknown emojis get 0.5 (neutral) not 0.
    let reactionScore = 0.05; // floor: even 0 reactions gets a tiny signal
    const reactions = m.reactions ?? {};
    let weightedSum = 0;
    for (const emoji of Object.values(reactions)) {
      weightedSum += REACTION_WEIGHTS[emoji] ?? 0.5;
    }
    if (weightedSum > 0) {
      const capped = Math.min(weightedSum, REACTION_CAP);
      reactionScore = capped / (capped + SMOOTHING_K);
    }

    // 3. RECENCY SCORE (0 → 1.0)
    // Newer memories (within this pool) get a slight boost.
    // Fallback to 0.5 when all timestamps are identical or missing.
    let recencyScore = 0.5;
    const ms = createdAtMs(m);
    if (ms > 0 && timeRange > 0) {
      recencyScore = (ms - minCreatedMs) / timeRange;
    }

    // 4. DIVERSITY SCORE (0 → 1.0)
    // Penalises memories from contributors who dominate the pool.
    // freq=1 → 1.0, freq=2 → 0.5, freq=3 → 0.33, etc.
    // Note: this is pool-scoped, not vault-scoped. In small pools (anniversary)
    // everyone typically has freq=1 so all score 1.0 — that's correct behaviour.
    const freq = contributorFreq[m.createdBy?.id ?? 'unknown'] ?? 1;
    const diversityScore = 1 / freq;

    return {
      memory: m,
      score:
        WEIGHTS.date      * dateScore     +
        WEIGHTS.reaction  * reactionScore +
        WEIGHTS.diversity * diversityScore +
        WEIGHTS.recency   * recencyScore,
    };
  });

  // Deterministic sort: Score DESC → createdAt DESC → ID DESC
  return scored.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;
    const tDiff = createdAtMs(b.memory) - createdAtMs(a.memory);
    if (tDiff !== 0) return tDiff;
    return b.memory.id.localeCompare(a.memory.id);
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the single best memory for the Hero slot, or null.
 *
 * Flow:
 *   1. Filter: only prior-year memories.
 *   2. If any memories match today's exact anniversary, score only those
 *      (anniversary structural bypass).
 *   3. Score the selected pool.
 *   4. Partition into unseen / seen (for this userId).
 *   5. Return unseen[0] if any, else seen[0].
 *
 * Partition means "seen" memories can still appear — they just lose the
 * priority seat to any unseen memory of equal or lower quality score.
 */
export const getBestResurfacedMemory = <T extends ResurfaceMemory>(
  memories: T[],
  today: Date,
  userId: string,
): T | null => {
  if (!memories || memories.length === 0) return null;

  // Step 1: Prior-year only
  const valid = memories.filter(m => {
    const d = tsToDate(m);
    return d !== null && d.getFullYear() < today.getFullYear();
  });
  if (valid.length === 0) return null;

  // Step 2: Anniversary bypass
  const anniversaryMatches = valid.filter(m => {
    const d = tsToDate(m);
    return d !== null && isSameMonthDay(d, today);
  });
  const isAnniversaryPool = anniversaryMatches.length > 0;
  const pool = isAnniversaryPool ? anniversaryMatches : valid;

  // Step 3: Score
  const scored = getScoredMemories(pool, today, isAnniversaryPool);

  // Step 4: Partition
  const unseen = scored.filter(s => !s.memory.viewedBy?.includes(userId));
  const seen   = scored.filter(s =>  s.memory.viewedBy?.includes(userId));

  // Step 5: Pick
  const best = unseen[0] ?? seen[0];
  return best?.memory ?? null;
};