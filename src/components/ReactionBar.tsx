import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { toggleReaction } from '../services/memoryService';

interface ReactionBarProps {
  vaultId: string;
  memoryId: string;
  reactions: Record<string, string>; // { userId: emoji }
}

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢'];

/**
 * ReactionBar
 * Renders a horizontal list of emojis with real-time counts.
 * Handles the optimistic UI and transactional logic for toggling reactions.
 */
const ReactionBar: React.FC<ReactionBarProps> = ({ vaultId, memoryId, reactions }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);

  // Group reactions by emoji type
  const counts = EMOJIS.reduce((acc, emoji) => {
    acc[emoji] = Object.values(reactions).filter(r => r === emoji).length;
    return acc;
  }, {} as Record<string, number>);

  const handleToggle = async (emoji: string) => {
    if (!user) return;
    
    setLoading(emoji);
    try {
      await toggleReaction(vaultId, memoryId, user.uid, emoji);
    } catch (err) {
      console.error("Reaction failed:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      {EMOJIS.map((emoji) => {
        const isSelected = reactions[user?.uid || ''] === emoji;
        const count = counts[emoji];

        return (
          <TouchableOpacity
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
              <View style={styles.innerButton}>
                <Text style={styles.emojiText}>{emoji}</Text>
                {count > 0 && <Text style={styles.countText}>{count}</Text>}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
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
});

export default React.memo(ReactionBar);
