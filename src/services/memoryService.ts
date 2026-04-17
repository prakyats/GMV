import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  orderBy, 
  serverTimestamp, 
  onSnapshot,
  Timestamp 
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
}

/**
 * Adds a memory (text or image) to a specific vault.
 * Hardened for production: ensures only valid schemas are saved.
 */
export async function addMemory(
  vaultId: string, 
  payload: Omit<Memory, 'id' | 'createdAt'>
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
  };
}

/**
 * Fetches all memories for a specific vault, sorted by creation date (newest first).
 */
export async function getMemories(vaultId: string): Promise<Memory[]> {
  const memoriesRef = collection(db, 'vaults', vaultId, 'memories');
  const q = query(memoriesRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(mapMemoryDoc);
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
  const q = query(memoriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const memories = snapshot.docs.map(mapMemoryDoc);
    onUpdate(memories);
  }, (error) => {
    console.error("Firestore Subscription Error:", error);
    if (onError) onError(error);
  });
}
