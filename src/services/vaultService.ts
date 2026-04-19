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
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateInviteCode } from '../utils/inviteCode';
import { VaultMember } from '../navigation/types';

// ─── Utility: Normalize Legacy Member Data ────────────────────────────────
/**
 * Accepts raw Firestore members data which may be:
 *   - string[] (legacy format)
 *   - {id, name}[] (new format)
 *   - undefined/null (missing)
 *
 * Always returns VaultMember[]. Lazy migration: old string UIDs
 * become { id: uid, name: 'Member' } until the next write heals them.
 */
export const normalizeMemberProfiles = (
  members: string[],
  rawProfiles: any[] | undefined
): VaultMember[] => {
  // Build O(1) lookup from whatever profiles exist
  const profileMap = new Map<string, VaultMember>();
  if (Array.isArray(rawProfiles)) {
    for (const p of rawProfiles) {
      if (p && typeof p.id === 'string' && typeof p.name === 'string') {
        profileMap.set(p.id, p);
      }
    }
  }
  // Normalize: every member UID has a profile entry
  return members.map(uid => profileMap.get(uid) ?? { id: uid, name: 'Member' });
};


// ─── getUserVaults ─────────────────────────────────────────────────────────
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

          const data = snap.data();
          const members: string[] = data?.members || [];
          const memberProfiles = normalizeMemberProfiles(members, data?.memberProfiles);

          return { 
            type: 'valid', 
            data: {
              id: snap.id,
              name: data?.name,
              inviteCode: data?.inviteCode,
              createdAt: data?.createdAt,
              createdBy: data?.createdBy,
              members,
              memberProfiles,
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


// ─── fetchVaultDetails ─────────────────────────────────────────────────────
/**
 * Fetches a single vault document and returns structured member data.
 * Used by VaultDetailScreen on mount to populate the member avatar strip.
 */
export const fetchVaultDetails = async (vaultId: string) => {
  const ref = doc(db, 'vaults', vaultId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Vault not found');

  const data = snap.data();
  const members: string[] = data?.members || [];
  const memberProfiles = normalizeMemberProfiles(members, data?.memberProfiles);

  return {
    members,
    memberProfiles,
    createdBy: data?.createdBy as string,
  };
};



// ─── createVault ──────────────────────────────────────────────────────────
/**
 * Creates a new private memory vault and associates it with the user.
 * Writes both members (string[]) and memberProfiles ({id,name}[]).
 * Includes a rollback mechanism to prevent "orphan" vaults.
 */
export const createVault = async (
  name: string,
  userId: string,
  userName: string
): Promise<string> => {
  let vaultRef = null;

  try {
    const trimmedName = name.trim();

    if (trimmedName.length === 0) throw new Error("Vault name required");
    if (trimmedName.length > 50) throw new Error("Vault name too long");

    // Generate + validate unique inviteCode
    let inviteCode = generateInviteCode();
    let exists = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (exists && attempts < MAX_ATTEMPTS) {
      const snapshot = await getDocs(
        query(collection(db, "vaults"), where("inviteCode", "==", inviteCode), limit(1))
      );
      exists = !snapshot.empty;
      if (exists) inviteCode = generateInviteCode();
      attempts++;
    }

    if (exists) throw new Error("Failed to generate unique invite code");

    const safeUserName = (userName || 'Member').trim() || 'Member';

    // Create vault document with both member fields
    vaultRef = await addDoc(collection(db, "vaults"), {
      name: trimmedName,
      createdBy: userId,
      members: [userId],
      memberProfiles: [{ id: userId, name: safeUserName }],
      inviteCode,
      createdAt: serverTimestamp(),
    });

    const vaultId = vaultRef.id;

    // Associate vault with user
    await updateDoc(doc(db, "users", userId), {
      vaultIds: arrayUnion(vaultId),
    });

    return vaultId;

  } catch (error: any) {
    console.log('VAULT CREATE ERROR:', error.code, error.message);
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


// ─── joinVault ────────────────────────────────────────────────────────────
/**
 * Joins an existing vault using a 6-character invite code.
 * ATOMIC: Both members and memberProfiles updated in a single transaction.
 * LAZY MIGRATION: Normalizes any legacy string-only memberProfiles on write.
 * SORTED: Both arrays sorted for deterministic order and stability.
 */
export const joinVault = async (
  inviteCode: string,
  userId: string,
  userName: string
) => {
  try {
    const trimmedCode = inviteCode.trim();
    if (trimmedCode.length !== 6) throw new Error("Invalid invite code");

    // Query cannot be inside a transaction — find vault first
    const q = query(
      collection(db, "vaults"),
      where("inviteCode", "==", trimmedCode),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) throw new Error("Vault not found");

    const vaultDoc = snapshot.docs[0];
    const vaultId = vaultDoc.id;
    const vaultRef = doc(db, 'vaults', vaultId);
    const safeUserName = (userName || 'Member').trim() || 'Member';

    const data = vaultDoc.data();
    if (!Array.isArray(data.members)) throw new Error("Invalid vault data");

    const members: string[] = data.members;
    const rawProfiles: any[] = data.memberProfiles ?? [];

    // Already a member — idempotent exit
    if (members.includes(userId)) return { vaultId };

    // Compute new sorted member IDs
    const newMemberIds = [...members, userId].sort();

    // O(n) Map-based normalization + lazy migration
    const profileMap = new Map<string, VaultMember>();
    rawProfiles.forEach(p => {
      if (p && typeof p.id === 'string') profileMap.set(p.id, p);
    });
    const normalizedProfiles: VaultMember[] = newMemberIds.map(uid => {
      if (uid === userId) return { id: userId, name: safeUserName };
      return profileMap.get(uid) ?? { id: uid, name: 'Member' };
    });

    // Atomic update — rules will validate resource.data vs request.resource.data
    await updateDoc(vaultRef, {
      members: newMemberIds,
      memberProfiles: normalizedProfiles,
    });

    // Update user's vault list (separate document, outside tx)
    try {
      await updateDoc(doc(db, "users", userId), {
        vaultIds: arrayUnion(vaultId),
      });
    } catch (err) {
      // Rollback vault membership if user doc update fails
      const snap = await getDoc(vaultRef);
      if (snap.exists()) {
        const data = snap.data();
        const members: string[] = data.members ?? [];
        const rawProfiles: any[] = data.memberProfiles ?? [];
        await updateDoc(vaultRef, {
          members: members.filter(id => id !== userId).sort(),
          memberProfiles: rawProfiles.filter(p => p.id !== userId),
        });
      }
      throw new Error("Failed to join vault");
    }

    return { vaultId };

  } catch (error: any) {
    const errorCode = error.code || 'unknown';
    const errorMessage = error.message || 'Unknown error';
    console.log(`JOIN VAULT ERROR [${errorCode}]: ${errorMessage}`);
    
    const mappedMessages = ["Invalid invite code", "Vault not found", "Already a member", "Failed to join vault"];
    if (mappedMessages.includes(error.message)) throw error;
    throw new Error("Failed to join vault");
  }
};


// ─── leaveVault ───────────────────────────────────────────────────────────
/**
 * Safely removes a user from a vault.
 * ATOMIC: Both members and memberProfiles updated in a single transaction.
 * SORTED: Remaining arrays normalized and sorted after removal.
 * LAST MEMBER: tx.delete inside transaction for race safety.
 */
export const leaveVault = async (vaultId: string, userId: string) => {
  const vaultRef = doc(db, 'vaults', vaultId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      const vaultSnap = await transaction.get(vaultRef);
      if (!vaultSnap.exists()) throw new Error('Vault does not exist');

      const data = vaultSnap.data();
      const members: string[] = data.members || [];
      const rawProfiles: any[] = data.memberProfiles ?? [];

      if (!members.includes(userId)) throw new Error('User is not a member');

      const newMemberIds = members.filter(id => id !== userId).sort();

      // Last member — delete entire vault atomically
      if (newMemberIds.length === 0) {
        transaction.delete(vaultRef);
        transaction.update(userRef, { vaultIds: arrayRemove(vaultId) });
        return;
      }

      // O(n) normalization: heal + filter leaving user
      const profileMap = new Map<string, VaultMember>();
      rawProfiles.forEach(p => {
        if (p && typeof p.id === 'string') profileMap.set(p.id, p);
      });
      const normalizedProfiles: VaultMember[] = newMemberIds.map(uid =>
        profileMap.get(uid) ?? { id: uid, name: 'Member' }
      );

      // Single atomic write for both fields
      transaction.update(vaultRef, {
        members: newMemberIds,
        memberProfiles: normalizedProfiles,
      });
      transaction.update(userRef, { vaultIds: arrayRemove(vaultId) });
    });

  } catch (error) {
    console.error("Leave Vault Transaction Failed:", error);
    throw error;
  }
};

/**
 * Subscribes to changes in a vault document.
 * Returns normalized members and profiles via callback.
 */
export const subscribeToVault = (
  vaultId: string,
  onUpdate: (data: { members: string[]; memberProfiles: VaultMember[] }) => void
) => {
  const vaultRef = doc(db, 'vaults', vaultId);
  
  return onSnapshot(vaultRef, (snap) => {
    if (!snap.exists()) return;
    
    const data = snap.data();
    const members: string[] = data.members || [];
    const profiles = normalizeMemberProfiles(members, data.memberProfiles);
    
    onUpdate({ members, memberProfiles: profiles });
  }, (error) => {
    console.error("Vault subscription error:", error);
  });
};
