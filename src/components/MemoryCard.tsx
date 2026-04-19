import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity,
  Modal,
  Pressable
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { Memory, toggleReaction } from '../services/memoryService';
import MemoryReactions, { EMOJIS } from './MemoryReactions';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface MemoryCardProps {
  memory: Memory;
  vaultId: string;
}

/**
 * MemoryCard
 * Refactored to support long-press reaction picker.
 */
const MemoryCard: React.FC<MemoryCardProps> = ({ memory, vaultId }) => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [openPicker, setOpenPicker] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const handleNavigate = () => {
    navigation.navigate('MemoryDetail', { memoryId: memory.id, vaultId });
  };

  // --- DATE HANDLING ---
  const displayDate = memory.memoryDate ?? memory.createdAt;
  const dateObj = displayDate && typeof displayDate === 'object' && 'seconds' in displayDate
    ? new Date(displayDate.seconds * 1000)
    : new Date();

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={handleNavigate}
      onLongPress={(e) => {
        const { pageX = 0, pageY = 0 } = e.nativeEvent || {};
        setTouchPos({ x: pageX, y: pageY });
        setOpenPicker(true);
      }}
      delayLongPress={250}
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
            openPicker={openPicker}
            onClosePicker={() => setOpenPicker(false)}
            touchPosition={touchPos}
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
  },
  // PICKER STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    alignItems: 'center',
    // Shadow / Elevation
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  pickerButton: {
    marginHorizontal: 8,
  },
  pickerEmoji: {
    fontSize: 26,
  }
});

export default React.memo(MemoryCard);
