import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image to a production-safe size.
 * Max width: 1200px, quality: 0.8, format: JPEG.
 */
export const compressImage = async (uri: string): Promise<string> => {
  if (!uri) throw new Error("Invalid image URI");

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    if (!result?.uri) {
      throw new Error("Compression failed: No URI returned");
    }

    return result.uri;
  } catch (error) {
    console.error("Image compression error:", error);
    throw error;
  }
};
