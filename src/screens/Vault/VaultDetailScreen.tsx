import React, { useState, useEffect, useRef } from 'react';
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
  Image,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  VaultStackParamList, 
  MainStackParamList, 
  Memory 
} from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import {
  addMemory,
  subscribeToMemories,
  db,
  mapMemoryDoc,
  mergeAndSort,
} from '../../services/memoryService';
import { leaveVault } from '../../services/vaultService';
import {
  Timestamp,
  collection,
  query,
  getDocs,
  orderBy,
  startAfter,
  limit,
} from 'firebase/firestore';
import ImagePickerButton from '../../components/ImagePickerButton';
import MemoryCard from '../../components/MemoryCard';
import { compressImage } from '../../utils/imageCompressor';
import { uploadImage } from '../../services/storage';
import LoadingSkeleton from '../../components/LoadingSkeleton';

type VaultDetailRouteProp = RouteProp<VaultStackParamList, 'VaultDetail'>;

type VaultDetailNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<VaultStackParamList, 'VaultDetail'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const PAGE_SIZE = 15;

const VaultDetailScreen = () => {
  const route = useRoute<VaultDetailRouteProp>();
  const navigation = useNavigation<VaultDetailNavigationProp>();
  const { vaultId, vaultName } = route.params || {};
  const { user } = useAuthStore();

  // ─── Feed state ───────────────────────────────────────────────────────────
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Post state ───────────────────────────────────────────────────────────
  const [newMemory, setNewMemory] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  /**
   * Pagination cursor architecture (two separate refs):
   *
   * initialLastDocRef — set once on first snapshot, never touched again.
   *   Used as the START point for pagination. Even if onSnapshot re-fires
   *   (e.g. a reaction update), this cursor stays stable.
   *
   * paginationCursorRef — advances forward with each loadMore() call.
   *   Points to the last doc of the most recently loaded page.
   *
   * Why two refs? If we used a single shared cursor, onSnapshot re-fires
   * would overwrite it, causing pagination to re-fetch already-seen docs
   * or skip items entirely (Bug 4 from the history above).
   */
  const initialLastDocRef = useRef<any>(null);
  const paginationCursorRef = useRef<any>(null);

  /**
   * FlatList fires onEndReached during momentum scroll AND at rest.
   * This ref ensures loadMore() is called at most once per scroll gesture.
   */
  const onEndReachedCalledDuringMomentum = useRef(false);

  // ─── Real-time subscription + vault reset ────────────────────────────────
  useEffect(() => {
    if (!vaultId) return;

    // Full reset when vaultId changes (vault switch guard — Bug 6)
    setMemories([]);
    setHasMore(true);
    setLoading(true);
    setError(null);
    initialLastDocRef.current = null;
    paginationCursorRef.current = null;

    const unsubscribe = subscribeToMemories(
      vaultId,
      (realtimeMemories, snapshot) => {
        setMemories(prev => mergeAndSort(prev, realtimeMemories));

        // Capture initial cursor only once (Bug 4 fix)
        if (!initialLastDocRef.current && snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          initialLastDocRef.current = lastDoc;
          paginationCursorRef.current = lastDoc;
        }

        // If first page is smaller than PAGE_SIZE, there's nothing more to load
        if (snapshot.docs.length < PAGE_SIZE) {
          setHasMore(false);
        }

        setLoading(false);
      },
      PAGE_SIZE,
      () => {
        setError("Failed to sync memories");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [vaultId]);

  // ─── Pagination ───────────────────────────────────────────────────────────
  const loadMore = async () => {
    // All guards must pass before any network call (Bug 5 + 7 fix)
    if (loadingMore || !hasMore || !paginationCursorRef.current || !vaultId) return;

    try {
      setLoadingMore(true);

      const q = query(
        collection(db, 'vaults', vaultId, 'memories'),
        orderBy('memoryDate', 'desc'),
        orderBy('createdAt', 'desc'),
        startAfter(paginationCursorRef.current),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);

      if (snapshot.docs.length === 0) {
        setHasMore(false);
        return;
      }

      const newDocs = snapshot.docs.map(mapMemoryDoc);
      setMemories(prev => mergeAndSort(prev, newDocs));

      // Advance cursor to end of this page
      paginationCursorRef.current = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Load More Error:", err);
    } finally {
      setLoadingMore(true); // Bug 7 fix: always release the guard
      setLoadingMore(false);
    }
  };

  // ─── Post memory ──────────────────────────────────────────────────────────
  const handleAddMemory = async () => {
    if (isAdding || !vaultId || !user?.uid) return;
    const text = newMemory.trim();
    if (!text && !selectedImage) return;

    try {
      setIsAdding(true);
      setError(null);

      let imageURL: string | null = null;
      if (selectedImage) {
        const compressed = await compressImage(selectedImage);
        imageURL = await uploadImage(compressed, user.uid);
      }

      const { currentVaultMembers } = useVaultStore.getState();

      try {
        const finalCaption = text.trim();
        if (!finalCaption) {
          Alert.alert('Empty Memory', 'Please add a caption before saving.');
          return;
        }

        if (finalCaption.length >= 500) {
          Alert.alert('Too Long', 'Captions must be under 500 characters.');
          return;
        }

        const userName = user.displayName?.trim() || (user.email ? user.email.split('@')[0] : '');
        if (!userName) {
          Alert.alert('Profile Incomplete', 'Please set a name in your profile before posting memories.');
          return;
        }

        await addMemory(vaultId, {
          type: selectedImage ? 'image' : 'text',
          caption: finalCaption,
          imageURL,
          createdBy: {
            id: user.uid,
            name: userName,
          },
          memoryDate: Timestamp.fromDate(selectedDate),
          members: currentVaultMembers,
        });

        // Cleanup on success
        setNewMemory('');
        setSelectedImage(null);
        setSelectedDate(new Date());

      } catch (addError) {
        console.error('Memory creation failed:', addError);
        Alert.alert('Error', 'Could not save memory. Please check your connection and try again.');
      }
    } catch (err: any) {
      if (err.message === 'IMAGE_TOO_LARGE') {
        Alert.alert('Image too large', 'Try a smaller image (max 5MB after compression).');
      } else {
        // Generic catch-all for potential internal errors (e.g. compression failed)
        console.error('Add Memory UI error:', err);
      }
    } finally {
      setIsAdding(false);
    }
  };

  // ─── Leave vault ──────────────────────────────────────────────────────────
  const handleLeaveVault = () => {
    if (isLeaving || !vaultId || !user?.uid) return;

    Alert.alert(
      'Leave Vault',
      'Are you sure? If you are the last member, the vault and all its memories will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLeaving(true);
              await leaveVault(vaultId, user.uid);
              useVaultStore.getState().clearVault();
              navigation.reset({ index: 0, routes: [{ name: 'VaultList' }] });
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to leave vault');
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backContainer}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{vaultName || 'Vault'}</Text>
      </View>

      {/* Post input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <ImagePickerButton onImageSelected={setSelectedImage} />
          <TextInput
            style={styles.input}
            placeholder={selectedImage ? 'Add a caption...' : 'Write a memory...'}
            placeholderTextColor="#8E8E93"
            value={newMemory}
            onChangeText={setNewMemory}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              ((!newMemory.trim() && !selectedImage) || isAdding) && styles.addButtonDisabled,
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

        {selectedImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removeImageButton} onPress={() => setSelectedImage(null)}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Feed */}
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <>
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No memories yet.</Text>
              <Text style={styles.emptySubText}>Be the first to share one!</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <MemoryCard memory={item} vaultId={vaultId!} />
        )}
        onMomentumScrollBegin={() => {
          onEndReachedCalledDuringMomentum.current = false;
        }}
        onEndReached={() => {
          if (!onEndReachedCalledDuringMomentum.current) {
            loadMore();
            onEndReachedCalledDuringMomentum.current = true;
          }
        }}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          <View style={styles.footerContainer}>
            {loadingMore && <ActivityIndicator style={styles.loadingMoreIndicator} color="#6C63FF" />}
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
          </View>
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
  backContainer: { marginRight: 16 },
  backButton: { color: '#6C63FF', fontSize: 16, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', flex: 1 },

  inputContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
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
  addButtonDisabled: { backgroundColor: '#3A3A3C' },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

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
  removeImageText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  listContent: { paddingBottom: 16 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubText: { color: '#8E8E93', fontSize: 14 },

  footerContainer: { paddingVertical: 20, gap: 16 },
  loadingMoreIndicator: { padding: 8 },

  leaveButton: {
    marginTop: 8,
    marginBottom: 40,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  leaveButtonDisabled: { opacity: 0.5 },
  leaveButtonText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
});

export default VaultDetailScreen;