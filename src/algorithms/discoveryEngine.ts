/**
 * discoveryEngine.ts — Layer 2 Discovery Engine
 *
 * Provides four contextual memory buckets for the "More for you" section.
 * Deliberately kept independent from resurfaceEngine — no shared imports
 * between Layer 1 and Layer 2. Both import ResurfaceMemory from their own
 * local interface so neither layer breaks if the other changes.
 *
 * Bucket definitions:
 *   anniversary – exact same month/day in prior years
 *   nearby      – ±3–7 days window in prior years (no overlap with anniversary ±0)
 *   thisMonth   – same calendar month in prior years (broad seasonal context)
 *   random      – date-seeded stable selection from everything else
 *
 * Adaptive interleaving: within each bucket, unseen memories are prioritised
 * over seen ones using a dynamic step ratio, not a simple filter.
 */

import { ResurfaceMemory, getScoredMemories, ScoredMemory } from './resurfaceEngine';

// Re-export so callers can use one type
export type { ResurfaceMemory as DiscoveryMemory };

export interface DiscoveryBuckets<T extends ResurfaceMemory = ResurfaceMemory> {
  anniversary: T[];
  nearby:      T[];
  thisMonth:   T[];
  random:      T[];
}

// ---------------------------------------------------------------------------
// Date helpers (intentionally duplicated from resurfaceEngine to keep files
// independently portable — no shared private-utility import)
// ---------------------------------------------------------------------------

const normaliseDate = (d: Date): Date => {
  if (d.getMonth() === 1 && d.getDate() === 29) return new Date(2004, 1, 28);
  return new Date(2004, d.getMonth(), d.getDate());
};

const normalisedDoy = (d: Date): number => {
  const n = normaliseDate(d);
  return Math.floor((n.getTime() - new Date(2004, 0, 0).getTime()) / 86_400_000);
};

const circularDayDiff = (doyA: number, doyB: number, year: number): number => {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  return Math.min(Math.abs(doyA - doyB), daysInYear - Math.abs(doyA - doyB));
};

const tsToDate = (m: ResurfaceMemory): Date | null => {
  const ts = m.memoryDate ?? m.createdAt;
  if (!ts || typeof ts.seconds !== 'number') return null;
  return new Date(ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1e6);
};

// ---------------------------------------------------------------------------
// Session-stable random shuffle
// ---------------------------------------------------------------------------

/**
 * Deterministic LCG shuffle seeded from today's date string.
 * Same calendar day → same shuffle regardless of input array order.
 * This prevents the random cards from jumping on reaction updates.
 */
