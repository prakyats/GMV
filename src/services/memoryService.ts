import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp,
  runTransaction,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';
export { db };

export interface Memory {
  id: string;
  type: 'text' | 'image';
  text: string;
  imageURL: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  createdAtClient: number | null;
  memoryDate: Timestamp | null;
  reactions: Record<string, string>;
  viewedBy: string[];
}

/**
 * WHY createdAtClient IS REMOVED FROM THE SORT
 * ─────────────────────────────────────────────
 * createdAtClient = Date.now() captured on the WRITING device.
 * When two different devices post memories, their clocks can differ by seconds
 * or even minutes. A "test" device whose clock is 30 seconds ahead will always
 * produce higher createdAtClient values than the current device, even if the
 * current device posted its memories AFTER the "test" device.
 *
 * Result: cross-device inserts become non-deterministically ordered depending
 * on whose device clock is faster — exactly the bug shown in the screenshots
 * (W V U T S from "test" appearing before Z Y X from "You", even though Z was
 * posted last chronologically).
 *
 * THE CORRECT SOURCE OF TRUTH IS Firestore's serverTimestamp (createdAt).
 * The server clock is authoritative, independent of any device clock.
 * createdAtClient is kept as a field (for potential future optimistic UI use)
 * but MUST NOT be used for cross-device sort comparisons.
 *
 * SORT ORDER: memoryDate (ns) → createdAt (ns) → document ID
 * All three are either server-assigned or truly unique, making this
 * deterministic regardless of which device wrote the document.
 */

/**
 * Extracts a nanosecond-precision sort key from a Firestore Timestamp.
 * Using seconds*1e9 + nanoseconds gives full Firestore precision instead of
 * lossy seconds-only, which causes instability on rapid same-second inserts
 * from the SAME device.
 */
function tsKey(ts: Timestamp | null): number {
  if (!ts) return 0;
  return ts.seconds * 1e9 + (ts.nanoseconds ?? 0);
}

/**
 * Deterministic comparator: newest memoryDate first.
 *
 * Level 1 — memoryDate (ns):   what date the user says the memory happened.
 * Level 2 — createdAt (ns):    server timestamp — authoritative cross-device clock.
 * Level 3 — document ID:       lexicographic, always unique, always stable.
 *
 * createdAtClient is intentionally NOT used here (see explanation above).
 */
export function compareMemories(a: Memory, b: Memory): number {
  // Level 1: memoryDate — primary sort axis
  const mdA = tsKey(a.memoryDate);
  const mdB = tsKey(b.memoryDate);
  if (mdB !== mdA) return mdB - mdA;

  // Level 2: createdAt (server timestamp) — authoritative for cross-device order
  const caA = tsKey(a.createdAt);
  const caB = tsKey(b.createdAt);
  if (caB !== caA) return caB - caA;

  // Level 3: document ID — always unique, perfectly stable
  return b.id.localeCompare(a.id);
}

/**
 * Merges two memory arrays by ID (deduplication), then sorts with compareMemories.
 * incoming items overwrite existing ones — critical so reaction updates propagate.
 * Used by both the real-time and pagination layers in VaultDetailScreen.
 */
export function mergeAndSort(existing: Memory[], incoming: Memory[]): Memory[] {
  const map = new Map<string, Memory>();
  existing.forEach(m => map.set(m.id, m));
  incoming.forEach(m => map.set(m.id, m)); // incoming overwrites — always fresher
  return Array.from(map.values()).sort(compareMemories);
}

/**
 * Adds a memory to a vault.
 * Still writes createdAtClient = Date.now() to the document — kept for
 * potential future use (e.g. optimistic UI within a single device session).
 * It is NOT used in compareMemories.
 */
