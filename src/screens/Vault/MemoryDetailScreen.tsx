import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { VaultStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import MemoryReactions from '../../components/MemoryReactions';
import { subscribeToMemory, markMemoryViewed, Memory } from '../../services/memoryService';

type MemoryDetailRouteProp = RouteProp<VaultStackParamList, 'MemoryDetail'>;

/**
 * MemoryDetailScreen
 * A production-safe, real-time screen for displaying a single memory's full details.
 * 
 * DESIGN PRINCIPLES:
 * 1. Single Source of Truth: Subscribes directly to Firestore.
 * 2. Crash-safety: Robust fallbacks for all optional fields.
 * 3. Aesthetics: Minimalist dark theme with focus on the content.
 */
const MemoryDetailScreen = () => {
  const route = useRoute<MemoryDetailRouteProp>();
  const navigation = useNavigation();
  const { memoryId, vaultId } = route.params;

  const { user } = useAuthStore();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);

  // VIEW TRACKING EFFECT (STRICT)
  useEffect(() => {
    if (!memory || !user) return;

    const alreadyViewed = memory.viewedBy?.includes(user.uid);

    if (!alreadyViewed) {
      markMemoryViewed(vaultId, memory.id, user.uid);
    }
  }, [memory, user?.uid]); // Reacts to live updates safely

  useEffect(() => {
    setLoading(true);
    
    // Subscribe to the single memory document in real-time
    const unsubscribe = subscribeToMemory(
      vaultId,
      memoryId,
      (data) => {
        setMemory(data);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [vaultId, memoryId]);

  // Handle Loading State
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  // Handle "Memory Not Found" State (e.g. if deleted while viewing)
  if (!memory) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Memory not found or deleted.</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- DATE HANDLING (STRICT) ---
  const displayDate = memory.memoryDate ?? memory.createdAt ?? new Date();

  const dateObj = displayDate && typeof displayDate === 'object' && 'seconds' in displayDate
    ? new Date(displayDate.seconds * 1000)
    : new Date(displayDate as any);

  const formattedDate = dateObj.toDateString();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Memory Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* IMAGE */}
        {memory.imageURL && typeof memory.imageURL === 'string' && (
          <Image 
            source={{ uri: memory.imageURL }} 
            style={styles.image}
            resizeMode="contain"
          />
        )}

        <View style={styles.infoContainer}>
          {/* TEXT */}
          {memory.text && (
            <Text style={styles.textContent}>{memory.text}</Text>
          )}

          {/* DATE */}
          <View style={styles.divider} />
          <Text style={styles.dateText}>{formattedDate}</Text>

          {/* REACTION SYSTEM */}
          <MemoryReactions 
            vaultId={vaultId} 
            memoryId={memory.id} 
            reactions={memory.reactions} 
          />
        </View>
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    paddingTop: 60,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  image: {
    width: width,
    height: 350,
    backgroundColor: '#1C1C1E',
  },
  infoContainer: {
    padding: 20,
  },
  textContent: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginBottom: 12,
  },
  dateText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default MemoryDetailScreen;
