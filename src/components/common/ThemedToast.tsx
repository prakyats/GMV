import React, { useEffect, useRef } from 'react';
import { 
  Text, 
  StyleSheet, 
  Animated, 
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUIStore } from '../../store/uiStore';

/**
 * Premium Themed Toast
 * - Controlled via useUIStore
 * - Floating pill with slide-up animation
 * - Survivors navigation transitions by rendering at root
 */
const ThemedToast: React.FC = () => {
  const { toast } = useUIStore();
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [toast, slideAnim, opacityAnim]);

  if (!toast) return null;

  return (
    <SafeAreaView style={styles.container} pointerEvents="none">
      <Animated.View 
        style={[
          styles.pill,
          {
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.text}>{toast}</Text>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999, // Ensure it's above everything
  },
  pill: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)', // Card color with slight transparency
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ThemedToast;
