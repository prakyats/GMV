import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { markMemoryViewed, subscribeToMemory } from '../../services/memoryService';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import MemoryReactions from '../../components/MemoryReactions';

type MemoryDetailRouteProp = RouteProp<MainStackParamList, 'MemoryDetail'>;

/**
 * MemoryDetailScreen
 * Refactored to support shared controlled reactions and real-time sync.
 */
const MemoryDetailScreen = () => {
  const route = useRoute<MemoryDetailRouteProp>();
  const navigation = useNavigation();
  const { memoryId, vaultId } = route.params;
  const { user } = useAuthStore();
  const { height: screenHeight } = useWindowDimensions();

  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 0. RESET ON ID CHANGE
  useEffect(() => {
    setMemory(null);
    setError(false);
    setLoading(true);
  }, [memoryId]);

  // 1. REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!vaultId || !memoryId) return;
    
    setLoading(true);
    const unsubscribe = subscribeToMemory(vaultId, memoryId, (data) => {
      if (!data) {
        setError(true);
      } else {
        setMemory(data);
        setError(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [memoryId, vaultId]);

  // 2. FADE ANIMATION
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

  // 3. MARK VIEWED
  useFocusEffect(
    useCallback(() => {
      if (!memoryId || !vaultId || !user) return;
      markMemoryViewed(vaultId, memoryId, user.uid);
    }, [vaultId, user, memoryId])
  );

  // 4. HANDLERS
  const handleShare = async () => {
    try {
      if (!memory?.imageURL) return;
      const rawFilename = memory.imageURL.split('/').pop()?.split('?')[0] || 'shared-image.jpg';
      const filename = decodeURIComponent(rawFilename);
      const fileUri = FileSystem.cacheDirectory + filename;
      const folderPath = fileUri.substring(0, fileUri.lastIndexOf('/'));
      
      try {
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      } catch (e) {}

      const download = await FileSystem.downloadAsync(memory.imageURL, fileUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri);
      }
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  // 5. RENDER GUARDS
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

  // --- DERIVED RENDER DATA ---
  const displayText = memory.caption || "";
  const hasImage = !!memory.imageURL;
  const isImageMemory = hasImage;
  
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* HEADER */}
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

        <ContentWrapper>
          {hasImage ? (
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
                  <View style={styles.reactionWrapper}>
                    <MemoryReactions 
                      vaultId={vaultId}
                      memoryId={memoryId}
                      reactions={memory.reactions}
                      openPicker={openPicker}
                      onClosePicker={() => setOpenPicker(false)}
                      touchPosition={touchPos}
                    />
                  </View>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.centeredLayout}>
              <View style={styles.textHeroContainer}>
                <Text style={styles.heroText}>{displayText}</Text>
                <Text style={styles.heroDate}>{formattedDate}</Text>
                <View style={styles.reactionWrapperHero}>
                  <MemoryReactions 
                    vaultId={vaultId}
                    memoryId={memoryId}
                    reactions={memory.reactions}
                    openPicker={openPicker}
                    onClosePicker={() => setOpenPicker(false)}
                    touchPosition={touchPos}
                  />
                </View>
              </View>
            </View>
          )}
        </ContentWrapper>
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
    padding: 12,
  },
  headerShareButton: {
    padding: 8,
  },
  backText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
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
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    marginBottom: 8,
  },
  imageDateText: {
    color: '#888888',
    fontSize: 14,
    marginTop: 6,
  },
  reactionWrapper: {
    marginTop: 12,
  },
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
    fontSize: 28,
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
  reactionWrapperHero: {
    marginTop: 24,
  },
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
