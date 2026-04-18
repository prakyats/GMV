import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit

/**
 * Hardened image upload service for Firebase Storage.
 * Sequence: Validate → Existence Check → Size Check → Blob Transit → Retrieve URL
 */
export const uploadImage = async (uri: string, userId: string): Promise<string> => {
  try {
    if (!uri) throw new Error("Invalid URI");

    // 1. Defensive Check: URI Protocol
    if (!uri.startsWith("file://") && !uri.startsWith("content://")) {
      throw new Error("Invalid local URI format");
    }

    // 2. Existence & Size Check
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (!fileInfo.exists) {
      throw new Error("Source file does not exist");
    }

    if (fileInfo.size && fileInfo.size > MAX_SIZE) {
      throw new Error("IMAGE_TOO_LARGE");
    }

    // 3. Blob Conversion
    const response = await fetch(uri);
    const blob = await response.blob();

    // 4. Storage Path & Ref
    const fileName = `${Date.now()}-${Math.floor(Math.random() * 100000)}.jpg`;
    const path = `memories/${userId}/${fileName}`;
    const storageRef = ref(storage, path);

    // 5. Upload with Explicit MIME
    await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg'
    });

    // 6. Get Public URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;

  } catch (error) {
    console.error("Firebase Storage Upload Failed:", error);
    // Propagate the specific IMAGE_TOO_LARGE error if it occurs
    if (error instanceof Error && error.message === "IMAGE_TOO_LARGE") {
      throw error;
    }
    throw new Error("Image upload failed");
  }
};
