import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { MainStackParamList, Memory } from '../../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';
import { ScalePressable } from '../common/ScalePressable';
import { FadeInStagger } from '../common/FadeInStagger';

interface DiscoveryMemoryCardProps {
  memory: Memory;
  userId: string;
  popularityThreshold?: number;
  variant?: 'hero' | 'list';
  style?: ViewStyle;
  onPress?: (memory: Memory) => void;
  index?: number;
}

const DiscoveryMemoryCard: React.FC<DiscoveryMemoryCardProps> = ({ 
  memory, 
  userId,
  popularityThreshold = 5,
  variant = 'list', 
  style, 
  onPress,
  index = 0
}) => {
  const isHero = variant === 'hero';

  // SIGNAL-PRIORITY LABEL LOGIC
  const getDynamicLabel = () => {
    const isUnseen = !memory.viewedBy?.includes(userId);
    const hasReacted = !!memory.reactions?.[userId];
    const reactionCount = Object.keys(memory.reactions || {}).length;
    const isPopular = reactionCount >= popularityThreshold && reactionCount > 0;

    if (isUnseen) return "New for you";
    if (hasReacted) return "You reacted";
    if (isPopular) return "Popular choice";

    // Fallback: From X years ago
    const today = new Date();
    const memDate = memory.memoryDate 
      ? new Date(memory.memoryDate.seconds * 1000)
      : memory.createdAt 
        ? new Date(memory.createdAt.seconds * 1000)
        : today;
    
    const years = today.getFullYear() - memDate.getFullYear();
    return years > 0 ? `From ${years} year${years > 1 ? 's' : ''} ago` : "On this day";
  };

  const dynamicLabel = getDynamicLabel();

  return (
    <FadeInStagger index={index}>
      <ScalePressable 
        onPress={() => onPress?.(memory)}
        style={[
          styles.card, 
          isHero ? styles.heroCard : styles.listCard,
          style
        ]}
      >
      {memory.imageURL ? (
        <Image
          source={{ uri: memory.imageURL }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.fallbackContainer} />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.95)']}
        style={styles.gradient}
      />

      <View style={styles.labelContainer}>
        <Text style={styles.dynamicLabel}>{dynamicLabel.toUpperCase()}</Text>
      </View>

      <View style={styles.content}>
        <Text 
          style={[styles.caption, isHero && styles.heroCaption]} 
          numberOfLines={2}
        >
          {memory.caption}
        </Text>
      </View>
      </ScalePressable>
    </FadeInStagger>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#1C1C1E',
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: 'hidden',
  },
  listCard: {
    width: 160,
    height: 220,
  },
  heroCard: {
    width: '100%',
    height: 300,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2C2C2E',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  labelContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  dynamicLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  heroCaption: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
});

export default DiscoveryMemoryCard;
