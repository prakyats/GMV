import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, StatusBar } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/types';
import { getPublicMemoryPreview } from '../../services/memoryService';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type PreviewRouteProp = RouteProp<AuthStackParamList, 'MemoryPreview'>;

const MemoryPreview = () => {
  const route = useRoute<PreviewRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { vaultId, memoryId } = route.params;

  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getPublicMemoryPreview(vaultId, memoryId).then(data => {
      if (data) {
        setPreview(data);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, [vaultId, memoryId]);

  const truncateCaption = (text: string) => {
    if (!text) return "";
    // Truncate at ~65% of word count to maximize curiosity
    const words = text.split(' ');
    const cutPoint = Math.max(3, Math.floor(words.length * 0.65));
    return words.slice(0, cutPoint).join(' ') + "...";
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>🕊️</Text>
        <Text style={styles.errorTitle}>This memory is no longer available</Text>
        <Text style={styles.errorSub}>The link may have expired or the memory was removed from the vault.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Explore the Vault</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* BLURRED BACKGROUND HERO */}
      <View style={styles.heroContainer}>
        {preview.imageURL ? (
          <>
            <Image source={{ uri: preview.imageURL }} style={styles.image} />
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          </>
        ) : (
          <View style={[styles.image, { backgroundColor: '#1A1A1A' }]} />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(11, 11, 11, 1)']}
          style={styles.gradient}
        />

        <View style={styles.floatingContent}>
          <Text style={styles.vaultBadge}>FROM YOUR VAULT</Text>
          <Text style={styles.caption}>“{truncateCaption(preview.caption)}”</Text>
          <Text style={styles.socialProof}>{preview.reactionCount} people reacted ❤️</Text>
        </View>
      </View>

      {/* CTA SECTION */}
      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel="Unlock this memory"
        >
          <Text style={styles.buttonText}>Unlock this memory</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Register')}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryText}>Join to see who shared this</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSub: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  heroContainer: {
    width: '100%',
    height: '65%',
    justifyContent: 'flex-end',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  floatingContent: {
    padding: 30,
    zIndex: 10,
  },
  vaultBadge: {
    color: '#6C63FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 44,
  },
  socialProof: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  footer: {
    padding: 30,
    flex: 1,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#6C63FF',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#6C63FF",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryAction: {
    marginTop: 20,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default MemoryPreview;