export async function addMemory(
  vaultId: string,
  payload: Omit<Memory, 'id' | 'createdAt' | 'reactions' | 'viewedBy' | 'createdAtClient'>
) {
  if (payload.type === 'text' && !payload.text.trim()) {
    throw new Error("Memory text cannot be empty");
  }

  return await addDoc(collection(db, 'vaults', vaultId, 'memories'), {
    type: payload.type,
    text: payload.text.trim(),
    imageURL: payload.imageURL || null,
    createdBy: payload.createdBy,
    createdByName: payload.createdByName ?? 'Member',
    createdAt: serverTimestamp(),        // authoritative server clock
    createdAtClient: Date.now(),         // kept but not used for sorting
    memoryDate: payload.memoryDate ?? serverTimestamp(),
    viewedBy: [],
  });
}

/**
 * Maps a Firestore snapshot to a typed Memory.
 * Every field has a safe fallback — app never crashes on malformed data.
 */
export function mapMemoryDoc(docSnap: any): Memory {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    type: data.type === 'image' ? 'image' : 'text',
    text: typeof data.text === 'string' ? data.text : '',
    imageURL: typeof data.imageURL === 'string' ? data.imageURL : null,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : 'Member',

    createdAt:
      data.createdAt && typeof data.createdAt.seconds === 'number'
        ? (data.createdAt as Timestamp)
        : null,

    createdAtClient:
      typeof data.createdAtClient === 'number'
        ? data.createdAtClient
        : null,

    memoryDate:
      data.memoryDate && typeof data.memoryDate.seconds === 'number'
        ? (data.memoryDate as Timestamp)
        : data.createdAt
          ? (data.createdAt as Timestamp)
          : null,

    reactions:
      data.reactions && typeof data.reactions === 'object' && !Array.isArray(data.reactions)
        ? (data.reactions as Record<string, string>)
        : {},

    viewedBy: Array.isArray(data.viewedBy) ? data.viewedBy : [],
  };
}

/**
 * Toggles a reaction emoji atomically using a Firestore transaction.
 */
export async function toggleReaction(
  vaultId: string,
  memoryId: string,
  userId: string,
  emoji: string
) {
  const memoryRef = doc(db, 'vaults', vaultId, 'memories', memoryId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(memoryRef);
    if (!snap.exists()) throw new Error("Memory does not exist!");

    const reactions = { ...(snap.data().reactions || {}) };
    if (reactions[userId] === emoji) {
      delete reactions[userId];
    } else {
      reactions[userId] = emoji;
    }

    transaction.update(memoryRef, { reactions });
  });
}

/**
 * Real-time subscription: latest limitCount memories ordered by server.
 * Passes the raw snapshot to the caller for stable cursor initialisation.
 *
 * Requires a composite Firestore index: memoryDate DESC, createdAt DESC.
 * If you see an index error in the console, click the auto-generated link
 * in the error message to create it in one click.
 */
export function subscribeToMemories(
  vaultId: string,
  onUpdate: (memories: Memory[], snapshot: any) => void,
  limitCount: number = 15,
  onError?: (error: any) => void
) {
  const q = query(
    collection(db, 'vaults', vaultId, 'memories'),
    orderBy('memoryDate', 'desc'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapMemoryDoc), snapshot);
  }, (error) => {
    console.error("Firestore Subscription Error:", error);
    if (onError) onError(error);
  });
}

/**
 * Marks a memory as viewed. Non-critical — fails silently.
 */
export async function markMemoryViewed(
  vaultId: string,
  memoryId: string,
  userId: string
) {
  try {
    await updateDoc(doc(db, 'vaults', vaultId, 'memories', memoryId), {
      viewedBy: arrayUnion(userId),
    });
  } catch (error) {
  }
}

/**
 * Subscribes to a single memory in real-time.
 * Calls onUpdate(null) if the memory is deleted while being viewed.
 */
export function subscribeToMemory(
  vaultId: string,
  memoryId: string,
  onUpdate: (memory: Memory | null) => void
) {
  return onSnapshot(
    doc(db, 'vaults', vaultId, 'memories', memoryId),
    (snap) => onUpdate(snap.exists() ? mapMemoryDoc(snap) : null),
    (error) => console.error("Single Memory Subscription Error:", error)
  );
}