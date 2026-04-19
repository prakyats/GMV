import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { mapMemoryDoc, getAllUserMemories } from '../../services/memoryService';
import { MainStackParamList } from '../../navigation/types';
import { Memory } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { getBestResurfacedMemory } from '../../algorithms/resurfaceEngine';
import { getResurfacedMemories, DiscoveryBuckets } from '../../algorithms/discoveryEngine';
import DiscoveryMemoryCard from '../../components/memory/DiscoveryMemoryCard';
import { syncEngagementStats, EngagementStats } from '../../services/engagementService';
import { Ionicons } from '@expo/vector-icons';



const OnThisDayScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, isDeletingAccount } = useAuthStore();

  const [memories, setMemories] = useState<(Memory & { vaultId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [isNewDay, setIsNewDay] = useState(false);

  // Session cooldown: IDs surfaced earlier this session get a 0.7× penalty
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // ── Fetch memories from Firestore (Global Mode) ──────────────────────────
  const fetchMemories = useCallback(async () => {
    if (!user?.uid || isDeletingAccount) return;
    try {
      setLoading(true);
      const data = await getAllUserMemories(user.uid);
      if (isDeletingAccount) return;
      setMemories(data);
    } catch (err) {
      console.error('Failed to fetch global memories for OnThisDay:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // ── Engagement sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || isDeletingAccount) return;
    syncEngagementStats(user.uid).then(res => {
      if (isDeletingAccount) return;
      if (res) {
        setStats(res as EngagementStats);
        // isNewDay is true only if the streak was actually incremented today
        // (i.e. the last call was yesterday, not already today)
        setIsNewDay(res.isNewDay === true);
      }
    });
  }, [user?.uid, isDeletingAccount]);

  // ── Engine integration ───────────────────────────────────────────────────
  const today  = new Date();
  const userId = user?.uid ?? 'anonymous';

  // Layer 1: scored hero
  const bestMemory = getBestResurfacedMemory<Memory>(memories, today, userId);

  // Layer 2: discovery buckets (hero excluded)
  const buckets: DiscoveryBuckets<Memory> = getResurfacedMemories<Memory>(
    memories,
    today,
    userId,
    bestMemory?.id,
    recentIds,
  );

  // Median-based popularity threshold across all bucket items
  const popularityThreshold = (() => {
    const counts = [
      ...buckets.anniversary,
      ...buckets.nearby,
      ...buckets.thisMonth,
      ...buckets.random,
    ].map(m => Object.keys(m.reactions ?? {}).length).sort((a, b) => a - b);

    if (counts.length === 0) return 3;
    const mid    = Math.floor(counts.length / 2);
    const median = counts.length % 2 !== 0
      ? counts[mid]
      : (counts[mid - 1] + counts[mid]) / 2;
    return Math.max(2, Math.ceil(median * 1.5));
  })();

  // Track hero into cooldown history (once per unique memory)
  useEffect(() => {
    if (bestMemory && !recentIds.includes(bestMemory.id)) {
      setRecentIds(prev => [bestMemory.id, ...prev].slice(0, 15));
    }
  }, [bestMemory?.id]);

  // ─── Animation ───────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderSection = (title: string, data: Memory[]) => {
    if (!data || data.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 40 }}
        >
          {data.map((m, index) => (
            <View key={m.id} style={{ marginRight: 12 }}>
              <DiscoveryMemoryCard
                memory={m}
                userId={userId}
                popularityThreshold={popularityThreshold}
                index={index}
                onPress={() =>
                  navigation.navigate('MemoryDetail', {
                    memoryId: m.id,
                    vaultId: m.vaultId || '',
                  })
                }
              />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ── Loading / no vault ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centred]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Hero */}
        {bestMemory ? (
          <View style={{ marginBottom: 32 }}>
            <DiscoveryMemoryCard
              memory={bestMemory}
              userId={userId}
              variant="hero"
              popularityThreshold={popularityThreshold}
              index={0}
              onPress={() =>
                navigation.navigate('MemoryDetail', {
                  memoryId: bestMemory.id,
                  vaultId: bestMemory.vaultId || '',
                })
              }
            />
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Ionicons name="calendar-outline" size={32} color="#38383A" />
            <Text style={styles.emptyTitle}>Nothing from this day</Text>
            <Text style={styles.emptySubText}>
              Memories from the past will automatically resurface here.
            </Text>
          </View>
        )}

        {renderSection('Anniversary', buckets.anniversary)}
        {renderSection('Nearby Memories', buckets.nearby)}
        {renderSection('This Month', buckets.thisMonth)}
        {renderSection('Random Picks', buckets.random)}

        {stats && (stats.daysOpenedStreak ?? 0) > 1 && (
          <View style={styles.streakFooter}>
            <Text style={styles.streakFooterText}>
              🔥 Keep it up! You're on a {stats.daysOpenedStreak} day streak.
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 140, // Account for Large Title space
    paddingBottom: 100, // Space for tab bar
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 13,
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  emptyHero: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  streakFooter: {
    marginTop: 48,
    padding: 24,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A',
  },
  streakFooterText: {
    color: '#FFD60A',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default OnThisDayScreen;