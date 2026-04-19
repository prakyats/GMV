import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Animated, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useVaultStore } from '../../store/vaultStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { ScalePressable } from '../../components';
import { ANIMATION } from '../../constants/theme';
import { getUserInitial, formatUserDisplayName, getUserDisplayName } from '../../utils/user';

const ProfileScreen = () => {
  const { user, isDeletingAccount } = useAuthStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Deletion state
  const [isDeleteModalVisible, setIsDeleteModalVisible] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Logout state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ANIMATION.FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);
  
  const handleLogout = async () => {
    if (isDeletingAccount || isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      useVaultStore.getState().clearVault();
      await authService.logout();
    } catch (error: any) {
      console.error(error.message);
      useUIStore.getState().showAlert({
        title: "Error",
        message: "Failed to log out. Please try again.",
        type: "error"
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    if (isLoggingOut || isDeletingAccount) return;
    useUIStore.getState().showAlert({
      title: "Log Out",
      message: "Are you sure you want to log out?",
      type: "confirm",
      onConfirm: handleLogout,
      onCancel: () => useUIStore.getState().hideAlert()
    });
  };

  const handleDeleteAccount = async () => {
    if (!password.trim()) {
      setDeleteError("Password is required");
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);

      // Re-auth and delete (Service handles the logic and store clearing)
      await authService.deleteAccount(user?.email || '', password);
      
      setIsDeleteModalVisible(false);
      setPassword('');
      // Navigation is handled by the root Auth listener noticing user is null
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const SettingRow = ({ icon, label, onPress, color = '#FFFFFF', rightElement = null, disabled = false }: any) => (
    <ScalePressable 
      style={[styles.row, disabled && { opacity: 0.5 }]} 
      onPress={onPress}
      disabled={disabled}
    >
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
            {getUserInitial(user)}
          </Text>
        </View>
        <Text style={styles.userName}>{formatUserDisplayName(user)}</Text>
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
          onPress={confirmLogout} 
          color="#FF453A"
          rightElement={<View />}
          disabled={isLoggingOut || isDeletingAccount}
        />
        <SettingRow 
          icon="trash-outline" 
          label="Delete Account" 
          onPress={() => setIsDeleteModalVisible(true)} 
          color="#FF453A"
          rightElement={<View />}
        />
      </View>

      <Text style={styles.versionText}>Memory Vault v1.0.0 (Premium)</Text>
    </ScrollView>


    {/* ACCOUNT DELETION MODAL */}
    <Modal
      visible={isDeleteModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => !isDeleting && setIsDeleteModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Delete Account?</Text>
          <Text style={styles.modalWarning}>
            This action is permanent and cannot be undone. You will be removed from all vaults immediately.
          </Text>

          <TextInput
            style={styles.passwordInput}
            placeholder="Confirm Password"
            placeholderTextColor="#8E8E93"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoFocus
          />

          {deleteError && <Text style={styles.modalError}>{deleteError}</Text>}

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => {
                setIsDeleteModalVisible(false);
                setPassword('');
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.deleteButton, isDeleting && styles.buttonDisabled]} 
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderWidth: 1,
    borderColor: '#38383A',
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalWarning: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  passwordInput: {
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#38383A',
    marginBottom: 16,
  },
  modalError: {
    color: '#FF453A',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#6C63FF',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FF453A',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  }
});

export default ProfileScreen;

