import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Pressable, 
  Animated, 
  useWindowDimensions, 
  Easing,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { MainStackParamList, Memory } from '../../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { markMemoryViewed, toggleReaction, getMemoryById } from '../../services/memoryService';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const SESSION_SHOWN_FEEDBACK = new Set<string>();

type MemoryDetailRouteProp = RouteProp<MainStackParamList, 'MemoryDetail'>;

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢'];

const MemoryDetailScreen = () => {
  const route = useRoute<MemoryDetailRouteProp>();
  const navigation = useNavigation();
  const { memoryId, vaultId } = route.params;
  const { user } = useAuthStore();
  const { height: screenHeight } = useWindowDimensions();

  const [memory, setMemory] = React.useState<Memory | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [localReactions, setLocalReactions] = React.useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Derived Properties (Must be defined before hooks)
  const displayText = memory?.caption || "";
  const hasImage = !!memory?.imageURL;
  const isImageMemory = hasImage;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 0. RESET ON ID CHANGE (Prevents stale memory flash)
  useEffect(() => {
    setMemory(null);
    setError(false);
    setLoading(true);
  }, [memoryId]);

  // 1. INITIAL FETCH (Race-Safe)
  useEffect(() => {
    let isActive = true;

    const fetchInitial = async () => {
      try {
        setLoading(true);
        const data = await getMemoryById(vaultId, memoryId);
        if (!isActive) return;

        if (!data) {
          setError(true);
          return;
        }

        setMemory(data);
      } catch (err) {
        console.error("MemoryDetail Initial Fetch Error:", err);
        if (isActive) setError(true);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchInitial();
    return () => { isActive = false; };
  }, [memoryId, vaultId]);

  // 2. REACTION STATE SYNC (Safe)
  useEffect(() => {
    if (!memory) return;
    setLocalReactions(memory.reactions || {});
  }, [memory?.id]);

  useEffect(() => {
    if (memory) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [fadeAnim, memory]);

  // SMART REFRESH: Sync data when screen is focused
  const fetchMemory = React.useCallback(async () => {
    if (!vaultId || isUpdating || !memoryId) return;
    
    try {
      const updated = await getMemoryById(vaultId, memoryId);
      if (updated) {
        setLocalReactions(updated.reactions || {});
      }
    } catch (err) {
      console.error("Failed to refresh memory:", err);
    }
  }, [vaultId, memoryId, isUpdating]);

  useFocusEffect(
    React.useCallback(() => {
      if (!memoryId) return;
      fetchMemory();
      
      // 1. Mark Viewed
      if (vaultId && user) {
        markMemoryViewed(vaultId, memoryId, user.uid);
      }
    }, [fetchMemory, vaultId, user, memoryId])
  );

  const handleShare = async () => {
    try {
      if (!memory?.imageURL) return;

      // 1. DYNAMIC FILENAME & PATH (Goal: Handle nested Firebase folders)
      const rawFilename = memory.imageURL.split('/').pop()?.split('?')[0] || 'shared-image.jpg';
      const filename = decodeURIComponent(rawFilename);
      const fileUri = FileSystem.cacheDirectory + filename;

      // 2. ENSURE DIRECTORY EXISTS (Fixes java.io.IOException)
      const folderPath = fileUri.substring(0, fileUri.lastIndexOf('/'));
      try {
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      } catch (dirError) {
        // Folder might already exist, which is fine
        console.log('Cache directory check:', dirError);
      }

      // 3. SECURE DOWNLOAD
      const download = await FileSystem.downloadAsync(
        memory.imageURL,
        fileUri
      );

      // Share Original Image (No compression)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri);
      }

    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const handleToggle = async (emoji: string) => {
    if (!user || !vaultId || !memory) return;

    setIsUpdating(true);
    setLocalReactions(prev => {
      const next = { ...prev };
      if (next[user.uid] === emoji) {
        delete next[user.uid];
      } else {
        next[user.uid] = emoji;
      }
      return next;
    });

    try {
      await toggleReaction(vaultId, memoryId, user.uid, emoji);
    } catch (err) {
      console.error("Reaction failed:", err);
      setLocalReactions(memory.reactions || {});
    } finally {
      setIsUpdating(false);
    }
  };

  const renderReactions = () => {
    if (!user || !memory) return null;
    return (
      <View style={styles.reactionsContainer}>
        {EMOJIS.map((emoji) => {
          const isSelected = localReactions[user.uid] === emoji;
          const count = Object.values(localReactions).filter(v => v === emoji).length;

          return (
            <Pressable 
              key={emoji} 
              onPress={() => handleToggle(emoji)}
              style={styles.reactionItem}
            >
              <View style={[
                styles.emojiCircle,
                isSelected && styles.selectedEmojiCircle
              ]}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </View>
              {count > 0 && (
                <Text style={styles.countText}>{count}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  // --- RENDER GUARDS ---
  
  if (loading) {
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

  const dateObj = memory.memoryDate 
    ? new Date(memory.memoryDate.seconds * 1000)
    : memory.createdAt 
      ? new Date(memory.createdAt.seconds * 1000)
      : new Date();

  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* TOP NAVIGATION HEADER */}
        <View style={styles.header}>
          <Pressable 
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 }
            ]}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          {isImageMemory && (
            <TouchableOpacity 
              onPress={handleShare}
              style={styles.headerShareButton}
              activeOpacity={0.7}
            >
              <Ionicons name="share-outline" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {hasImage ? (
          /* 2. IMAGE MEMORY LAYOUT */
          <View style={styles.imageLayout}>
            <View style={[styles.imageContainer, { height: screenHeight * 0.6 }]}>
              <Image 
                source={{ uri: memory.imageURL! }} 
                style={styles.image}
                resizeMode="cover"
              />
            </View>
            
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              style={styles.bottomOverlay}
            >
              <View style={styles.imageContent}>
                <Text style={styles.imageCaptionText}>{displayText}</Text>
                <Text style={styles.imageDateText}>{formattedDate}</Text>
                {renderReactions()}
              </View>
            </LinearGradient>
          </View>
        ) : (
          /* 3. TEXT-ONLY MEMORY LAYOUT (Hero Style) */
          <View style={styles.centeredLayout}>
            <View style={styles.textHeroContainer}>
              <Text style={styles.heroText}>
                {displayText}
              </Text>
              <Text style={styles.heroDate}>
                {formattedDate}
              </Text>
              {renderReactions()}
            </View>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    zIndex: 10,
  },
  backButton: {
    padding: 12, // Respect padding >= 10 constraint
  },
  headerShareButton: {
    padding: 8,
  },
  backText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
  /* IMAGE STYLES */
  imageLayout: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  imageContent: {
    width: '100%',
  },
  imageCaptionText: {
    color: '#FFFFFF',
    fontSize: 24, // Production Polish value
    fontWeight: '600',
    lineHeight: 32,
    marginBottom: 8,
  },
  imageDateText: {
    color: '#888888',
    fontSize: 14,
    marginTop: 6,
  },
  /* REACTIONS */
  reactionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
  },
  reactionItem: {
    alignItems: 'center',
  },
  emojiCircle: {
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedEmojiCircle: {
    borderColor: '#6C63FF',
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
  },
  emojiText: {
    fontSize: 18,
  },
  countText: {
    color: '#aaaaaa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  /* CENTERED TEXT STYLES */
  centeredLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  textHeroContainer: {
    width: '100%',
    alignItems: 'center',
    maxWidth: 340, 
  },
  heroText: {
    color: '#FFFFFF',
    fontSize: 28, // Production Polish value
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 38,
  },
  heroDate: {
    color: '#888888',
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  /* UTILS */
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderRadius: 8,
  },
  retryText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default MemoryDetailScreen;
