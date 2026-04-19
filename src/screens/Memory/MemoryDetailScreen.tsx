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
import { ScalePressable } from '../../components';
import { triggerHaptic } from '../../utils/haptics';
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
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Sequenced animation values
  const imageFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const reactionsFade = useRef(new Animated.Value(0)).current;

  // 0. RESET ON ID CHANGE
  useEffect(() => {
    setMemory(null);
    setError(false);
    setLoading(true);
    setHasAnimated(false);
    imageFade.setValue(0);
    contentFade.setValue(0);
    reactionsFade.setValue(0);
  }, [memoryId]);

  // --- DERIVED RENDER DATA (MOVED TO TOP TO FIX SCOPE ERROR) ---
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

  // 1.5 NATIVE HEADER CONFIG (MUST BE BEFORE EARLY RETURNS)
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: !hasImage,
      headerStyle: hasImage ? { backgroundColor: '#000000', elevation: 0, shadowOpacity: 0 } : undefined,
      headerTitle: '',
      headerTintColor: '#FFFFFF',
      headerRight: () => (
        hasImage ? (
          <ScalePressable 
            onPress={handleShare} 
            disabled={isSharing}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            style={{ opacity: isSharing ? 0.5 : 1, padding: 8, marginRight: 8 }}
          >
            <Ionicons name="share-outline" size={22} color="#FFFFFF" />
          </ScalePressable>
        ) : null
      ),
    });
  }, [navigation, hasImage, isSharing]);

  // 2. CONTROLLED SEQUENCING
  useEffect(() => {
    if (memory && !hasAnimated) {
      Animated.sequence([
        // 1. Image fades in first
        Animated.timing(imageFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // 2. Metadata fades in after 100ms
        Animated.delay(100),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // 3. Reactions fade in after 150ms
        Animated.delay(150),
        Animated.timing(reactionsFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setHasAnimated(true));
    }
  }, [memory, hasAnimated]);

  // 3. MARK VIEWED
  useFocusEffect(
    useCallback(() => {
      if (!memoryId || !vaultId || !user) return;
      markMemoryViewed(vaultId, memoryId, user.uid);
    }, [vaultId, user, memoryId])
  );

  // 4. HANDLERS
  const handleShare = async () => {
    if (isSharing || !memory?.imageURL) return;

    try {
      setIsSharing(true);
      triggerHaptic('light');

      // RESTORE ORIGINAL FILENAME RESOLUTION LOGIC (ZERO IMPROVEMENTS)
      const rawFilename = memory.imageURL.split('/').pop()?.split('?')[0] || 'shared-image.jpg';
      const filename = decodeURIComponent(rawFilename).split('/').pop() || 'shared-image.jpg';
      const fileUri = FileSystem.cacheDirectory + filename;

      const downloaded = await FileSystem.downloadAsync(
        memory.imageURL,
        fileUri
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri);
      }

    } catch (e) {
      console.warn('Share failed', e);
    } finally {
      setIsSharing(false);
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

  // 3. MARK VIEWED (MOVED AFTER EARLY RETURNS)

  const ContentWrapper = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={(e) => {
        const { pageX = 0, pageY = 0 } = e.nativeEvent || {};
        setTouchPos({ x: pageX, y: pageY });
        setOpenPicker(true);
      }}
      delayLongPress={250}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={styles.safeArea}>
      <StatusBar 
        backgroundColor={hasImage ? "#000000" : "transparent"} 
        translucent={!hasImage}
        barStyle="light-content" 
      />
      
      {hasImage ? (
        <View style={styles.imageLayout} pointerEvents="box-none">
          <ContentWrapper>
            <Animated.View style={[styles.imageContainer, { height: screenHeight * 0.65, opacity: imageFade }]}>
              <Image 
                source={{ uri: memory.imageURL! }} 
                style={styles.image}
                resizeMode="cover"
              />
            </Animated.View>
            
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,1)']}
              style={styles.bottomOverlay}
            >
              <Animated.View style={[styles.imageContent, { opacity: contentFade }]}>
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
            </LinearGradient>
          </ContentWrapper>
        </View>
      ) : (
        <ContentWrapper>
          <View style={styles.centeredLayout}>
            <Animated.View style={[styles.textHeroContainer, { opacity: contentFade }]}>
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
  container: {
    flex: 1,
  },
  headerShareButton: {
    marginRight: 12,
    padding: 8,
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
    paddingTop: 100,
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  imageContent: {
    width: '100%',
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A',
  },
  retryText: {
    color: '#6C63FF',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default MemoryDetailScreen;
