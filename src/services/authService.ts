import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  AuthError
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { getUserVaults, leaveVault } from './vaultService';
import { registerForPushNotifications, savePushToken } from './notificationService';

/**
 * Internal helper to register the device and save the token to Firestore.
 */
const registerAndSaveToken = async (userId: string) => {
  try {
    const token = await registerForPushNotifications();
    if (token) {
      await savePushToken(userId, token);
    }
  } catch (error) {
    console.error('Push notification registration failed:', error);
  }
};

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
const mapAuthError = (error: AuthError): string => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Email already exists';
    case 'auth/invalid-email':
      return 'Invalid email format';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters';
    case 'auth/user-not-found':
      return 'User not found';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/invalid-credential':
      return 'Invalid credentials. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

export const authService = {
  /**
   * Registers a new user with email and password.
   */
  register: async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ✅ Set displayName in Firebase Auth (CRITICAL)
      await updateProfile(user, {
        displayName: name.trim(),
      });

      // ✅ Force reload to pick up the new name (CRITICAL)
      await user.reload();

      // Create user document in Firestore (Redundant but kept for metadata)
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: name.trim(),
        photoURL: null,
        vaultIds: [],
        createdAt: serverTimestamp(),
      });

      // ✅ Update store immediately for instant UI response (CRITICAL)
      useAuthStore.getState().setUser({
        uid: user.uid,
        displayName: user.displayName?.trim() || null,
        email: user.email?.trim() || null,
        photoURL: user.photoURL || null,
      });

      // Final Step: Register and save push token
      await registerAndSaveToken(user.uid);
    } catch (error) {
      throw new Error(mapAuthError(error as AuthError));
    }
  },


  /**
   * Logs in an existing user with email and password.
   */
  login: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Register and save push token upon successful login
      await registerAndSaveToken(userCredential.user.uid);
    } catch (error) {
      throw new Error(mapAuthError(error as AuthError));
    }
  },

  /**
   * Signs out the currently authenticated user.
   */
  logout: async () => {
    try {
      useVaultStore.getState().clearVault();
      await signOut(auth);
    } catch (error) {
      throw new Error('Failed to logout. Please try again.');
    }
  },

  /**
   * Re-authenticates the current user using email and password.
   * Required by Firebase for sensitive operations like account deletion.
   */
  reauthenticateUser: async (email: string, password: string) => {
    if (!auth.currentUser) throw new Error("No user authenticated");
    try {
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
    } catch (error) {
      throw new Error("Incorrect password. Please try again.");
    }
  },

  /**
   * Performs a safe, sequential account deletion.
   * 1. Re-authenticates
   * 2. Cleans up ALL vault memberships (stops on first failure)
   * 3. Deletes users/{uid} document
   * 4. Deletes Firebase Auth user
   * 5. Clears local stores
   */
  deleteAccount: async (email: string, password: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("No user authenticated");
    const uid = user.uid;
    const authStore = useAuthStore.getState();
    const vaultStore = useVaultStore.getState();

    let deletionSuccessful = false;

    try {
      // 1. RE-AUTHENTICATE
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);

      // 2. FETCH VAULTS
      const vaults = await getUserVaults(uid);

      // 3. SEQUENTIAL CLEANUP (Abort on first failure)
      for (const vault of vaults) {
        try {
          await leaveVault(vault.id, uid);
        } catch (leaveErr) {
          console.error(`ACCOUNT_DELETE: Failed to leave vault ${vault.id}`, leaveErr);
          throw new Error(`Failed to clean up vault ${vault.name || vault.id}. Deletion aborted.`);
        }
      }

      // 4. DELETE USER DOCUMENT
      try {
        await deleteDoc(doc(db, "users", uid));
      } catch (docErr) {
        console.error("ACCOUNT_DELETE: Failed to delete user doc", docErr);
        throw new Error("Failed to delete user profile. Deletion aborted.");
      }

      // 5. ACTIVATE GLOBAL KILL-SWITCH (STOPS LISTENERS)
      authStore.setIsDeletingAccount(true);

      // 6. CLEAR LOCAL STORES
      vaultStore.clearVault();
      authStore.setUser(null);

      // 7. DELETE AUTH USER (LAST STEP)
      try {
        await deleteUser(user);
        deletionSuccessful = true;
      } catch (authErr) {
        console.error("ACCOUNT_DELETE: Failed to delete auth account", authErr);
        throw new Error("Failed to delete account from system. Please try again later.");
      }

    } catch (error: any) {
      // If we failed BEFORE the final deleteUser, reset the flag so user can try again
      if (!deletionSuccessful) {
        authStore.setIsDeletingAccount(false);
      }
      throw error;
    } finally {
      // Final safety check: if we somehow got here and deletion was not marked successful,
      // and the flag is still true, reset it.
      if (!deletionSuccessful && authStore.isDeletingAccount) {
        authStore.setIsDeletingAccount(false);
      }
    }
  }
};
