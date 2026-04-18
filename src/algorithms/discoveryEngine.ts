/**
 * discoveryEngine.ts — Layer 2 Discovery Engine
 *
 * Provides FOUR contextual memory buckets for the "More for you" section
 * of the OnThisDay screen. Completely separate from the scoring engine.
 *
 * Bucket definitions:
 *   anniversary  – memories from this exact month/day in any prior year
 *                  (same pool as Layer 1's dateProximity = 1.0)
 *   nearby       – memories within ±3–7 days of today in prior years
 *                  (the "close but not exact" nostalgia window)
 *   thisMonth    – memories from this calendar month in prior years
 *                  (broader seasonal context)
 *   random       – a date-seeded stable selection from everything else
 *                  (discovery / surprise)
 *
 * WHY THESE BUCKETS (interview talking point):
 *   The scoring engine picks ONE best memory. These buckets give the
 *   screen something to show even when the scored memory is null, and add
 *   variety so the screen doesn't feel identical every day.
 *
 * NAMING NOTE (why not weekAgo/monthAgo):
 *   "weekAgo" and "monthAgo" would imply a specific calendar offset
 *   (e.g. Apr 11 for "7 days ago"). Instead we use year-invariant windows
 *   so a memory from Apr 16 *last year* shows up in "nearby", not just
 *   a memory from exactly Apr 11 last year. This gives richer results
 *   for groups that don't have daily memories.
 *
 * SESSION STABILITY:
 *   The random bucket uses a deterministic date seed so cards don't jump
 *   when a reaction update triggers a re-render. Same day = same shuffle.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface DiscoveryMemory {
  id: string;
  memoryDate?: FirestoreTimestamp | null;
  createdAt?: FirestoreTimestamp | null;
  [key: string]: unknown;
}

export interface DiscoveryResult {
  /** Exact same month/day in prior years. */
  anniversary: DiscoveryMemory[];
  /** Within ±3–7 days of today in prior years. */
  nearby: DiscoveryMemory[];
  /** Same calendar month in prior years. */
  thisMonth: DiscoveryMemory[];
  /** Date-seeded stable random selection from the remaining pool. */
  random: DiscoveryMemory[];
}

// ---------------------------------------------------------------------------
// Internal helpers (duplicated from resurfaceEngine deliberately —
// keeps both files independently portable with no shared import)
// ---------------------------------------------------------------------------

const normaliseDate = (d: Date): Date => {
  if (d.getMonth() === 1 && d.getDate() === 29) return new Date(2004, 1, 28);
  return new Date(2004, d.getMonth(), d.getDate());
};

const normalisedDoy = (d: Date): number => {
  const n = normaliseDate(d);
  const start = new Date(2004, 0, 0);
  return Math.floor((n.getTime() - start.getTime()) / 86_400_000);
};

const isSameMonthDay = (a: Date, b: Date): boolean => {
  const na = normaliseDate(a);
  const nb = normaliseDate(b);
  return na.getMonth() === nb.getMonth() && na.getDate() === nb.getDate();
};

const circularDayDiff = (doyA: number, doyB: number, year: number): number => {
  const daysInYear = year % 4 === 0 ? 366 : 365;
  const diff = Math.abs(doyA - doyB);
  return Math.min(diff, daysInYear - diff);
};

const tsToDate = (m: DiscoveryMemory): Date | null => {
  const ts = m.memoryDate ?? m.createdAt;
  if (!ts || typeof (ts as FirestoreTimestamp).seconds !== 'number') return null;
  const t = ts as FirestoreTimestamp;
  return new Date(t.seconds * 1000 + (t.nanoseconds ?? 0) / 1e6);
};

const tsToMs = (m: DiscoveryMemory): number => {
  const ts = m.memoryDate ?? m.createdAt;
  if (!ts || typeof (ts as FirestoreTimestamp).seconds !== 'number') return 0;
  const t = ts as FirestoreTimestamp;
  return t.seconds * 1000 + (t.nanoseconds ?? 0) / 1e6;
};

const sortDesc = <T extends DiscoveryMemory>(arr: T[]): T[] =>
  [...arr].sort((a, b) => tsToMs(b) - tsToMs(a));

