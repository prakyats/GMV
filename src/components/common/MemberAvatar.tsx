import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { VaultMember } from '../../navigation/types';
import { getUserInitial } from '../../utils/user';

interface MemberAvatarProps {
  member: VaultMember;
  isCurrentUser: boolean;
  isOwner: boolean;
  size?: number;
}

/** Deterministic color palette — derived from userId, never random */
const AVATAR_COLORS = [
  '#5E5CE6', // Indigo
  '#30D158', // Mint green
  '#FF6B6B', // Coral red
  '#FF9F0A', // Amber
  '#64D2FF', // Sky blue
  '#BF5AF2', // Purple
  '#FF375F', // Pink
  '#34C759', // Green
];

const getAvatarColor = (userId: string): string => {
  const hash = [...userId].reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Initial extraction logic moved to global utility getUserInitial

/**
 * Premium member avatar component.
 * - Deterministic color (never changes per user)
 * - Purple "You" ring for current user
 * - Crown badge for vault owner
 */
const MemberAvatar: React.FC<MemberAvatarProps> = ({
  member,
  isCurrentUser,
  isOwner,
  size = 36,
}) => {
  const [loadError, setLoadError] = useState(false);
  const bgColor = getAvatarColor(member.id);
  const initial = getUserInitial(member);

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
    borderWidth: isCurrentUser ? 2 : 0,
    borderColor: isCurrentUser ? '#6C63FF' : 'transparent',
  };

  const initialsStyle = {
    fontSize: size * 0.38,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  };

  return (
    <View style={styles.wrapper}>
      {member.photoURL && !loadError ? (
        <Image 
          source={{ uri: member.photoURL }} 
          style={[styles.avatar, avatarStyle, { borderWidth: avatarStyle.borderWidth, borderColor: avatarStyle.borderColor }]} 
          onError={() => setLoadError(true)}
        />
      ) : (
        <View style={[styles.avatar, avatarStyle]}>
          <Text style={initialsStyle}>{initial}</Text>
        </View>
      )}
      {isOwner && (
        <View style={styles.crownBadge}>
          <Text style={styles.crownText}>👑</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  crownBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 1,
    zIndex: 2,
  },
  crownText: {
    fontSize: 12,
  },
});

export default MemberAvatar;
