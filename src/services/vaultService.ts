import { 
  collection, 
  addDoc, 
  doc, 
  getDoc,
  updateDoc, 
  arrayUnion, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fetches all vaults associated with a specific user.
 * Includes safety checks for existence and sorts by creation date.
 */
export const getUserVaults = async (userId: string) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return [];
    }

    const vaultIds = userSnap.data()?.vaultIds || [];

    if (vaultIds.length === 0) {
      return [];
    }

    // Fetch all vault documents
    const vaultPromises = vaultIds.map((id: string) =>
      getDoc(doc(db, "vaults", id))
    );

    const vaultSnapshots = await Promise.all(vaultPromises);

    // Filter and map to usable data
    const vaults = vaultSnapshots
      .filter(doc => doc.exists())
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    // Sort by createdAt (newest first)
    vaults.sort((a: any, b: any) => 
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

    return vaults;
  } catch (error) {
    console.error("Error fetching vaults:", error);
    throw error;
  }
};


/**
 * Creates a new private memory vault and associates it with the user.
 * Includes a rollback mechanism to prevent "orphan" vaults if the user update fails.
 */
export const createVault = async (name: string, userId: string): Promise<string> => {
  let vaultRef = null;

  try {
    const trimmedName = name.trim();

    // 1. Validation
    if (trimmedName.length === 0) {
      throw new Error("Vault name required");
    }

    if (trimmedName.length > 50) {
      throw new Error("Vault name too long");
    }

    // 2. Step 1: Create vault document
    vaultRef = await addDoc(collection(db, "vaults"), {
      name: trimmedName,
      createdBy: userId,
      members: [userId],
      createdAt: serverTimestamp()
    });

    const vaultId = vaultRef.id;

    // 3. Step 2: Update user's vault list
    await updateDoc(doc(db, "users", userId), {
      vaultIds: arrayUnion(vaultId)
    });

    return vaultId;

  } catch (error) {
    // 4. CLEANUP: Rollback vault creation if user association failed
    if (vaultRef && vaultRef.id) {
      try {
        await deleteDoc(doc(db, "vaults", vaultRef.id));
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }
    }

    throw error;
  }
};
