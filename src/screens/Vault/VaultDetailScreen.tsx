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
  Pressable,
  Modal,
  ScrollView,
  Animated,
  BackHandler,
  InteractionManager,
  StatusBar,
  Easing,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { 
  VaultStackParamList, 
  MainStackParamList, 
  Memory 
} from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { useUIStore } from '../../store/uiStore';
import {
  addMemory,
  subscribeToMemories,
  db,
  mapMemoryDoc,
  mergeAndSort,
} from '../../services/memoryService';
import { leaveVault, fetchVaultDetails, subscribeToVault } from '../../services/vaultService';
import {
  Timestamp,
  collection,
  query,
  getDocs,
  orderBy,
  startAfter,
  limit,
  DocumentChange,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ImagePickerButton, MemoryCard, ScalePressable } from '../../components';
import { compressImage } from '../../utils/imageCompressor';
import { uploadImage } from '../../services/storage';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { ANIMATION } from '../../constants/theme';
import { triggerHaptic } from '../../utils/haptics';
import { getUserDisplayName, formatUserDisplayName } from '../../utils/user';
import { VaultMember } from '../../navigation/types';
import MemberAvatarStrip from '../../components/common/MemberAvatarStrip';

type VaultDetailRouteProp = RouteProp<VaultStackParamList, 'VaultDetail'>;

type VaultDetailNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<VaultStackParamList, 'VaultDetail'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const PAGE_SIZE = 15;

