import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useVaultStore } from '../../store/vaultStore';
import { useAuthStore } from '../../store/authStore';
import { ScalePressable } from '../../components';
import { ANIMATION } from '../../constants/theme';

const ProfileScreen = () => {
  const { user } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ANIMATION.FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);
  
  const handleLogout = async () => {
    try {
      useVaultStore.getState().clearVault();
      await authService.logout();
    } catch (error: any) {
      console.error(error.message);
    }
  };

  const SettingRow = ({ icon, label, onPress, color = '#FFFFFF', rightElement = null }: any) => (
    <ScalePressable style={styles.row} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {rightElement || <Ionicons name="chevron-forward" size={18} color="#38383A" />}
    </ScalePressable>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView 
        style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <Text style={styles.sectionHeader}>ACCOUNT</Text>
      <View style={styles.groupedContainer}>
        <SettingRow 
          icon="person-outline" 
          label="Edit Profile" 
          onPress={() => {}} 
        />
        <SettingRow 
          icon="notifications-outline" 
          label="Notifications" 
          onPress={() => {}} 
        />
        <SettingRow 
          icon="shield-checkmark-outline" 
          label="Privacy" 
          onPress={() => {}} 
          rightElement={<Text style={styles.rightValue}>Strict</Text>}
        />
      </View>

      <Text style={styles.sectionHeader}>SUPPORT</Text>
      <View style={styles.groupedContainer}>
        <SettingRow 
          icon="help-circle-outline" 
          label="Help Center" 
          onPress={() => {}} 
        />
        <SettingRow 
          icon="bug-outline" 
          label="Report a Bug" 
          onPress={() => {}} 
        />
      </View>

      <View style={[styles.groupedContainer, { marginTop: 32 }]}>
        <SettingRow 
          icon="log-out-outline" 
          label="Logout" 
          onPress={handleLogout} 
          color="#FF453A"
          rightElement={<View />}
        />
      </View>

      <Text style={styles.versionText}>Memory Vault v1.0.0 (Premium)</Text>
    </ScrollView>
  </Animated.View>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingTop: 140, // Large Title
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#38383A',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    color: '#8E8E93',
    fontSize: 15,
  },
  sectionHeader: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  groupedContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
  },
  rightValue: {
    color: '#8E8E93',
    fontSize: 17,
    marginRight: 8,
  },
  versionText: {
    textAlign: 'center',
    color: '#38383A',
    fontSize: 12,
    marginTop: 16,
  },
});

export default ProfileScreen;

