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
import { ScalePressable } from './common/ScalePressable';
import { FadeInStagger } from './common/FadeInStagger';
import { triggerHaptic } from '../utils/haptics';
import { formatUserDisplayName } from '../utils/user';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface MemoryCardProps {
  memory: Memory;
  vaultId: string;
  index: number;
}

/**
 * MemoryCard
 * Refactored to support long-press reaction picker.
 */
const MemoryCard: React.FC<MemoryCardProps> = ({ memory, vaultId, index }) => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const [openPicker, setOpenPicker] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const handleNavigate = () => {
    // Immediate navigation for zero lag perception
    navigation.navigate('MemoryDetail', { memoryId: memory.id, vaultId });
  };

  const handleLongPress = (e: any) => {
    const { pageX = 0, pageY = 0 } = e.nativeEvent || {};
    setTouchPos({ x: pageX, y: pageY });
    setOpenPicker(true);
    triggerHaptic('light'); // Controlled tactile click
  };

  // --- DATE HANDLING ---
  const displayDate = memory.memoryDate ?? memory.createdAt;
  const dateObj = displayDate && typeof displayDate === 'object' && 'seconds' in displayDate
    ? new Date(displayDate.seconds * 1000)
    : new Date();

  return (
    <FadeInStagger index={index}>
      <ScalePressable 
        onPress={handleNavigate}
        onLongPress={handleLongPress}
        style={styles.card}
      >
        <View>
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
                  : formatUserDisplayName(memory.createdBy)}
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
        </View>
      </ScalePressable>
    </FadeInStagger>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E', // System Background Secondary
    width: '92%', // Leave space for margins
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 20, // More pronounced rounding
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A',
  },
  image: {
    width: '100%',
    height: 280, // Slightly taller for more presence
    backgroundColor: '#2C2C2E',
  },
  content: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400',
    marginBottom: 12, // More air between text and footer
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 8,
  },
  poster: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  reactionContainer: {
    marginTop: 0,
    paddingTop: 8,
  },
  // PICKER STYLES (Keep existing logic but refine container)
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
