import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  useWindowDimensions
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { toggleReaction } from '../services/memoryService';
import { ANIMATION } from '../constants/theme';
import { ScalePressable } from './common/ScalePressable';
import { triggerHaptic } from '../utils/haptics';

interface ReactionBarProps {
  vaultId: string;
  memoryId: string;
  reactions: Record<string, string> | null; // { userId: emoji }
  openPicker?: boolean;
  onClosePicker?: () => void;
  touchPosition?: { x: number; y: number } | null;
}

export const EMOJIS = ['❤️', '👍', '😂', '😮', '😢'];

/**
 * MemoryReactions
 * Renders grouped reactions and manages a floating, animated reaction picker.
 * Anchored to the user's touch position with boundary detection.
 */
const MemoryReactions: React.FC<ReactionBarProps> = ({ 
  vaultId, 
  memoryId, 
  reactions: rawReactions,
  openPicker,
  onClosePicker,
  touchPosition
}) => {
  const { user } = useAuthStore();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [loading, setLoading] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Animation values for picker
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Individual pulses for each emoji (only for local user actions)
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;
  const [lastTappedEmoji, setLastTappedEmoji] = useState<string | null>(null);

  const reactions = rawReactions || {};

  // 1. DYNAMIC POSITIONING (MEMOIZED)
  const pickerStyle = useMemo(() => {
    if (!touchPosition) return { display: 'none' as const };

    const offsetY = 80;
    const offsetX = 120; // Half of ~240px picker width

    const rawTop = touchPosition.y - offsetY;
    const rawLeft = touchPosition.x - offsetX;

    // Edge Handling Logic
    const safeLeft = Math.max(20, Math.min(rawLeft, screenWidth - 260));
    const safeTop = Math.min(
      Math.max(80, rawTop),
      screenHeight - 120
    );

    return {
      position: 'absolute' as const,
      top: safeTop,
      left: safeLeft,
    };
  }, [touchPosition, screenWidth, screenHeight]);

  // 2. SYNC VISIBILITY & ANIMATION
  useEffect(() => {
    if (openPicker) {
      setVisible(true);
      
      // Reset values for repeated animation
      scale.setValue(0.8);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          ...ANIMATION.PRESS_SPRING,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      triggerHaptic('light'); // Picker reveal haptic
    }
  }, [openPicker, scale, opacity]);

  const handleClose = () => {
    setVisible(false);
    onClosePicker?.();
  };

  const grouped: Record<string, number> = {};
  Object.values(reactions).forEach((emoji) => {
    if (typeof emoji === 'string') {
      grouped[emoji] = (grouped[emoji] || 0) + 1;
      // Initialize pulse anim if needed
      if (!pulseAnims[emoji]) {
        pulseAnims[emoji] = new Animated.Value(1);
      }
    }
  });

  // Also initialize pulse anims for standard emojis
  EMOJIS.forEach(emoji => {
    if (!pulseAnims[emoji]) {
      pulseAnims[emoji] = new Animated.Value(1);
    }
  });

  const handleToggle = async (emoji: string) => {
    if (!user || loading !== null) return;
    
    // Set local state for pulse targeting
    setLastTappedEmoji(emoji);
    
    // Trigger Haptic & Pulse immediately (Physical Reward)
    triggerHaptic('medium');
    
    const anim = pulseAnims[emoji] || new Animated.Value(1);
    Animated.sequence([
      Animated.spring(anim, { 
        toValue: ANIMATION.REACTION_SCALE, 
        ...ANIMATION.PRESS_SPRING, 
        useNativeDriver: true 
      }),
      Animated.spring(anim, { 
        toValue: 1, 
        ...ANIMATION.PRESS_SPRING, 
        useNativeDriver: true 
      })
    ]).start(() => setLastTappedEmoji(null));

    setLoading(emoji);
    try {
      await toggleReaction(vaultId, memoryId, user.uid, emoji);
    } catch (err) {
      console.warn("Reaction failed:", err);
    } finally {
      setLoading(null);
      if (visible) handleClose();
    }
  };

  return (
    <>
      {Object.keys(grouped).length > 0 && (
        <View style={styles.container}>
          {Object.entries(grouped).map(([emoji, count]) => {
            const isSelected = reactions[user?.uid || ''] === emoji;

            return (
              <ScalePressable
                key={emoji}
                onPress={() => handleToggle(emoji)}
                disabled={loading !== null}
                style={[
                  styles.reactionButton,
                  isSelected && styles.selectedButton
                ]}
              >
                {loading === emoji ? (
                  <ActivityIndicator size="small" color="#6C63FF" />
                ) : (
                  <Animated.View style={[
                    styles.innerButton,
                    { transform: [{ scale: pulseAnims[emoji] || 1 }] }
                  ]}>
                    <Text style={styles.emojiText}>{emoji}</Text>
                    <Text style={styles.countText}>{count}</Text>
                  </Animated.View>
                )}
              </ScalePressable>
            );
          })}
        </View>
      )}

      {/* FLOATING REACTION PICKER */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable 
            style={styles.modalOverlay} 
            onPress={handleClose}
            accessibilityLabel="Close reaction picker"
            accessibilityRole="button"
            pointerEvents={visible ? "auto" : "none"}
          >
            {/* Transparent full-screen dismiss area */}
            <View style={StyleSheet.absoluteFill} />
          </Pressable>

        <Animated.View 
          style={[
            styles.pickerContainer, 
            pickerStyle,
            {
              opacity,
              transform: [{ scale }]
            }
          ]}
        >
          {EMOJIS.map((emoji) => (
            <ScalePressable
              key={emoji}
              onPress={() => handleToggle(emoji)}
              style={styles.pickerButton}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnims[emoji] || 1 }] }}>
                <Text style={styles.pickerEmoji}>{emoji}</Text>
              </Animated.View>
            </ScalePressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedButton: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderColor: '#6C63FF',
  },
  innerButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 16,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  // PICKER STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    alignItems: 'center',
    // Depth & Premium Shadows
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerButton: {
    marginHorizontal: 8,
  },
  pickerEmoji: {
    fontSize: 28,
  }
});

export default React.memo(MemoryReactions);