const dateSeed = (today: Date): number => {
  const str = today.toDateString();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const seededShuffle = <T>(arr: T[], seed: number): T[] => {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = Math.abs((1_664_525 * s + 1_013_904_223) & 0x7fffffff);
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// ---------------------------------------------------------------------------
// Adaptive interleaving
// ---------------------------------------------------------------------------

/**
 * Zips unseen and seen arrays using a dynamic step.
 *
 * step = clamp(1, 3, round(unseen / (seen + 1)))
 *
 * If mostly unseen: step=3 → takes 3 unseen per 1 seen (fresh-heavy).
 * If mostly seen: step=1 → alternates 1:1.
 * Interview answer: "The step adapts to pool composition so users always see
 * fresh content first without completely hiding revisited memories."
 */
const adaptiveInterleave = <T extends ResurfaceMemory>(
  unseen: ScoredMemory<T>[],
  seen:   ScoredMemory<T>[],
  limit:  number,
): T[] => {
  if (unseen.length === 0) return seen.map(s => s.memory).slice(0, limit);
  if (seen.length === 0)   return unseen.map(s => s.memory).slice(0, limit);

  const step = Math.min(3, Math.max(1, Math.round(unseen.length / (seen.length + 1))));
  const result: T[] = [];
  let uIdx = 0;
  let sIdx = 0;

  while (result.length < limit && (uIdx < unseen.length || sIdx < seen.length)) {
    for (let i = 0; i < step && uIdx < unseen.length && result.length < limit; i++) {
      result.push(unseen[uIdx++].memory);
    }
    if (sIdx < seen.length && result.length < limit) {
      result.push(seen[sIdx++].memory);
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const BUCKET_LIMIT  = 5;
const NEARBY_MIN    = 3; // days, inclusive
const NEARBY_MAX    = 7; // days, inclusive

/**
 * Returns four discovery buckets for the OnThisDay screen.
 *
 * @param memories    All vault memories (from a getDocs call, not onSnapshot).
 * @param today       Current date.
 * @param userId      Current user — drives the unseen/seen partition.
 * @param excludeId   ID of the Layer 1 hero memory — excluded from all buckets
 *                    so it never appears twice on screen.
 * @param recentIds   IDs surfaced earlier this session — penalised by 0.7×
 *                    to reduce repetition without fully hiding them.
 */
export const getResurfacedMemories = <T extends ResurfaceMemory>(
  memories: T[],
  today: Date,
  userId: string,
  excludeId?: string,
  recentIds: string[] = [],
): DiscoveryBuckets<T> => {
  const todayYear = today.getFullYear();
  const todayDoy  = normalisedDoy(today);
  const seed      = dateSeed(today);

  // Global excluded IDs (Layer 1 hero must never appear again)
  const usedIds = new Set<string>();
  if (excludeId) usedIds.add(excludeId);

  // Step 1: Valid pool — prior year only
  const valid = (memories ?? []).filter(m => {
    const d = tsToDate(m);
    return d !== null && d.getFullYear() < todayYear;
  });

  // Step 2: Classify into raw bucket arrays
  const anniversaryRaw: T[] = [];
  const nearbyRaw:      T[] = [];
  const thisMonthRaw:   T[] = [];

  for (const m of valid) {
    const d = tsToDate(m)!;
    const nd    = normaliseDate(d);
    const memDoy = normalisedDoy(d);
    const diff   = circularDayDiff(todayDoy, memDoy, todayYear);

    if (diff === 0) {
      anniversaryRaw.push(m);
    } else if (diff >= NEARBY_MIN && diff <= NEARBY_MAX) {
      nearbyRaw.push(m);
    }

    // thisMonth uses normalised month for year-invariant comparison
    if (nd.getMonth() === normaliseDate(today).getMonth()) {
      thisMonthRaw.push(m);
    }
  }

  // Step 3: Process each bucket → score → cooldown penalty → partition → interleave → dedup
  const processBucket = (
    pool: T[],
    isAnniversary: boolean = false,
  ): T[] => {
    if (pool.length === 0) return [];

    // Score
    let scored = getScoredMemories(pool, today, isAnniversary);

    // Cooldown penalty for recently surfaced memories
    if (recentIds.length > 0) {
      scored = scored.map(s =>
        recentIds.includes(s.memory.id)
          ? { ...s, score: s.score * 0.7 }
          : s,
      );
      // Re-sort after penalty
      scored.sort((a, b) => b.score - a.score);
    }

    // Partition: unseen → seen
    const unseen = scored.filter(s => !s.memory.viewedBy?.includes(userId));
    const seen   = scored.filter(s =>  s.memory.viewedBy?.includes(userId));

    // Adaptive interleave → limit
    const interleaved = adaptiveInterleave(unseen, seen, BUCKET_LIMIT);

    // Dedup against global usedIds (hierarchical: anniversary > nearby > thisMonth > random)
    const result: T[] = [];
    for (const m of interleaved) {
      if (!usedIds.has(m.id)) {
        result.push(m);
        usedIds.add(m.id);
      }
    }
    return result;
  };

  const anniversary = processBucket(anniversaryRaw, true);
  const nearby      = processBucket(nearbyRaw,      false);
  const thisMonth   = processBucket(thisMonthRaw,   false);

  // Random: stable shuffle of everything not yet used
  const remaining = valid.filter(m => !usedIds.has(m.id));
  const shuffled  = seededShuffle(remaining, seed);
  // Run shuffled remaining through processBucket for consistent scoring/interleaving
  const random    = processBucket(shuffled, false);

  return { anniversary, nearby, thisMonth, random };
};