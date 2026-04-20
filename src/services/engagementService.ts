import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

/**
 * Engagement stats stored on the user document.
 * isNewDay is a computed return value — not stored in Firestore.
 */
export interface EngagementStats {
  lastSeenDateKey: string | null;
  daysOpenedStreak: number;
  /** True only when the streak was incremented in THIS call (first open today). */
  isNewDay: boolean;
}

/** Returns today's date as YYYY-MM-DD in the device's local timezone. */
export const getTodayKey = (): string => {
  const d = new Date();
  // toISOString() returns UTC which can be a different calendar day from the
  // device's local time. Use local date parts instead for daily-streak accuracy.
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Returns yesterday's date as YYYY-MM-DD in the device's local timezone. */
export const getYesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Synchronises user engagement stats (streak + last-seen date).
 *
 * Write guard: if the user already opened the app today, reads the current
 * values from Firestore and returns them with isNewDay=false — no write.
 *
 * Streak logic:
 *   - First open ever         → streak = 1, isNewDay = true
 *   - Open on consecutive day → streak++,  isNewDay = true
 *   - Open after a gap        → streak = 1, isNewDay = true  (reset)
 *   - Already opened today    → streak unchanged, isNewDay = false
 *
 * Returns null on any Firestore error so the UI degrades gracefully.
 */
export const syncEngagementStats = async (userId: string): Promise<EngagementStats | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return null;

    const data         = snap.data();
    const lastSeen     = (data.lastSeenDateKey as string) || null;
    const streak       = (data.daysOpenedStreak as number) || 0;
    const todayKey     = getTodayKey();
    const yesterdayKey = getYesterdayKey();

    // Write guard: already opened today — return current values, isNewDay=false
    if (lastSeen === todayKey) {
      return {
        lastSeenDateKey:    todayKey,
        daysOpenedStreak:   streak,
        isNewDay:           false,
      };
    }

    // Increment streak if consecutive day, reset otherwise
    const newStreak = lastSeen === yesterdayKey ? streak + 1 : 1;

    await updateDoc(userRef, {
      lastSeenDateKey:  todayKey,
      daysOpenedStreak: newStreak,
    });

    return {
      lastSeenDateKey:  todayKey,
      daysOpenedStreak: newStreak,
      isNewDay:         true,  // streak was updated in this call
    };

  } catch (error) {
    return null;
  }
};