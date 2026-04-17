import { authService } from '../../services/authService';
import { useVaultStore } from '../../store/vaultStore'; // Added to purge state on logout

const ProfileScreen = () => {
  const handleLogout = async () => {
    try {
      // Hardened Logout: Purge vault state before auth logout
      useVaultStore.getState().clearVault();
      await authService.logout();
    } catch (error: any) {
      console.error(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings Screen</Text>
      
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0B0B',
    padding: 24,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 40,
  },
  logoutButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF453A',
  },
  logoutButtonText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;

