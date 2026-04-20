import * as React from 'react';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultStackParamList, VaultMember } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { subscribeToVault } from '../../services/vaultService';
import { ANIMATION } from '../../constants/theme';
import { getUserDisplayName, formatUserDisplayName, getSortableName } from '../../utils/user';
import MemberAvatar from '../../components/common/MemberAvatar';

type VaultMembersRouteProp = RouteProp<VaultStackParamList, 'VaultMembers'>;

// ─── Skeleton Row ─────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <View style={styles.row}>
    <View style={styles.skeletonAvatar} />
    <View style={styles.skeletonTextBlock}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
    </View>
  </View>
);

// ─── Member Row ───────────────────────────────────────────────────────────
interface MemberRowProps {
  member: VaultMember;
  isCurrentUser: boolean;
  isOwner: boolean;
}

const MemberRow: React.FC<MemberRowProps> = ({ member, isCurrentUser, isOwner }) => (
  <View style={styles.row}>
    <MemberAvatar
      member={member}
      isCurrentUser={isCurrentUser}
      isOwner={isOwner}
      size={44}
    />
    <View style={styles.rowText}>
      <Text style={styles.memberName} numberOfLines={1}>
        {formatUserDisplayName(member)}
      </Text>
      <View style={styles.badgeRow}>
        {isOwner && (
          <View style={[styles.badge, styles.ownerBadge]}>
            <Text style={styles.badgeText}>Owner</Text>
          </View>
        )}
        {isCurrentUser && (
          <View style={[styles.badge, styles.youBadge]}>
            <Text style={styles.badgeText}>You</Text>
          </View>
        )}
      </View>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────
const VaultMembersListScreen = () => {
  const route = useRoute<VaultMembersRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList, 'VaultMembers'>>();
  const { vaultId, createdBy } = route.params;
  const { user, isDeletingAccount } = useAuthStore();

  const [memberProfiles, setMemberProfiles] = useState<VaultMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Stability Guards ──────────────────────────────────────────────────
  const hasExitedRef = useRef(false);

  const safeExit = useCallback(() => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // ─── Live Subscription ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const unsub = subscribeToVault(
        vaultId, 
        (snap) => {
          if (hasExitedRef.current || isDeletingAccount) {
            safeExit();
            return;
          }
          
          if (!snap.exists()) {
            safeExit();
            return;
          }

          const data = snap.data();
          setMemberProfiles(data.memberProfiles || []);
          setLoading(false);

          // Fade in on first load
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: ANIMATION.FADE_DURATION,
            useNativeDriver: true,
          }).start();
        },
        (error) => {
          if (error.code === "permission-denied" || isDeletingAccount) {
            safeExit();
            return;
          }
          setError('Unable to load members.');
          setLoading(false);
        }
      );
      return unsub;
    } catch (e) {
      setError('Unable to load members right now.');
      setLoading(false);
      return undefined;
    }
  }, [vaultId, fadeAnim, isDeletingAccount, safeExit]);

  // ─── Sort: creator → current user → alphabetical ───────────────────────
  const sortedMembers = useMemo<VaultMember[]>(() => {
    return [...memberProfiles].sort((a, b) => {
      // Creator always first
      if (a.id === createdBy && b.id !== createdBy) return -1;
      if (b.id === createdBy && a.id !== createdBy) return 1;
      // Current user second
      if (a.id === user?.uid && b.id !== user?.uid) return -1;
      if (b.id === user?.uid && a.id !== user?.uid) return 1;
      
      // Alphabetical using stable sortable name
      return getSortableName(a).localeCompare(getSortableName(b));
    });
  }, [memberProfiles, createdBy, user?.uid]);

  // ─── Retry ─────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fadeAnim.setValue(0);
  }, [fadeAnim]);

  // ─── Render: Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  // ─── Render: Error ─────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render: Empty ─────────────────────────────────────────────────────
  if (sortedMembers.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>No members found for this vault.</Text>
      </View>
    );
  }

  // ─── Render: List ──────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.listContainer}>
          {sortedMembers.map((member) => (
            <View key={member.id}>
              <MemberRow
                member={member}
                isCurrentUser={member.id === user?.uid}
                isOwner={member.id === createdBy}
              />
            </View>
          ))}
        </View>

        <Text style={styles.footerText}>
          {sortedMembers.length} {sortedMembers.length === 1 ? 'member' : 'members'} in this vault
        </Text>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  listContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadge: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
  },
  youBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
  },
  skeletonTextBlock: {
    flex: 1,
    marginLeft: 14,
  },
  skeletonLine: {
    height: 12,
    width: '60%',
    borderRadius: 6,
    backgroundColor: '#2C2C2E',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
  },
  retryText: {
    color: '#6C63FF',
    fontSize: 15,
    fontWeight: '600',
  },
  footerText: {
    color: '#3A3A3C',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 0.2,
  },
});

export { VaultMembersListScreen };
export default VaultMembersListScreen;
