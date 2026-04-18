import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
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

export interface Memory {
  id: string;
  type: 'text' | 'image';
  text: string;
  imageURL: string | null;
  createdBy: string;
  createdAt: Timestamp | null;
  memoryDate: Timestamp | null;
  reactions: Record<string, string>; // { userId: emoji }
  viewedBy: string[]; // List of userIds who viewed this memory
}

/**
 * Adds a memory (text or image) to a specific vault.
 * Hardened for production: ensures only valid schemas are saved.
 */
export async function addMemory(
  vaultId: string, 
  payload: Omit<Memory, 'id' | 'createdAt' | 'reactions' | 'viewedBy'>
) {
  // Defensive validation: Never allow empty text-only memories
  if (payload.type === 'text' && !payload.text.trim()) {
    throw new Error("Memory text cannot be empty");
  }

  const memoriesRef = collection(db, 'vaults', vaultId, 'memories');
  
  return await addDoc(memoriesRef, {
    type: payload.type,
    text: payload.text.trim(),
    imageURL: payload.imageURL || null,
    createdBy: payload.createdBy,
    createdAt: serverTimestamp(),
    memoryDate: payload.memoryDate ?? serverTimestamp(),
    viewedBy: [], // Initialize as empty for new memories
  });
}

/**
 * Hardened mapping function to safely transform Firestore docs to the Memory interface.
 * Ensures the app never crashes from malformed or missing legacy data.
 */
function mapMemoryDoc(doc: any): Memory {
  const data = doc.data();
  
  return {
    id: doc.id,
    
    type: data.type === 'image' ? 'image' : 'text',
    
    text: typeof data.text === 'string'
      ? data.text
      : '',
      
    imageURL: typeof data.imageURL === 'string'
      ? data.imageURL
      : null,
      
    createdBy: typeof data.createdBy === 'string'
      ? data.createdBy
      : '',
      
    createdAt: 
      data.createdAt && typeof data.createdAt.seconds === 'number'
        ? data.createdAt as Timestamp
        : null,

    memoryDate:
      data.memoryDate && typeof data.memoryDate.seconds === 'number'
        ? data.memoryDate as Timestamp
        : null,

    reactions:
      data.reactions && typeof data.reactions === 'object'
        ? data.reactions as Record<string, string>
        : {},
    
    viewedBy: Array.isArray(data.viewedBy)
      ? data.viewedBy
      : [],
  };
}

/**
 * Toggles an emoji reaction for a user on a specific memory.
 * Uses a Firestore transaction for atomic safe-updates.
 */
export async function toggleReaction(
  vaultId: string,
  memoryId: string,
  userId: string,
  emoji: string
) {
  const memoryRef = doc(db, 'vaults', vaultId, 'memories', memoryId);

  try {
    await runTransaction(db, async (transaction) => {
      const memoryDoc = await transaction.get(memoryRef);
      if (!memoryDoc.exists()) {
        throw new Error("Memory does not exist!");
      }

      const data = memoryDoc.data();
      // Clone reactions to avoid direct mutation
      const reactions = { ...(data.reactions || {}) };

      if (reactions[userId] === emoji) {
        delete reactions[userId];
      } else {
        reactions[userId] = emoji;
      }

      transaction.update(memoryRef, { reactions });
    });
  } catch (err) {
    console.error("Transaction failed: ", err);
    throw err;
  }
}


/**
 * Subscribes to real-time updates for memories in a specific vault.
 */
export function subscribeToMemories(
  vaultId: string, 
  onUpdate: (memories: Memory[]) => void,
  onError?: (error: any) => void
) {
  const memoriesRef = collection(db, 'vaults', vaultId, 'memories');
  
  // NOTE:
  // This is basic pagination (limit only).
  // Does NOT support load-more or infinite scroll.
  // Future implementation should use startAfter(cursor).
  const q = query(
    memoriesRef, 
    orderBy('memoryDate', 'desc'),
    limit(15)
  );

  return onSnapshot(q, (snapshot) => {
    const memories = snapshot.docs.map(mapMemoryDoc);
    onUpdate(memories);
  }, (error) => {
    console.error("Firestore Subscription Error:", error);
    if (onError) onError(error);
  });
}

/**
 * Marks a memory as viewed by a specific user.
 * FAIL SAFE: Treats view tracking as a non-critical feature.
 */
export async function markMemoryViewed(
  vaultId: string,
  memoryId: string,
  userId: string
) {
  try {
    const ref = doc(db, 'vaults', vaultId, 'memories', memoryId);

    await updateDoc(ref, {
      viewedBy: arrayUnion(userId),
    });
  } catch (error) {
    // Fail silently (non-critical feature)
    if (__DEV__) {
      console.log('view tracking failed', error);
    }
  }
}

/**
 * Subscribes to real-time updates for a single memory.
 * Returns null if the memory no longer exists.
 */
export function subscribeToMemory(
  vaultId: string, 
  memoryId: string, 
  onUpdate: (memory: Memory | null) => void
) {
  const memoryRef = doc(db, 'vaults', vaultId, 'memories', memoryId);

  return onSnapshot(memoryRef, (docSnap) => {
    if (!docSnap.exists()) {
      onUpdate(null);
      return;
    }

    onUpdate(mapMemoryDoc(docSnap));
  }, (error) => {
    console.error("Single Memory Subscription Error:", error);
  });
}
