import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultStackParamList, MainStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { Memory } from '../services/memoryService';
import MemoryReactions from './MemoryReactions';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface MemoryCardProps {
  memory: Memory;
  vaultId: string;
}

/**
 * MemoryCard
 * A performance-optimized, reusable component for rendering memories in a feed.
 * Wrap in React.memo to prevent unnecessary re-renders during list scrolling.
 */
const MemoryCard: React.FC<MemoryCardProps> = ({ memory, vaultId }) => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  const handlePress = () => {
    navigation.navigate('MemoryDetail', { memoryId: memory.id, vaultId });
  };

  // --- DATE HANDLING ---
  const displayDate = memory.memoryDate ?? memory.createdAt ?? new Date();
  const dateObj = displayDate && typeof displayDate === 'object' && 'seconds' in displayDate
    ? new Date(displayDate.seconds * 1000)
    : new Date(displayDate as any);

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={handlePress}
      style={styles.card}
    >
      {memory.imageURL && (
        <Image 
          source={{ uri: memory.imageURL }} 
          style={styles.image} 
          resizeMode="cover"
        />
      )}
      
      <View style={styles.content}>
        {memory.caption ? (
          <Text style={styles.text} numberOfLines={3}>{memory.caption}</Text>
        ) : null}
        
        <View style={styles.footer}>
          <Text style={styles.poster}>
            {memory.createdBy.id === user?.uid 
              ? "You" 
              : (memory.createdBy.name?.trim() || "Member")}
          </Text>
          <Text style={styles.date}>{dateObj.toDateString()}</Text>
        </View>

        {/* REACTION SYSTEM */}
        <View style={styles.reactionContainer}>
          <MemoryReactions 
            vaultId={vaultId} 
            memoryId={memory.id} 
            reactions={memory.reactions}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#2C2C2E',
  },
  content: {
    padding: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  poster: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '600',
  },
  reactionContainer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingTop: 12,
  }
});

export default React.memo(MemoryCard);
