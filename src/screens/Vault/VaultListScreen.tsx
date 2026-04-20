import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  ToastAndroid,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScalePressable, MemberAvatar } from '../../components';
import { ANIMATION } from '../../constants/theme';
import { triggerHaptic } from '../../utils/haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { useUIStore } from '../../store/uiStore';
import { createVault, getUserVaults, joinVault } from '../../services/vaultService';
import { VaultStackParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';

type VaultListNavigationProp = NativeStackNavigationProp<VaultStackParamList, 'VaultList'>;

const VaultListScreen = () => {
  const { user, isDeletingAccount } = useAuthStore();
  const { setCurrentVault, vaults, setVaults } = useVaultStore();
  const navigation = useNavigation<VaultListNavigationProp>();
  const scrollRef = React.useRef<ScrollView>(null);

  // ─── Animation state ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Screen Fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ANIMATION.FADE_DURATION,
      useNativeDriver: true,
    }).start();

    // FAB Scale-in
    Animated.spring(fabScale, {
      toValue: 1,
      ...ANIMATION.PRESS_SPRING,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, fabScale]);

  const [isCreating, setIsCreating] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // ─── Native Header Config ──────────────────────────────────────────────
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ScalePressable 
          onPress={() => {
            const nextState = !isCreating;
            setIsCreating(nextState);
            setError(null);
            if (nextState) {
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }
          }}
          useOpacity={true}
        >
          <Ionicons 
            name={isCreating ? "close-circle" : "add-circle"} 
            size={28} 
            color="#6C63FF" 
          />
        </ScalePressable>
      ),
    });
  }, [navigation, isCreating]);

  const fetchVaults = async () => {
    if (!user?.uid || isDeletingAccount) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getUserVaults(user.uid);
      setVaults(data, user.uid);
    } catch (err) {
      setError("Failed to load vaults");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaults();
  }, [user?.uid]);

  const handleCreateVault = async () => {
    if (loading || !user || isDeletingAccount) return;
    try {
      setLoading(true);
      setError(null);
      await createVault(vaultName, user.uid, user);
      setVaultName('');
      setIsCreating(false);
      await fetchVaults();
    } catch (err: any) {
      setError(err.message || "Failed to create vault");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinVault = async () => {
    if (joining || !user?.uid || isDeletingAccount) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError("Enter a valid 6-character code");
      return;
    }

    try {
      setJoining(true);
      setJoinError(null);
      await joinVault(code, user.uid, user);
      setJoinCode('');
      await fetchVaults();
    } catch (err: any) {
      setJoinError(err.message || "Failed to join vault");
    } finally {
      setJoining(false);
    }
  };

  const handleVaultPress = (vault: any) => {
    if (!vault?.id) return;
    setCurrentVault(vault.id, vault.members || []);
    navigation.navigate("VaultDetail", {
      vaultId: vault.id,
      vaultName: vault.name,
    });
  };
  
  const handleCopyCode = async (code: string) => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      triggerHaptic('success');
      useUIStore.getState().showToast("Copied to clipboard");
    } catch (err) {
      triggerHaptic('error');
      useUIStore.getState().showAlert({
        title: "Error",
        message: "Failed to copy code",
        type: "error"
      });
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView 
        ref={scrollRef}
        style={styles.list} 
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        {isCreating && (
          <View style={styles.creationCard}>
            <Text style={styles.sectionHeader}>NAME YOUR NEW VAULT</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Summer Trip 2024"
              placeholderTextColor="#8E8E93"
              value={vaultName}
              onChangeText={(text) => {
                setVaultName(text);
                if (error) setError(null);
              }}
              autoFocus
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity 
              style={[
                styles.submitButton, 
                (loading || !vaultName.trim()) && styles.buttonDisabled
              ]}
              onPress={handleCreateVault}
              disabled={loading || !vaultName.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Vault</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.joinSection}>
          <Text style={styles.sectionHeader}>HAVE AN INVITE CODE?</Text>
          <View style={styles.joinInputRow}>
            <TextInput
              style={[styles.joinInput, { flex: 1 }]}
              placeholder="ABC123"
              placeholderTextColor="#8E8E93"
              value={joinCode}
              onChangeText={(text) => {
                setJoinCode(text.toUpperCase());
                if (joinError) setJoinError(null);
              }}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={[
                styles.joinButton, 
                (joining || joinCode.trim().length !== 6) && styles.buttonDisabled
              ]}
              onPress={handleJoinVault}
              disabled={joining || joinCode.trim().length !== 6}
            >
              {joining ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward-circle" size={32} color="#6C63FF" />
              )}
            </TouchableOpacity>
          </View>
          {joinError && <Text style={styles.joinErrorText}>{joinError}</Text>}
        </View>

        <Text style={styles.sectionHeader}>YOUR ACTIVE VAULTS</Text>
        {loading && vaults.length === 0 ? (
          <ActivityIndicator size="small" color="#6C63FF" style={{ marginTop: 20 }} />
        ) : vaults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No vaults found. Create or join one to start sharing memories.</Text>
          </View>
        ) : (
          <View style={styles.vaultListContainer}>
            {vaults.map((vault, index, filteredArray) => (
              <ScalePressable 
                key={vault.id} 
                style={[
                  styles.vaultItem,
                  index === filteredArray.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => handleVaultPress(vault)}
              >
                <View style={styles.vaultItemContent} pointerEvents="box-none">
                  <View style={styles.vaultIconContainer}>
                    <Ionicons name="cube-outline" size={24} color="#6C63FF" />
                  </View>
                  <View style={styles.vaultInfo} pointerEvents="box-none">
                    <Text style={styles.vaultName}>{vault.name}</Text>
                    {vault.inviteCode && (
                      <TouchableOpacity 
                        onPress={() => handleCopyCode(vault.inviteCode)}
                        style={styles.codeContainer}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inviteCodeText}>Code: {vault.inviteCode}</Text>
                        <Text style={styles.copyHint}>Tap to copy</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#38383A" />
                </View>
              </ScalePressable>
            ))}
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
  list: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 140 : 20, 
    paddingHorizontal: 16,
    paddingBottom: 100, // Space for tab bar
  },
  sectionHeader: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '400',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  headerAction: {
    marginRight: 8,
  },
  // GROUPED LAYOUTS
  creationCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  joinSection: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 16,
    marginBottom: 32,
  },
  vaultListContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    overflow: 'hidden',
  },
  // ROWS
  vaultItem: {
    backgroundColor: '#1C1C1E',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  vaultItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingRight: 16,
  },
  vaultIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vaultInfo: {
    flex: 1,
    marginRight: 8,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: '#1C1C1E',
    borderRadius: 14,
  },
  moreMembers: {
    backgroundColor: '#2C2C2E',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 1,
    borderColor: '#38383A',
  },
  moreMembersText: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
  },
  // INPUTS
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 17,
    marginTop: 8,
  },
  joinInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  joinInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 17,
    marginRight: 12,
  },
  // BUTTONS
  submitButton: {
    backgroundColor: '#6C63FF',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  joinButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // TEXT
  vaultName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
  },
  inviteCodeText: {
    color: '#8E8E93',
    fontSize: 13,
  },
  codeContainer: {
    paddingVertical: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  copyHint: {
    color: '#6C63FF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#FF453A',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  joinErrorText: {
    color: '#FF453A',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default VaultListScreen;