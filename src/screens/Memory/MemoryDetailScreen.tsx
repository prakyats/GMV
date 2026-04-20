import React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Animated, 
  useWindowDimensions, 
  StatusBar,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainStackParamList, Memory } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { markMemoryViewed, subscribeToMemory, deleteMemory } from '../../services/memoryService';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ScalePressable } from '../../components';
import { triggerHaptic } from '../../utils/haptics';
import { formatUserDisplayName } from '../../utils/user';
import MemoryReactions from '../../components/MemoryReactions';

type MemoryDetailRouteProp = RouteProp<MainStackParamList, 'MemoryDetail'>;

/**
 * MemoryDetailScreen
 * Displays a single memory (image or text) with full attribution and moderation controls.
 */
const MemoryDetailScreen = () => {
  const route = useRoute<MemoryDetailRouteProp>();
  const navigation = useNavigation();
  const { memoryId, vaultId, memory: initialMemory } = route.params;
  const { user, isDeletingAccount } = useAuthStore();
  
  // --- Core State ---
  const [memory, setMemory] = useState<Memory | null>(initialMemory || null);
  
  // Guard: If we have partial image data but no URL, we must keep loading
  const isImageReady = memory?.type === "image" && !!memory?.imageURL;
  const shouldKeepLoading = !memory || (memory.type === "image" && !memory.imageURL);
  
  const [loading, setLoading] = useState(shouldKeepLoading);
  const [error, setError] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // DEBUG LOGS (Temporary)
  useEffect(() => {
    console.log("🧠 Memory received:", memory?.id);
    console.log("🧩 Memory type:", memory?.type);
    console.log("🖼️ Image URL:", memory?.imageURL ? "Exists" : "Missing");
    console.log("⏳ Loading state:", loading);
    console.log("🛡️ Should keep loading:", shouldKeepLoading);
  }, [memory, loading, shouldKeepLoading]);

  // --- Animation Refs ---
  const imageFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const reactionsFade = useRef(new Animated.Value(0)).current;
  const hasExitedRef = useRef(false);

  // --- Helpers ---
  const safeExit = useCallback(() => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // --- Derived Data ---
  const hasImage = !!memory?.imageURL;
  const displayText = memory?.caption || "";
  const dateObj = (memory?.memoryDate || memory?.createdAt)
    ? new Date((memory?.memoryDate?.seconds || memory?.createdAt?.seconds || 0) * 1000)
    : new Date();

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const authorName = formatUserDisplayName(memory?.createdBy || {});
  const isOwner = memory?.createdBy?.id === user?.uid;

  // --- Handlers (Defined before hooks that use them) ---
  const handleDelete = async () => {
    if (isDeleting || !memoryId || !vaultId) return;

    try {
      setIsDeleting(true);
      await deleteMemory(vaultId, memoryId);
      
      triggerHaptic('success');
      useUIStore.getState().showToast("Memory deleted");
      
      safeExit();
    } catch (err) {
      console.error("Delete Error:", err);
      useUIStore.getState().showAlert({
        title: "Delete Failed",
        message: "We couldn't delete this memory. Please check your connection and try again.",
        type: "error"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = useCallback(() => {
    if (isDeleting || isSharing) return;
    triggerHaptic('error');
    
    useUIStore.getState().showAlert({
      title: "Delete Memory?",
      message: "This will permanently remove this memory from the vault. This action cannot be undone.",
      type: "confirm",
      onConfirm: handleDelete,
    });
  }, [isDeleting, isSharing, handleDelete]);

  const handleShare = async () => {
    if (isSharing || !memory?.imageURL) return;

    try {
      setIsSharing(true);
      triggerHaptic('light');

      const rawFilename = memory.imageURL.split('/').pop()?.split('?')[0] || 'shared-image.jpg';
      const filename = decodeURIComponent(rawFilename).split('/').pop() || 'shared-image.jpg';
      const fileUri = FileSystem.cacheDirectory + filename;

      const downloaded = await FileSystem.downloadAsync(
        memory.imageURL,
        fileUri
      );

      if (downloaded.status === 200) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      useUIStore.getState().showAlert({
        title: "Sharing Failed",
        message: "We couldn't share this image. Please try again later.",
        type: "error"
      });
    } finally {
      setIsSharing(false);
    }
  };

   useEffect(() => {
     if (!vaultId || !memoryId) return;
     
     const unsubscribe = subscribeToMemory(
       vaultId, 
       memoryId, 
       (data) => {
         if (hasExitedRef.current || isDeletingAccount) {
           safeExit();
           return;
         }
         
         if (!data) {
           console.log("❌ Document not found or was deleted");
           setMemory(null);
           setLoading(false);
           setError(true);
           return;
         }

         // HARD GUARD: For image memories, do not stop loading until imageURL exists
         if (data.type === "image" && !data.imageURL) {
           console.log("⏳ Image URL still missing in Firestore, staying in loading state...");
           setMemory(data);
           setLoading(true);
           // Show non-blocking toast for long-polling feedback
           useUIStore.getState().showToast("Loading image...");
           return;
         }
 
         setMemory(data);
         setLoading(false);
         setError(false);
       },
       (error) => {
         if (error.code === 'permission-denied' || isDeletingAccount) {
           safeExit();
           return;
         }
       }
     );
 
     return () => unsubscribe();
   }, [memoryId, vaultId, isDeletingAccount, safeExit]);

  // --- Header Config (DISABLED NATIVE HEADER) ---
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const insets = useSafeAreaInsets();

  // --- Animations ---
  useEffect(() => {
    if (memory && !hasAnimated) {
      Animated.sequence([
        Animated.timing(imageFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(100),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(150),
        Animated.timing(reactionsFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setHasAnimated(true));
    }
  }, [memory, hasAnimated]);

  // --- Mark Viewed ---
  useFocusEffect(
    useCallback(() => {
      if (!memoryId || !vaultId || !user) return;
      markMemoryViewed(vaultId, memoryId, user.uid);
    }, [vaultId, user, memoryId])
  );

   // --- Render Guards ---
   if (loading || (memory?.type === "image" && !memory.imageURL)) {
     return (
       <View style={[styles.centered, { backgroundColor: '#000' }]}>
         <ActivityIndicator size="large" color="#6C63FF" />
       </View>
     );
   }
 
   if (error || !memory) {
    return (
      <View style={[styles.centered, { backgroundColor: '#000' }]}>
        <Text style={styles.errorText}>This memory is no longer available</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ContentWrapper = ({ children }: { children: React.ReactNode }) => (
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={(e) => {
        const { pageX = 0, pageY = 0 } = e.nativeEvent || {};
        setTouchPos({ x: pageX, y: pageY });
        setOpenPicker(true);
      }}
      delayLongPress={250}
      style={{ flex: 1 }}
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar 
        backgroundColor="#000000" 
        translucent={false}
        barStyle="light-content" 
      />

      {/* UNIFIED CUSTOM HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {isOwner && (
            <TouchableOpacity 
              onPress={confirmDelete}
              style={styles.deleteButton}
              disabled={isDeleting || isSharing}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 5 }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}

          {hasImage && (
            <TouchableOpacity 
              onPress={handleShare}
              disabled={isSharing || isDeleting}
              style={styles.headerButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="share-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {hasImage ? (
        <View style={{ flex: 1 }}>
          <ContentWrapper>
            <View style={styles.imageContainer}>
              <Animated.View style={{ flex: 1, width: '100%', opacity: imageFade }}>
                <Image 
                  source={{ uri: memory.imageURL! }} 
                  style={styles.image}
                  resizeMode="contain"
                  fadeDuration={0}
                />
              </Animated.View>
            </View>
            
            <Animated.View style={[styles.metaContainer, { opacity: contentFade }]}>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.imageCaptionText}>{displayText}</Text>
              <Text style={styles.imageDateText}>{formattedDate}</Text>
              
              <Animated.View style={[styles.reactionWrapper, { opacity: reactionsFade }]}>
                <MemoryReactions 
                  vaultId={vaultId}
                  memoryId={memoryId}
                  reactions={memory.reactions}
                  openPicker={openPicker}
                  onClosePicker={() => setOpenPicker(false)}
                  touchPosition={touchPos}
                />
              </Animated.View>
            </Animated.View>
          </ContentWrapper>
        </View>
      ) : (
        <ContentWrapper>
          <View style={styles.centeredLayout}>
            <Animated.View style={[styles.textHeroContainer, { opacity: contentFade }]}>
              <Text style={styles.authorNameHero}>{authorName}</Text>
              <Text style={styles.heroText}>{displayText}</Text>
              <Text style={styles.heroDate}>{formattedDate}</Text>

              <Animated.View style={[styles.reactionWrapperHero, { opacity: reactionsFade }]}>
                <MemoryReactions 
                  vaultId={vaultId}
                  memoryId={memoryId}
                  reactions={memory.reactions}
                  openPicker={openPicker}
                  onClosePicker={() => setOpenPicker(false)}
                  touchPosition={touchPos}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </ContentWrapper>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  deleteButton: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 5,
  },
  deleteText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  metaContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: '#000000',
  },
  imageCaptionText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 8,
  },
  imageDateText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '400',
  },
  authorName: {
    color: '#6C63FF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authorNameHero: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  reactionWrapper: {
    marginTop: 16,
  },
  centeredLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#000000',
  },
  textHeroContainer: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 400, 
  },
  heroText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 44,
  },
  heroDate: {
    color: '#8E8E93',
    marginTop: 20,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  reactionWrapperHero: {
    marginTop: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  errorText: {
    color: '#FF453A',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
  },
  retryText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default MemoryDetailScreen;
