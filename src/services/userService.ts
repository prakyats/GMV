import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, deleteObject, ref as storageRefFromURL } from 'firebase/storage';
import { storage, auth, db } from '@/services/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAuthStore, AppUser } from '../store/authStore';
import { useUserStore } from '../store/userStore';

const syncUserState = (updates: Partial<AppUser>) => {
  const current = useAuthStore.getState().user;
  if (!current) return;

  useAuthStore.getState().setUser({
    ...current,
    ...updates,
  } as AppUser);
};

export const uploadProfileImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
  });

  if (result.canceled) return null;

  try {
    const image = result.assets[0];
    const response = await fetch(image.uri);
    const blob = await response.blob();

    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    // DELETE OLD IMAGE (STORAGE HYGIENE)
    if (user.photoURL) {
      try {
        const oldRef = storageRefFromURL(storage, user.photoURL);
        await deleteObject(oldRef);
      } catch (e) {
        console.warn("Old image delete failed (safe to ignore)");
      }
    }

    const fileName = `${user.uid}_${Date.now()}`;
    const storageRef = ref(storage, `profileImages/${fileName}`);

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    // Update Firebase Auth
    await updateProfile(user, {
      photoURL: downloadURL,
    });

    // Update Firestore
    await updateDoc(doc(db, "users", user.uid), {
      photoURL: downloadURL,
    });

    syncUserState({ photoURL: downloadURL });

    return downloadURL;
  } catch (error) {
    console.error("❌ Profile image upload failed:", error);
    throw new Error("Failed to update profile image");
  }
};

export const updateUserName = async (name: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const trimmed = name.trim();

  await updateProfile(user, {
    displayName: trimmed,
  });

  await updateDoc(doc(db, "users", user.uid), {
    displayName: trimmed,
  });

  syncUserState({ displayName: trimmed });

  return trimmed;
};

/**
 * Real-time targeted subscription for a specific user.
 * Updates the global userStore incrementally.
 */
export const subscribeToUserProfile = (uid: string) => {
  if (!uid) return () => {};

  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      useUserStore.getState().upsertUser(uid, {
        uid: uid,
        displayName: data.displayName || null,
        email: data.email || null,
        photoURL: data.photoURL || null,
      });
    }
  }, (error) => {
    console.error(`❌ User subscription failed for ${uid}:`, error);
  });
};