/**
 * Date-seeded shuffle.
 *
 * The seed is derived from today's date string so the same day always
 * produces the same shuffle regardless of Firestore document order.
 * This prevents the random cards from jumping when reactions update.
 *
 * Simple LCG (linear congruential generator) — good enough for display order.
 */
const seededShuffle = <T>(arr: T[], seed: number): T[] => {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    // LCG: next = (a * s + c) % m  (Numerical Recipes constants)
    s = Math.abs((1_664_525 * s + 1_013_904_223) & 0x7fffffff);
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** Derives a numeric seed from a date string like "Sat Apr 18 2026". */
const dateSeed = (today: Date): number => {
  const str = today.toDateString(); // stable per calendar day
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const BUCKET_LIMIT = 5;

// ±N days window for the "nearby" bucket. Days 1 and 2 are the shared
// ±2-day window already covered by the scoring engine's anniversary signal.
// Days 3–7 give a wider nostalgic context without overlapping exactly.
const NEARBY_MIN_DIFF = 3;
const NEARBY_MAX_DIFF = 7;

/**
 * Returns four discovery buckets for the OnThisDay screen.
 *
 * @param memories       All memories for the vault (from a getDocs call).
 * @param today          Current date.
 * @param excludeId      Optional: the id returned by getBestResurfacedMemory.
 *                       Excluded from all buckets so it isn't shown twice.
 */
export const getResurfacedMemories = (
  memories: DiscoveryMemory[],
  today: Date,
  excludeId?: string,
): DiscoveryResult => {
  const todayYear = today.getFullYear();
  const todayDoy = normalisedDoy(today);
  const seed = dateSeed(today);

  // Global filter: must have a valid date AND be from a prior year.
  const valid = (memories ?? []).filter((m) => {
    const d = tsToDate(m);
    return d !== null && d.getFullYear() < todayYear;
  });

  // ─── Raw bucket computation ──────────────────────────────────────────────

  const anniversaryRaw: DiscoveryMemory[] = [];
  const nearbyRaw: DiscoveryMemory[] = [];
  const thisMonthRaw: DiscoveryMemory[] = [];

  for (const m of valid) {
    const d = tsToDate(m)!;
    const memDoy = normalisedDoy(d);
    const diff = circularDayDiff(todayDoy, memDoy, todayYear);

    if (isSameMonthDay(d, today)) {
      anniversaryRaw.push(m);
    } else if (diff >= NEARBY_MIN_DIFF && diff <= NEARBY_MAX_DIFF) {
      nearbyRaw.push(m);
    }

    // thisMonth uses the normalised month so it is year-invariant.
    if (normaliseDate(d).getMonth() === normaliseDate(today).getMonth()) {
      thisMonthRaw.push(m);
    }
  }

  // ─── Sort each raw bucket before deduplication ───────────────────────────

  const anniversarySorted = sortDesc(anniversaryRaw);
  const nearbySorted = sortDesc(nearbyRaw);
  const thisMonthSorted = sortDesc(thisMonthRaw);

  // ─── Hierarchical deduplication (anniversary > nearby > thisMonth > random)
  // Also exclude the Layer 1 highlight so it never appears twice on screen.

  const usedIds = new Set<string>();
  if (excludeId) usedIds.add(excludeId);

  const dedupe = (list: DiscoveryMemory[]): DiscoveryMemory[] =>
    list.filter((m) => {
      if (usedIds.has(m.id)) return false;
      usedIds.add(m.id);
      return true;
    });

  const anniversary = dedupe(anniversarySorted).slice(0, BUCKET_LIMIT);
  const nearby = dedupe(nearbySorted).slice(0, BUCKET_LIMIT);
  const thisMonth = dedupe(thisMonthSorted).slice(0, BUCKET_LIMIT);

  // Random: everything still in the valid pool after the above buckets.
  const remaining = valid.filter((m) => !usedIds.has(m.id));
  const random = seededShuffle(remaining, seed).slice(0, BUCKET_LIMIT);

  return { anniversary, nearby, thisMonth, random };
};