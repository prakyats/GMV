import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { createVault, getUserVaults, joinVault } from '../../services/vaultService';
import { VaultStackParamList } from '../../navigation/types';

type VaultListNavigationProp = NativeStackNavigationProp<VaultStackParamList, 'VaultList'>;

const VaultListScreen = () => {
  const { user } = useAuthStore();
  const { setCurrentVault } = useVaultStore();
  const navigation = useNavigation<VaultListNavigationProp>();

  const [vaults, setVaults] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join Vault State
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchVaults = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);

      const data = await getUserVaults(user.uid);
      setVaults(data);
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
    if (loading || !user) return;

    try {
      setLoading(true);
      setError(null);

      await createVault(vaultName, user.uid);

      setVaultName('');
      setIsCreating(false);
      
      // Refresh list after creation
      await fetchVaults();
    } catch (err: any) {
      setError(err.message || "Failed to create vault");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinVault = async () => {
    if (joining) return;

    // 1. Auth Check
    if (!user?.uid) {
      setJoinError("User not authenticated");
      return;
    }

    // 2. Sanitization
    const code = joinCode.trim().toUpperCase();

    // 3. Size Validation (Pre-Check)
    if (code.length !== 6) {
      setJoinError("Enter a valid 6-character code");
      return;
    }

    try {
      setJoining(true);
      setJoinError(null);

      // 4. API Call
      await joinVault(code, user.uid);

      // 5. Success Flow
      setJoinCode('');
      
      if (user?.uid) {
        await fetchVaults();
      }

    } catch (err: any) {
      setJoinError(err.message || "Failed to join vault");
    } finally {
      setJoining(false);
    }
  };

  const handleVaultPress = (vault: any) => {
    // 1. Guard
    if (!vault?.id) return;

    // 2. Safe State Set
    setCurrentVault(vault.id, vault.members || []);

    // 3. Navigation
    navigation.navigate("VaultDetail", {
      vaultId: vault.id,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Vaults</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setIsCreating(!isCreating);
            setError(null);
          }}
        >
          <Text style={styles.addButtonText}>{isCreating ? 'Cancel' : 'Create Vault'}</Text>
        </TouchableOpacity>
      </View>

      {isCreating && (
        <View style={styles.creationCard}>
          <TextInput
            style={styles.input}
            placeholder="Vault Name (e.g., Family Docs)"
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
              <Text style={styles.submitButtonText}>Confirm Creation</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Join Vault UI */}
      <View style={styles.joinSection}>
        <TextInput
          style={styles.joinInput}
          placeholder="Enter 6-character invite code"
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
            <Text style={styles.joinButtonText}>Join Vault</Text>
          )}
        </TouchableOpacity>
        
        {joinError && <Text style={styles.joinErrorText}>{joinError}</Text>}
      </View>

      {loading && vaults.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load vaults</Text>
        </View>
      ) : vaults.length === 0 && !isCreating ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No vaults yet. Create your first vault 🚀</Text>
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {vaults.map((vault, index) => (
            <TouchableOpacity 
              key={vault.id} 
              style={styles.vaultItem}
              onPress={() => handleVaultPress(vault)}
              activeOpacity={0.7}
            >
              <Text style={styles.vaultName}>
                {index + 1}. {vault.name}
              </Text>
              
              {vault.inviteCode && (
                <>
                  <Text style={styles.inviteCodeText}>
                    Code: {vault.inviteCode}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => Clipboard.setStringAsync(vault.inviteCode)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.copyText}>
                      Tap to copy code
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  addButtonText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
  },
  creationCard: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0B0B0B',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 12,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  list: {
    flex: 1,
  },
  vaultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#222',
  },
  vaultName: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  inviteCodeText: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
  copyText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  joinSection: {
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    marginBottom: 24,
  },
  joinInput: {
    backgroundColor: '#0B0B0B',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
  },
  joinButton: {
    backgroundColor: '#6C63FF',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  joinErrorText: {
    color: '#FF453A',
    fontSize: 12,
    marginTop: 8,
  },
});

export default VaultListScreen;