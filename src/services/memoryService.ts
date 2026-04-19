import {
  collection,
  collectionGroup,
  getDocs,
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
  arrayUnion,
  getDoc,
  where,
  deleteField
} from 'firebase/firestore';
import { db } from './firebase';
import { getUserVaults } from './vaultService';
export { db };

import { Memory, FirestoreTimestamp } from '../navigation/types';
export { Memory };

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
function tsKey(ts: FirestoreTimestamp | null): number {
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

export async function addMemory(
  vaultId: string,
  payload: Omit<Memory, 'id' | 'createdAt' | 'reactions' | 'viewedBy' | 'contributorCount'> & { members: string[] }
) {
  // PHASE 1 — THE SENTINEL (STRICT VALIDATION)
  if (!payload.createdBy || typeof payload.createdBy !== 'object') {
    throw new Error("Invalid attribution object");
  }
  
  if (!['text', 'image'].includes(payload.type)) {
    throw new Error("Invalid memory type");
  }

  const finalCaption = payload.caption.trim();
  if (!finalCaption) {
    throw new Error("Memory caption cannot be empty");
  }
  if (finalCaption.length >= 500) {
    throw new Error("Caption exceeds 500 characters");
  }

  if (payload.type === 'image') {
    if (!payload.imageURL || typeof payload.imageURL !== 'string' || payload.imageURL.trim() === '') {
      throw new Error("Valid image URL is required for image memories");
    }
  }

  if (!payload.memoryDate) {
    throw new Error("Memory date is required");
  }

  if (!Array.isArray(payload.members) || payload.members.length === 0) {
    throw new Error("Invalid members list from vault");
  }

  if (!payload.members.includes(payload.createdBy.id)) {
    throw new Error("User must be a member of this vault to post");
  }

  if (!payload.createdBy.name || payload.createdBy.name.trim() === '') {
    throw new Error("User name is required for attribution");
  }

  // PHASE 2 — THE ARCHITECT (REFERENCE-ISOLATED CONSTRUCTION)
  const finalPayload = {
    type: payload.type,
    caption: finalCaption,
    imageURL: payload.type === 'text' ? null : (payload.imageURL as string).trim(),
    
    createdBy: {
      id: payload.createdBy.id,
      name: payload.createdBy.name.trim(),
    },

    createdAt: serverTimestamp(),
    memoryDate: payload.memoryDate,

    members: [...payload.members], // CLONE TO ENSURE IMMUTABILITY
    viewedBy: [],
    reactions: {},
  };

  if (__DEV__) {
    console.log('[DEBUG] Hardened Memory Payload:', finalPayload);
  }

  // PHASE 3 — THE EXECUTOR (CLEAN WRITE)
  return await addDoc(collection(db, 'vaults', vaultId, 'memories'), finalPayload);
}

/**
 * Maps a Firestore snapshot to a typed Memory.
 * Every field has a safe fallback — app never crashes on malformed data.
 */
export function mapMemoryDoc(docSnap: any): Memory {
  const d = docSnap.data();

  // ATTRIBUTION NORMALIZATION
  let createdBy: { id: string; name: string };
  if (typeof d.createdBy === 'object' && d.createdBy !== null) {
    createdBy = {
      id: d.createdBy.id || 'unknown',
      name: d.createdBy.name || 'Member',
    };
  } else {
    // Migration fallback for legacy non-object attribution
    createdBy = {
      id: d.createdBy || 'unknown',
      name: 'Member',
    };
  }

  return {
    id: docSnap.id,
    type: d.type === 'image' ? 'image' : 'text',
    
    // READ FALLBACK: support both new schema (caption) and legacy (text)
    caption: d.caption || d.text || '',
    
    imageURL: typeof d.imageURL === 'string' ? d.imageURL : null,
    
    createdBy,

    createdAt:
      d.createdAt && typeof d.createdAt.seconds === 'number'
        ? (d.createdAt as any)
        : null,

    memoryDate:
      d.memoryDate && typeof d.memoryDate.seconds === 'number'
        ? (d.memoryDate as any)
        : d.createdAt
          ? (d.createdAt as any)
          : null,

    reactions:
      d.reactions && typeof d.reactions === 'object' && !Array.isArray(d.reactions)
        ? (d.reactions as Record<string, string>)
        : {},

    viewedBy: Array.isArray(d.viewedBy) ? d.viewedBy : [],
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
  const ref = doc(db, 'vaults', vaultId, 'memories', memoryId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Memory not found");

    const data = snap.data();

    // CLEAN reactions
    const raw = data.reactions || {};
    const current: Record<string, string> = {};

    Object.keys(raw).forEach((k) => {
      if (typeof raw[k] === 'string') {
        current[k] = raw[k];
      }
    });

    // APPLY TOGGLE
    if (current[userId] === emoji) {
      delete current[userId];
    } else {
      current[userId] = emoji;
    }

    // WRITE (transaction handles concurrency automatically)
    tx.update(ref, {
      reactions: current
    });
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

/**
 * One-off fetch for a single memory.
 * Useful for focal refreshes without attaching a live listener.
 */
export async function getMemoryById(vaultId: string, memoryId: string): Promise<Memory | null> {
  try {
    const snap = await getDoc(doc(db, 'vaults', vaultId, 'memories', memoryId));
    return snap.exists() ? mapMemoryDoc(snap) : null;
  } catch (err) {
    console.error("Fetch Memory Error:", err);
    return null;
  }
}

/**
 * Public-facing fetch for deep link previews.
 * Fetches only non-sensitive metadata for curiosity hooks.
 */
export async function getPublicMemoryPreview(vaultId: string, memoryId: string) {
  try {
    const snap = await getDoc(doc(db, 'vaults', vaultId, 'memories', memoryId));
    if (!snap.exists()) return null;
    
    const data = snap.data();
    return {
      id: snap.id,
      caption: data.caption || data.text || "",
      imageURL: data.imageURL || null,
      reactionCount: Object.keys(data.reactions || {}).length,
    };
  } catch (err) {
    console.error("Public Preview Fetch Error:", err);
    return null;
  }
}

/**
 * Hybrid Global Fetch: All memories cross-vault.
 * Supports:
 * 1. New Memories (via efficient collectionGroup + members filter)
 * 2. Old Memories (via parallel hierarchical fallback)
 * 
 * Guarantees zero data loss during architectural transition.
 */
export async function getAllUserMemories(userId: string) {
  try {
    // 1. Get List of User Contexts
    const vaults = await getUserVaults(userId);
    const vaultIds = vaults.map(v => v.id);

    // 2. Track A: NEW (Scoped Collection Group)
    const newQuery = query(
      collectionGroup(db, 'memories'),
      where('members', 'array-contains', userId),
      orderBy('memoryDate', 'desc')
    );
    const newSnapPromise = getDocs(newQuery);

    // 3. Track B: OLD (Parallel Hierarchical Crawl)
    const legacyPromises = vaultIds.map(vId => 
      getDocs(collection(db, 'vaults', vId, 'memories'))
    );

    // 4. Parallel Await
    const [newSnap, ...legacySnaps] = await Promise.all([newSnapPromise, ...legacyPromises]);

    // 5. Normalization & Context Injection
    const map = new Map<string, Memory & { vaultId: string }>();

    // Process Track A
    newSnap.docs.forEach(docSnap => {
      const memory = mapMemoryDoc(docSnap);
      map.set(memory.id, {
        ...memory,
        vaultId: docSnap.ref.parent.parent?.id || ''
      });
    });

    // Process Track B
    legacySnaps.forEach((snap, idx) => {
      const vaultId = vaultIds[idx];
      snap.docs.forEach(docSnap => {
        const memory = mapMemoryDoc(docSnap);
        map.set(memory.id, {
          ...memory,
          vaultId
        });
      });
    });

    // 6. Deterministic Join & Stability Sort
    return Array.from(map.values()).sort(compareMemories);

  } catch (err) {
    console.error("Hybrid Global Fetch Error:", err);
    return [];
  }
}