const VaultDetailScreen = () => {
  const route = useRoute<VaultDetailRouteProp>();
  const navigation = useNavigation<VaultDetailNavigationProp>();
  const { vaultId, vaultName, memoryId } = route.params || {};
  const { user, isDeletingAccount } = useAuthStore();
  const tabBarHeight = useBottomTabBarHeight();

  // ─── Member state ─────────────────────────────────────────────────────────
  const [memberProfiles, setMemberProfiles] = useState<VaultMember[]>([]);
  const [vaultCreatedBy, setVaultCreatedBy] = useState<string>('');

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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // ─── Animation Refs ────────────────────────────────────────────────────────
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const showSettingsRef = useRef(false);
  
  const insets = useSafeAreaInsets();
  
  // ─── Stability Guards (Production Hardened) ──────────────
  const hasExitedRef = useRef(false);
  const hasMountedRef = useRef(false);
  const activeVaultSetRef = useRef(false);

  const safeExit = () => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    
    // 🚨 FLUSH MEMORY CACHE IMMEDIATELY
    setMemories([]);

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  
  // Sync ref for BackHandler
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  // ─── Hardware Back Button (Android) ────────────────────────────────────────
  useEffect(() => {
    const onBackPress = () => {
      if (showSettingsRef.current) {
        closeSettings();
        return true; // intercept
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, []);

  // ─── Animation state ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Screen Fade-in + FAB Scale-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ANIMATION.FADE_DURATION,
      useNativeDriver: true,
    }).start();

    Animated.spring(fabScale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Fetch vault member details
    if (vaultId) {
      fetchVaultDetails(vaultId)
        .then(({ memberProfiles: profiles, createdBy }) => {
          setMemberProfiles(profiles);
          setVaultCreatedBy(createdBy);
        })
        .catch(() => {}); // Non-critical — strip just stays empty
    }
  }, [fadeAnim, fabScale, vaultId]);
  
  // ─── Presence Tracking (Notification-Aware) ───────────────────────────
  const clearActiveVault = async () => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        activeVault: null
      });
      activeVaultSetRef.current = false;
    } catch (err) {
      console.warn("Presence: Clear failed", err);
    }
  };

  useEffect(() => {
    if (!vaultId || !user?.uid) return;

    const setActiveVault = async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          activeVault: {
            id: vaultId,
            updatedAt: serverTimestamp()
          }
        });
        activeVaultSetRef.current = true;
      } catch (err) {
        console.warn("Presence: Set failed", err);
      }
    };

    setActiveVault();

    // Clear on unmount
    return () => {
      clearActiveVault();
    };
  }, [vaultId, user?.uid]);

  useEffect(() => {
    // Clear on background to ensure user gets notifications when multi-tasking
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        clearActiveVault();
      } else if (state === "active" && vaultId) {
        // Re-set when coming back to the vault
        if (!activeVaultSetRef.current) {
          updateDoc(doc(db, "users", user!.uid), {
            activeVault: {
              id: vaultId,
              updatedAt: serverTimestamp()
            }
          }).then(() => {
            activeVaultSetRef.current = true;
          }).catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [vaultId, user?.uid]);

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

  // ─── Real-time Subscriptions (Atomic Lifecycle) ───────────────────────────
  useEffect(() => {
    if (!vaultId || !user?.uid) return;
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;

    // Full reset when vaultId changes
    setMemories([]);
    setHasMore(true);
    setLoading(true);
    setError(null);
    initialLastDocRef.current = null;
    paginationCursorRef.current = null;

    // A. MEMBERSHIP GUARD (P0 Stabilizer)
    const unsubVault = subscribeToVault(
      vaultId,
      (snap) => {
        if (hasExitedRef.current || isLeaving || isDeletingAccount) {
          safeExit();
          return;
        }
        
        if (!snap.exists()) {
          safeExit();
          return;
        }

        const data = snap.data();
        if (hasExitedRef.current || isLeaving || isDeletingAccount || !data.members?.includes(user!.uid)) {
          safeExit();
          return;
        }

        // Update profiles for the UI
        const profiles = data.memberProfiles || [];
        setMemberProfiles(profiles);
        setVaultCreatedBy(data.createdBy || '');

        // Sync with VaultStore for memory creation (P0 consistency)
        useVaultStore.getState().setCurrentVault(vaultId, data.members || []);
      },
      (error) => {
        if (error.code === "permission-denied" || isDeletingAccount) {
          safeExit();
          return;
        }
      }
    );

    // B. MEMORY FEED
    const unsubMemories = subscribeToMemories(
      vaultId,
      (realtimeMemories, snapshot) => {
        // 🚨 SENTINEL GUARD (Production Hardened)
        if (hasExitedRef.current || isLeaving || isDeletingAccount || !user) {
          safeExit();
          return;
        }

        const removedIds = snapshot.docChanges()
          .filter((change: DocumentChange) => change.type === 'removed')
          .map((change: DocumentChange) => change.doc.id);

        setMemories(prev => {
          let updated = mergeAndSort(prev, realtimeMemories);
          if (removedIds.length > 0) {
            updated = updated.filter(m => !removedIds.includes(m.id));
          }
          return updated;
        });

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
      (err) => {
        if (hasExitedRef.current || isDeletingAccount) {
          safeExit();
          return;
        }
        if (err?.code === 'permission-denied') {
          safeExit();
          return;
        }
        setError("Failed to sync memories");
        setLoading(false);
      }
    );

    return () => {
      unsubVault();
      unsubMemories();
    };
  }, [vaultId, user?.uid, isLeaving]);

  // ─── Auto-Open Memory (Deep Link Hook) ────────────────────────────────────
  useEffect(() => {
    if (!memoryId || !memories.length) return;

    console.log("🎯 Deep link detected for memory:", memoryId);
    const start = Date.now();

    const interval = setInterval(() => {
      const target = memories.find(m => m.id === memoryId);

      if (target) {
        console.log("✅ Target memory found:", target.id);
        clearInterval(interval);

        // Open memory detail with full object for zero-flicker
        navigation.navigate("MemoryDetail", { 
          memoryId: target.id,
          vaultId: vaultId!,
          memory: target 
        });

        // Clear param so it doesn't reopen on back navigation
        navigation.setParams({ memoryId: undefined });
      }

      // Fallback: 3s timeout
      if (Date.now() - start > 3000) {
        clearInterval(interval);
        console.log("⚠️ Deep link timeout: memory not found in feed list");
        // Clear param to avoid redundant checks
        navigation.setParams({ memoryId: undefined });
      }
    }, 200);

    return () => clearInterval(interval);
  }, [memoryId, memories, vaultId, navigation]);

  // ─── Pagination ───────────────────────────────────────────────────────────
  const loadMore = async () => {
    // Hard Guards (P0 stability)
    if (hasExitedRef.current || isLeaving || isDeletingAccount || !user) return;
    
    // Check membership from Store (SSoT) before network request
    const { currentVaultMembers } = useVaultStore.getState();
    if (!user?.uid || !currentVaultMembers.includes(user.uid)) return;

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

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setNewMemory('');
    setSelectedImage(null);
    setSelectedDate(new Date());
    setError(null);
  };

  // ─── Post memory ──────────────────────────────────────────────────────────
  const handleAddMemory = async () => {
    const { currentVaultMembers } = useVaultStore.getState();
    if (
      hasExitedRef.current || 
      isLeaving || 
      isAdding || 
      !vaultId || 
      !user?.uid || 
      isDeletingAccount ||
      !currentVaultMembers.includes(user.uid)
    ) return;
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
        if (!finalCaption && !imageURL) {
          useUIStore.getState().showAlert({
            title: "Empty Memory",
            message: "Please add a caption or a photo before saving.",
            type: "error"
          });
          return;
        }

        if (finalCaption.length >= 500) {
          useUIStore.getState().showAlert({
            title: "Too Long",
            message: "Captions must be under 500 characters.",
            type: "error"
          });
          return;
        }

        // Attribution resolution moved to service layer
        await addMemory(vaultId, {
          type: selectedImage ? 'image' : 'text',
          caption: finalCaption,
          imageURL,
          createdBy: {
            id: user.uid,
            name: '', // Will be resolved by service using displayName/email
            displayName: user.displayName,
            email: user.email,
          } as any,
          memoryDate: Timestamp.fromDate(selectedDate),
          members: currentVaultMembers,
        });

        // Cleanup on success
        setNewMemory('');
        setSelectedImage(null);
        setSelectedDate(new Date());
        setIsModalVisible(false);
        triggerHaptic('success');

      } catch (addError) {
        console.error('Memory creation failed:', addError);
        useUIStore.getState().showAlert({
          title: "Error",
          message: "Could not save memory. Please check your connection and try again.",
          type: "error"
        });
      }
    } catch (err: any) {
      if (err.message === 'IMAGE_TOO_LARGE') {
        useUIStore.getState().showAlert({
          title: "Image too large",
          message: "Try a smaller image (max 5MB after compression).",
          type: "error"
        });
      } else {
        // Generic catch-all for potential internal errors (e.g. compression failed)
        console.error('Add Memory UI error:', err);
      }
    } finally {
      setIsAdding(false);
    }
  };

  // ─── Leave vault ──────────────────────────────────────────────────────────
  // ─── Settings Actions ────────────────────────────────────────────────────
  const openSettings = () => {
    if (isAnimating.current || showSettings) return;
    
    isAnimating.current = true;
    triggerHaptic('light');
    setShowSettings(true);
    sheetAnim.setValue(0);
    
    requestAnimationFrame(() => {
      Animated.timing(sheetAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const closeSettings = (onComplete?: () => void) => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false;
      setShowSettings(false);
      onComplete?.();
    });
  };

  const handleLeavePress = () => {
    if (isLeaving) return;
    triggerHaptic('medium');
    
    closeSettings(() => {
      useUIStore.getState().showAlert({
        title: "Leave Vault?",
        message: "You will lose access to all memories in this vault.",
        type: "confirm",
        onConfirm: confirmLeave,
        onCancel: () => useUIStore.getState().hideAlert()
      });
    });
  };

  const confirmLeave = async () => {
    if (hasExitedRef.current || isLeaving || isDeletingAccount) return;
    
    try {
      setIsLeaving(true);
      await leaveVault(vaultId!, user!.uid);
      
      // Force modal unmount before navigation
      setShowSettings(false);
      
      requestAnimationFrame(() => {
        InteractionManager.runAfterInteractions(() => {
          safeExit();
        });
      });
    } catch (error: any) {
      console.warn('LEAVE VAULT ERROR:', error.code, error.message);
      useUIStore.getState().showAlert({
        title: "Something went wrong",
        message: "Couldn't leave the vault. Please try again.",
        type: "error"
      });
    } finally {
      setIsLeaving(false);
    }
  };

  const handleBackdropPress = () => {
    if (!showSettings || isAnimating.current) return;
    closeSettings();
  };

  // ─── Native Header Config ──────────────────────────────────────────────
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: vaultName || 'Vault',
      headerRight: () => (
        <ScalePressable 
          onPress={openSettings}
          useOpacity={true}
          disabled={isLeaving}
        >
          <Ionicons 
            name="settings-outline" 
            size={22} 
            color={showSettings ? "#FFFFFF" : "#B0B0B0"} 
          />
        </ScalePressable>
      ),
    });
  }, [navigation, vaultName, showSettings, isLeaving]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={
          memberProfiles.length > 0 ? (
            <MemberAvatarStrip
              memberProfiles={memberProfiles}
              createdBy={vaultCreatedBy}
              currentUserId={user?.uid || ''}
              onPress={() =>
                navigation.navigate('VaultMembers', {
                  vaultId: vaultId!,
                  vaultName: vaultName || 'Vault',
                  createdBy: vaultCreatedBy,
                })
              }
            />
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ marginTop: 20 }}>
              <LoadingSkeleton />
              <LoadingSkeleton />
              <LoadingSkeleton />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No memories yet.</Text>
              <Text style={styles.emptySubText}>Be the first to share one!</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <MemoryCard memory={item} vaultId={vaultId!} index={index} />
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
          </View>
        }
      />

      {/* Premium FAB */}
      <Animated.View style={{ 
        transform: [{ scale: fabScale }],
        position: 'absolute',
        right: 20,
        bottom: tabBarHeight + 20,
        zIndex: 100,
      }}>
        <ScalePressable 
          style={styles.fab}
          onPress={() => setIsModalVisible(true)}
          scaleTo={ANIMATION.FAB_PRESS_SCALE}
          useOpacity={false} // FAB keeps solid color
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </ScalePressable>
      </Animated.View>

      {/* ─── Settings Bottom Sheet ─── */}
      <Modal 
        visible={showSettings} 
        transparent 
        animationType="none"
        statusBarTranslucent
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.modalOverlay} pointerEvents="box-none">
            {/* Backdrop */}
            <Animated.View 
              pointerEvents={showSettings ? "auto" : "none"}
              style={[
                styles.backdrop,
                {
                  opacity: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  })
                }
              ]}
            >
              <Pressable 
                style={StyleSheet.absoluteFill} 
                onPress={handleBackdropPress} 
              />
            </Animated.View>

          {/* Sheet */}
          <Animated.View style={[
            styles.bottomSheet,
            {
              transform: [{
                translateY: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [600, 0],
                })
              }],
              paddingBottom: Math.max(insets.bottom, 24),
            }
          ]}>
            <View style={styles.dragIndicator} />
            
            <View style={styles.sheetContent}>
              <ScalePressable 
                onPress={handleLeavePress}
                disabled={isLeaving}
                scaleTo={0.96}
                style={styles.actionButton}
              >
                <Text style={styles.leaveText}>Leave Vault</Text>
              </ScalePressable>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>

      {/* Premium Creation Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isModalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCloseModal}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Memory</Text>
              <TouchableOpacity 
                onPress={handleAddMemory}
                disabled={(!newMemory.trim() && !selectedImage) || isAdding}
              >
                <Text style={[
                  styles.modalShare,
                  ((!newMemory.trim() && !selectedImage) || isAdding) && { color: '#3A3A3C' }
                ]}>
                  {isAdding ? 'Posting...' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.modalInput}
                placeholder="What's the memory?"
                placeholderTextColor="#8E8E93"
                value={newMemory}
                onChangeText={setNewMemory}
                multiline
                autoFocus
              />
              
              <ImagePickerButton 
                onImageSelected={setSelectedImage} 
                selectedImage={selectedImage}
              />
            </ScrollView>
          </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </Animated.View>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  headerAction: {
    marginRight: 8,
  },
  listContent: {
    paddingTop: Platform.OS === 'ios' ? 120 : 20, 
    paddingBottom: 160, // Account for floating input bar
    paddingHorizontal: 0, // MemoryCards handle their own margins now
  },
  
  // PREMIUM FAB
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },

  // PREMIUM MODAL
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C1E',
  },
  modalCancel: {
    color: '#FF453A',
    fontSize: 17,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  modalShare: {
    color: '#6C63FF',
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalInput: {
    color: '#FFFFFF',
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
  },


  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#8E8E93',
    fontSize: 15,
  },

  footerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingMoreIndicator: {
    padding: 8,
  },

  // ─── Settings Sheet Styles ───
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    // iOS Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    // Android Shadow
    elevation: 20,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetContent: {
    width: '100%',
  },
  actionButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
  },
  leaveText: {
    color: '#FF453A',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default VaultDetailScreen;