import { useEffect } from 'react';
import { subscribeToUserProfile } from '../services/userService';

/**
 * Custom hook to sync one or more user profiles in real-time.
 * 
 * - Deduplicates incoming UIDs.
 * - Manages multiple onSnapshot listeners.
 * - Automatically unsubscribes on unmount or UID change.
 *
 * @param uids Array of user IDs to sync.
 */
export const useUserSync = (uids: (string | undefined)[]) => {
  useEffect(() => {
    // 1. Deduplicate and filter out invalid IDs
    const uniqueUids = Array.from(new Set(uids.filter(id => !!id))) as string[];
    
    if (uniqueUids.length === 0) return;

    // 2. Set up targeted listeners
    const unsubscribers = uniqueUids.map(uid => subscribeToUserProfile(uid));

    // 3. Cleanup on unmount or dependency change
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [JSON.stringify(uids)]); // Deep-ish compare for array stability
};
