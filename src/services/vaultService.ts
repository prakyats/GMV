import { 
  collection, 
  addDoc, 
  doc, 
  getDoc,
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  deleteDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  runTransaction 
} from 'firebase/firestore';
import { db } from './firebase';
import { generateInviteCode } from '../utils/inviteCode';

/**
 * Fetches all vaults associated with a specific user.
 * PRODUCTION-SAFE: classification between deleted, forbidden, and valid docs.
 * SELF-HEALING: Cleans up orphaned references if doc NO LONGER exists.
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

    // STEP 1: Parallel Fetch with Classification
    const results = await Promise.all(
      vaultIds.map(async (vaultId: string) => {
        try {
          const ref = doc(db, 'vaults', vaultId);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            return { type: 'deleted', vaultId };
          }

          // MAP VALID DATA
          const data = snap.data();
          return { 
            type: 'valid', 
            data: {
              id: snap.id,
              name: data?.name,
              inviteCode: data?.inviteCode,
              createdAt: data?.createdAt,
              members: data?.members || []
            } 
          };

        } catch (error: any) {
          if (error.code === 'permission-denied') {
            return { type: 'deleted', vaultId };
          }
          console.error(`Vault fetch error [${vaultId}]:`, error);
          return { type: 'error' };
        }
      })
    );

    // STEP 2: Separate Results
    const validVaults: any[] = [];
    const deletedVaultIds: string[] = [];

    results.forEach(item => {
      if (item.type === 'valid' && item.data) {
        validVaults.push(item.data);
      }
      if (item.type === 'deleted' && item.vaultId) {
        deletedVaultIds.push(item.vaultId);
      }
    });

    // STEP 3: Safe Cleanup (Production-Stable)
    if (deletedVaultIds.length > 0) {
      try {
        // MUST await for reliability, inside a try/catch to not block UI success
        await updateDoc(userRef, {
          vaultIds: arrayRemove(...deletedVaultIds)
        });

        if (__DEV__) {
          console.log('Deleted vaults cleaned:', deletedVaultIds);
        }
      } catch (error) {
        if (__DEV__) {
          console.log('Vault cleanup failed safely:', error);
        }
      }
    }

    // STEP 4: Return valid data sorted by date
    validVaults.sort((a, b) => 
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

    return validVaults;

  } catch (error) {
    console.error("Critical error in getUserVaults:", error);
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

    // 2. Step 1: Generate + validate inviteCode BEFORE database write
    let inviteCode = generateInviteCode();
    let exists = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (exists && attempts < MAX_ATTEMPTS) {
      if (__DEV__) {
        console.log(`Checking invite code uniqueness [Attempt ${attempts + 1}]:`, inviteCode);
      }
      
      const snapshot = await getDocs(
        query(
          collection(db, "vaults"), 
          where("inviteCode", "==", inviteCode),
          limit(1)
        )
      );
      exists = !snapshot.empty;
      if (exists) {
        inviteCode = generateInviteCode();
      }
      attempts++;
    }

    if (exists) {
      throw new Error("Failed to generate unique invite code");
    }

    // 3. Step 2: Create vault document
    console.log('CREATE VAULT PAYLOAD:', {
      name: trimmedName,
      inviteCode,
      members: [userId],
      createdBy: userId,
      createdAt: 'serverTimestamp()' // Placeholder for logging
    });

    vaultRef = await addDoc(collection(db, "vaults"), {
      name: trimmedName,
      createdBy: userId,
      members: [userId],
      inviteCode,
      createdAt: serverTimestamp()
    });

    const vaultId = vaultRef.id;

    // 3. Step 2: Update user's vault list
    await updateDoc(doc(db, "users", userId), {
      vaultIds: arrayUnion(vaultId)
    });

    return vaultId;

  } catch (error: any) {
    console.log('VAULT CREATE ERROR:', error.code, error.message);
    
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

/**
 * Joins an existing vault using a 6-character invite code.
 * Includes a manual rollback for the vault membership if the user record update fails.
 */
export const joinVault = async (inviteCode: string, userId: string) => {
  try {
    const trimmedCode = inviteCode.trim();

    // 1. Validation
    if (trimmedCode.length !== 6) {
      throw new Error("Invalid invite code");
    }

    // 2. Find Vault
    if (__DEV__) {
      console.log('JOIN VAULT: Searching for invite code:', trimmedCode);
    }
    
    const q = query(
      collection(db, "vaults"),
      where("inviteCode", "==", trimmedCode),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error("Vault not found");
    }

    // 3. Extract Data
    const vaultDoc = snapshot.docs[0];
    const vaultId = vaultDoc.id;
    const data = vaultDoc.data();

    // 4. Safety Check
    if (!Array.isArray(data.members)) {
      throw new Error("Invalid vault data");
    }

    // 5. Check Membership
    if (data.members.includes(userId)) {
      throw new Error("Already a member");
    }

    // 6. Update Vault First
    await updateDoc(doc(db, "vaults", vaultId), {
      members: arrayUnion(userId)
    });

    // 7. Update User
    try {
      await updateDoc(doc(db, "users", userId), {
        vaultIds: arrayUnion(vaultId)
      });
    } catch (err) {
      // Rollback vault membership safely
      await updateDoc(doc(db, "vaults", vaultId), {
        members: arrayRemove(userId)
      });
      throw new Error("Failed to join vault");
    }

    return { vaultId };

  } catch (error: any) {
    console.log('JOIN VAULT ERROR:', error.code, error.message);
    
    const mappedMessages = ["Invalid invite code", "Vault not found", "Already a member", "Failed to join vault"];
    if (mappedMessages.includes(error.message)) {
      throw error;
    }
    throw new Error("Failed to join vault");
  }
};

/**
 * Safely removes a user from a vault document and the vault from the user document.
 * If the user is the last member, the vault document is deleted.
 * USES: Firestore Transaction for atomicity.
 */
export const leaveVault = async (vaultId: string, userId: string) => {
  const vaultRef = doc(db, 'vaults', vaultId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Fetch vault state
      const vaultSnap = await transaction.get(vaultRef);
      if (!vaultSnap.exists()) {
        throw new Error('Vault does not exist');
      }

      const vaultData = vaultSnap.data();
      const members: string[] = vaultData.members || [];

      // 2. Validate membership
      if (!members.includes(userId)) {
        throw new Error('User is not a member of this vault');
      }

      // 3. Calculate new member list
      const updatedMembers = members.filter(id => id !== userId);

      // 4. Update Vault: Delete if empty, otherwise remove user
      if (updatedMembers.length === 0) {
        transaction.delete(vaultRef);
      } else {
        transaction.update(vaultRef, {
          members: updatedMembers,
        });
      }

      // 5. Update User: Always remove vault link
      transaction.update(userRef, {
        vaultIds: arrayRemove(vaultId),
      });
    });
  } catch (error) {
    console.error("Leave Vault Transaction Failed:", error);
    throw error;
  }
};
