import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
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



const OnThisDayScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();

  const [memories, setMemories] = useState<(Memory & { vaultId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [isNewDay, setIsNewDay] = useState(false);

  // Session cooldown: IDs surfaced earlier this session get a 0.7× penalty
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // ── Fetch memories from Firestore (Global Mode) ──────────────────────────
  const fetchMemories = useCallback(async () => {
    try {
      if (!user?.uid) return;
      setLoading(true);
      const data = await getAllUserMemories(user.uid);
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
    if (!user) return;
    syncEngagementStats(user.uid).then(res => {
      if (res) {
        setStats(res as EngagementStats);
        // isNewDay is true only if the streak was actually incremented today
        // (i.e. the last call was yesterday, not already today)
        setIsNewDay(res.isNewDay === true);
      }
    });
  }, [user?.uid]);

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
          {data.map(m => (
            <View key={m.id} style={{ marginRight: 12 }}>
              <DiscoveryMemoryCard
                memory={m}
                userId={userId}
                popularityThreshold={popularityThreshold}
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



  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerText}>On This Day</Text>
          {isNewDay && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>New memories waiting</Text>
            </View>
          )}
        </View>
        {stats && (stats.daysOpenedStreak ?? 0) > 1 && (
          <View style={styles.streakPill}>
            <Text style={styles.streakText}>
              🔥 {stats.daysOpenedStreak} DAY STREAK
            </Text>
          </View>
        )}
      </View>

      {/* Hero */}
      {bestMemory ? (
        <View style={{ marginBottom: 20 }}>
          <DiscoveryMemoryCard
            memory={bestMemory}
            userId={userId}
            variant="hero"
            popularityThreshold={popularityThreshold}
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
          <Text style={styles.emptyTitle}>No memories from this day</Text>
          <Text style={styles.emptySubText}>
            Post memories with past dates to see them resurface here.
          </Text>
        </View>
      )}

      {renderSection('Anniversary', buckets.anniversary)}
      {renderSection('Nearby Memories', buckets.nearby)}
      {renderSection('This Month', buckets.thisMonth)}
      {renderSection('Random Picks', buckets.random)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  centred: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  streakPill: {
    backgroundColor: 'rgba(255, 101, 132, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 101, 132, 0.3)',
  },
  streakText: {
    color: '#FF6584',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#6C63FF',
    fontSize: 13,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyHero: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default OnThisDayScreen;