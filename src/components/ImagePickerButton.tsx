import React, { useState, useRef } from 'react';
import { 
  View,
  Text, 
  Alert, 
  StyleSheet, 
  ActivityIndicator,
  Animated,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ScalePressable } from './common/ScalePressable';
import { triggerHaptic } from '../utils/haptics';
import { ANIMATION } from '../constants/theme';
import { useUIStore } from '../store/uiStore';

interface ImagePickerButtonProps {
  onImageSelected: (uri: string) => void;
  selectedImage?: string | null;
}

/**
 * Premium Image Picker Button
 * - Solid surface UI (#1C1C1E)
 * - Loading feedback with 5s timeout guard
 * - Tactile scale feedback
 * - Visual preview fade-in
 */
const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({ 
  onImageSelected,
  selectedImage 
}) => {
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = () => {
    setLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const pickImage = async () => {
    if (loading) return;

    // request permission
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      useUIStore.getState().showAlert({
        title: "Permission Required",
        message: "Please allow access to your photos to share memories.",
        type: "info"
      });
      return;
    }

    try {
      setLoading(true);
      triggerHaptic('light');

      // Safety fallback: if picker hangs or user doesn't return, reset UI after 5s
      timeoutRef.current = setTimeout(() => {
        if (loading) cleanup();
      }, 5000);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      cleanup();

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      onImageSelected(uri);
      triggerHaptic('medium');
    } catch (error) {
      cleanup();
      console.error("ImagePicker Error:", error);
      useUIStore.getState().showAlert({
        title: "Error",
        message: "Failed to pick an image.",
        type: "error"
      });
    }
  };

  return (
    <ScalePressable 
      onPress={pickImage} 
      style={styles.button}
      disabled={loading}
    >
      <View style={[styles.content, selectedImage && styles.previewContent]}>
        {loading ? (
          <ActivityIndicator size="small" color="#6C63FF" />
        ) : selectedImage ? (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <View style={styles.changeOverlay}>
              <Ionicons name="camera-reverse" size={20} color="#FFFFFF" />
              <Text style={styles.changeText}>Change</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="image-outline" size={24} color="#6C63FF" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.titleText}>Add Photo</Text>
              <Text style={styles.subtitleText}>
                Tap to select from gallery
              </Text>
            </View>
          </>
        )}
      </View>
    </ScalePressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2C2C2E', // Slightly lighter to distinguish from modal background
    borderRadius: 20, // More rounded for modern iOS feel
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 24, // More generous padding
    marginTop: 12,
    marginBottom: 24,
    minHeight: 100, // Taller primary action area
    justifyContent: 'center',
    overflow: 'hidden', // Contain the preview image
    // iOS Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    // Android elevation
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // Align to left for more standard list-item feel
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitleText: {
    color: '#AEAeb2', // Subtle secondary grey
    fontSize: 14,
    fontWeight: '400',
  },
  previewContent: {
    padding: 0,
    width: '100%',
    height: 250,
  },
  previewWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default ImagePickerButton;
