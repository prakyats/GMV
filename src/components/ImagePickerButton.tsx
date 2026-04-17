import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  Alert, 
  StyleSheet 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface ImagePickerButtonProps {
  onImageSelected: (uri: string) => void;
}

const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({ onImageSelected }) => {
  
  const pickImage = async () => {
    // request permission
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required", 
        "Please allow access to your photos to share memories."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;

      if (!uri) return;

      onImageSelected(uri);
    } catch (error) {
      console.error("ImagePicker Error:", error);
      Alert.alert("Error", "Failed to pick an image.");
    }
  };

  return (
    <TouchableOpacity onPress={pickImage} style={styles.button}>
      <Text style={styles.text}>Pick Image</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ImagePickerButton;
