import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  AuthError
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';

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

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: name.trim(),
        photoURL: null,
        vaultIds: [],
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      throw new Error(mapAuthError(error as AuthError));
    }
  },


  /**
   * Logs in an existing user with email and password.
   */
  login: async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw new Error(mapAuthError(error as AuthError));
    }
  },

  /**
   * Signs out the currently authenticated user.
   */
  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw new Error('Failed to logout. Please try again.');
    }
  }
};
