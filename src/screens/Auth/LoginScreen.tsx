import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator 
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { authService } from '../../services/authService';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;

    const emailClean = email.trim().toLowerCase();

    // 1. Validation
    if (!emailClean || !password) {
      setError('All fields are required');
      return;
    }

    if (!emailClean.includes('@')) {
      setError('Invalid email format');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // 2. API Call
    try {
      setLoading(true);
      setError(null);
      await authService.login(emailClean, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Login to Group Memory Vault</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8E8E93"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8E8E93"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError(null);
          }}
          secureTextEntry
        />
      </View>


      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity 
        style={[styles.loginButton, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.linkButton}
        onPress={() => navigation.navigate('Register')}
        disabled={loading}
      >
        <Text style={styles.linkButtonText}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 17,
    marginBottom: 48,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 20,
    color: '#FFFFFF',
    marginBottom: 16,
    fontSize: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A',
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: "#6C63FF",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 32,
  },
  linkButtonText: {
    color: '#6C63FF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default LoginScreen;

