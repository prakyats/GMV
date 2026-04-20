import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { MemberAvatar } from '../../components';
import { uploadProfileImage, updateUserName } from '../../services/userService';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'EditProfile'>;

const EditProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, setUser } = useAuthStore();
  
  const [name, setName] = useState(user?.displayName || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = async () => {
    if (isUploading || isSaving) return;
    try {
      setIsUploading(true);
      const url = await uploadProfileImage();
      if (url && user) {
        // user object in authStore needs to be kept in sync
        setUser({ ...user, photoURL: url });
      }
    } catch (error: any) {
      useUIStore.getState().showAlert({
        title: "Upload Failed",
        message: error.message || "Could not upload image.",
        type: "error"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (isUploading || isSaving || !name.trim()) return;
    
    try {
      setIsSaving(true);
      const newName = await updateUserName(name.trim());
      if (user) {
        setUser({ ...user, displayName: newName });
      }
      useUIStore.getState().showToast("Profile updated!");
      navigation.goBack();
    } catch (error: any) {
      useUIStore.getState().showAlert({
        title: "Save Failed",
        message: error.message || "Could not update name.",
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Edit Profile',
      headerLargeTitle: false, // Cleaner for edit screen
      headerRight: () => (
        <TouchableOpacity 
          onPress={handleSave} 
          disabled={isSaving || !name.trim() || name === user?.displayName}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#6C63FF" />
          ) : (
            <Text style={[
              styles.saveBtnText, 
              (!name.trim() || name === user?.displayName) && styles.disabledText
            ]}>
              Done
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, name, user?.displayName, isSaving]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={handleImageChange}
            disabled={isUploading || isSaving}
          >
            <MemberAvatar 
              member={{ id: user?.uid || '', name: name || user?.displayName || 'User', photoURL: user?.photoURL }}
              isCurrentUser={true}
              isOwner={false}
              size={100}
            />
            <View style={[styles.cameraBadge, (isUploading || isSaving) && styles.disabledBadge]}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </View>
            {isUploading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleImageChange} disabled={isUploading || isSaving}>
            <Text style={[styles.changePhotoText, (isUploading || isSaving) && styles.disabledText]}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>DISPLAY NAME</Text>
          <View style={[styles.inputWrapper, (isUploading || isSaving) && styles.disabledInput]}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              placeholderTextColor="#8E8E93"
              editable={!isUploading && !isSaving}
              autoFocus
            />
            {name.length > 0 && !isUploading && !isSaving && (
              <TouchableOpacity onPress={() => setName('')}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.hint}>
            This name will be visible to your friends in vaults.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingTop: 100, // Account for header
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#6C63FF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
  formSection: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#38383A',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
  },
  hint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 18,
  },
  saveBtnText: {
    color: '#6C63FF',
    fontSize: 17,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  disabledBadge: {
    backgroundColor: '#38383A',
  },
  disabledInput: {
    backgroundColor: '#000000',
    opacity: 0.7,
  }
});

export default EditProfileScreen;
