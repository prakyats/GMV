import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  FlatList, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { addMemory, subscribeToMemories, Memory } from '../../services/memoryService';
import { leaveVault } from '../../services/vaultService';
import { Timestamp } from 'firebase/firestore'; // Added for memoryDate
import ImagePickerButton from '../../components/ImagePickerButton';
import MemoryCard from '../../components/MemoryCard';
import { compressImage } from '../../utils/imageCompressor';
import { uploadImage } from '../../services/storage';
import LoadingSkeleton from '../../components/LoadingSkeleton';

type VaultDetailRouteProp = RouteProp<VaultStackParamList, 'VaultDetail'>;

const VaultDetailScreen = () => {
  const route = useRoute<VaultDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { vaultId } = route.params || {};
  const { user } = useAuthStore();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Added for memoryDate support
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultId) return;

    setLoading(true);
    
    const unsubscribe = subscribeToMemories(
      vaultId,
      (data: Memory[]) => {
        setMemories(data);
        setLoading(false);
      },
      (err: any) => {
        setError("Failed to sync memories");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [vaultId]);

  const handleAddMemory = async () => {
    if (isAdding) return;
    if (!vaultId || !user?.uid) return;

    // Must have either text or an image
    const text = newMemory.trim();
    if (!text && !selectedImage) return;

    try {
      setIsAdding(true);
      setError(null);

      let imageURL = null;

      // STEP 1: Process Image (if exists)
      if (selectedImage) {
        // 1a. Compress
        const compressedUri = await compressImage(selectedImage);
        
        // 1b. Upload (storage service handles size check & URI validation)
        imageURL = await uploadImage(compressedUri, user.uid);
      }

      // STEP 2: Save to Firestore
      await addMemory(vaultId, {
        type: selectedImage ? 'image' : 'text',
        text: text,
        imageURL: imageURL,
        createdBy: user.uid,
        memoryDate: Timestamp.fromDate(selectedDate),
      });

      // STEP 3: Reset UI
      setNewMemory('');
      setSelectedImage(null);

    } catch (err: any) {
      console.error("Add Memory Error:", err);
      
      if (err.message === "IMAGE_TOO_LARGE") {
        Alert.alert("Image too large", "Try a smaller image (max 1MB).");
      } else {
        Alert.alert("Error", "Failed to add memory. Please try again.");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleLeaveVault = async () => {
    if (isLeaving) return;
    if (!vaultId || !user?.uid) return;

    Alert.alert(
      "Leave Vault",
      "Are you sure you want to leave this vault? If you are the last member, the vault and all its memories will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Leave", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLeaving(true);
              await leaveVault(vaultId, user.uid);
              
              // Clear global state
              useVaultStore.getState().clearVault();
              
              // Reset navigation to prevent back-navigation to non-existent vault
              navigation.reset({
                index: 0,
                routes: [{ name: 'VaultList' }],
              });
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to leave vault");
            } finally {
              setIsLeaving(false);
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backContainer}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Vault</Text>
      </View>

      {/* Input Section - Fixed at Top */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <ImagePickerButton onImageSelected={setSelectedImage} />
          <TextInput
            style={styles.input}
            placeholder={selectedImage ? "Add a caption..." : "Write a memory..."}
            placeholderTextColor="#8E8E93"
            value={newMemory}
            onChangeText={setNewMemory}
            multiline
          />
          <TouchableOpacity 
            style={[
              styles.addButton,
              (!newMemory.trim() && !selectedImage || isAdding) && styles.addButtonDisabled
            ]}
            onPress={handleAddMemory}
            disabled={(!newMemory.trim() && !selectedImage) || isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity 
              style={styles.removeImageButton} 
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Memories List */}
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <LoadingSkeleton />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No memories yet.</Text>
              <Text style={styles.emptySubText}>Be the first to share one!</Text>
            </View>
          )
        }
          renderItem={({ item }) => (
            <MemoryCard 
              memory={item} 
              vaultId={vaultId!} 
            />
          )}
          ListFooterComponent={
            <TouchableOpacity 
              style={[styles.leaveButton, isLeaving && styles.leaveButtonDisabled]} 
              onPress={handleLeaveVault}
              disabled={isLeaving}
            >
              {isLeaving ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Text style={styles.leaveButtonText}>Leave Vault</Text>
              )}
            </TouchableOpacity>
        }
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backContainer: {
    marginRight: 16,
  },
  backButton: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  inputContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#3A3A3C',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  memoryItem: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  memoryText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  memoryDate: {
    color: '#8E8E93',
    fontSize: 12,
  },
  memoryImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
  },
  previewContainer: {
    marginTop: 12,
    position: 'relative',
    width: 80,
    height: 80,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#0B0B0B',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  leaveButton: {
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  leaveButtonDisabled: {
    opacity: 0.5,
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VaultDetailScreen;
