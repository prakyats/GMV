import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, Pressable } from 'react-native';
import { MainStackParamList, Memory } from '../../navigation/types';
import { LinearGradient } from 'expo-linear-gradient';

interface DiscoveryMemoryCardProps {
  memory: Memory;
  userId: string;
  popularityThreshold?: number;
  variant?: 'hero' | 'list';
  style?: ViewStyle;
  onPress?: (memory: Memory) => void;
}

const DiscoveryMemoryCard: React.FC<DiscoveryMemoryCardProps> = ({ 
  memory, 
  userId,
  popularityThreshold = 5,
  variant = 'list', 
  style, 
  onPress 
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
    <Pressable 
      onPress={() => onPress?.(memory)}
      style={({ pressed }) => [
        styles.card, 
        isHero ? styles.heroCard : styles.listCard,
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
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
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'hidden',
  },
  listCard: {
    width: 150,
    height: 190,
  },
  heroCard: {
    width: '100%',
    height: 240,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  labelContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dynamicLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.9,
    letterSpacing: 1,
    fontWeight: '800',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  heroCaption: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default DiscoveryMemoryCard;
