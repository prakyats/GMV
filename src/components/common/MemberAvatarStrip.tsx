import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VaultMember } from '../../navigation/types';
import { ScalePressable } from './ScalePressable';
import MemberAvatar from './MemberAvatar';

interface MemberAvatarStripProps {
  memberProfiles: VaultMember[];
  createdBy: string;
  currentUserId: string;
  onPress: () => void;
}

const MAX_VISIBLE = 5;
const OVERLAP = -9;

/**
 * Compact member presence strip for VaultDetailScreen.
 * Shows up to 5 overlapping avatars + overflow count.
 * Taps open the full VaultMembersScreen.
 */
const MemberAvatarStrip: React.FC<MemberAvatarStripProps> = ({
  memberProfiles,
  createdBy,
  currentUserId,
  onPress,
}) => {
  const totalCount = memberProfiles.length;
  const visible = memberProfiles.slice(0, MAX_VISIBLE);
  const overflow = totalCount - MAX_VISIBLE;

  return (
    <ScalePressable style={styles.container} onPress={onPress} useOpacity={false}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.title}>Members</Text>
        <View style={styles.countRow}>
          <Text style={styles.countText}>{totalCount}</Text>
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        </View>
      </View>

      {/* Avatar row */}
      <View style={styles.avatarRow}>
        {visible.map((member, index) => (
          <View
            key={member.id}
            pointerEvents="box-none"
            style={[
              styles.avatarWrapper,
              index > 0 && { marginLeft: OVERLAP },
              { zIndex: MAX_VISIBLE - index },
            ]}
          >
            <MemberAvatar
              member={member}
              isCurrentUser={member.id === currentUserId}
              isOwner={member.id === createdBy}
              size={36}
            />
          </View>
        ))}

        {overflow > 0 && (
          <View style={[styles.overflowBadge, { marginLeft: OVERLAP }]}>
            <Text style={styles.overflowText}>+{overflow}</Text>
          </View>
        )}

        {totalCount === 0 && (
          <Text style={styles.emptyHint}>No members yet</Text>
        )}
      </View>
    </ScalePressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  countText: {
    color: '#8E8E93',
    fontSize: 15,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    // shadow for separation between overlapping avatars
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  overflowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3A3A3C',
  },
  overflowText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHint: {
    color: '#8E8E93',
    fontSize: 14,
  },
});

export default MemberAvatarStrip;
