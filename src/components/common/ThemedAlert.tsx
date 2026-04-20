import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Animated, 
  Dimensions, 
  TouchableOpacity,
  Pressable
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useUIStore } from '../../store/uiStore';
import { triggerHaptic } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Premium Themed Alert
 * - Controlled via useUIStore
 * - iOS-inspired design with materials and subtle animations
 * - Supports alert (Info/Error) and confirm (Confirmation) modes
 */
const ThemedAlert: React.FC = () => {
  const { alert, hideAlert } = useUIStore();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (alert) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [alert, fadeAnim, scaleAnim]);

  if (!alert) return null;

  const handleCancel = () => {
    triggerHaptic('light');
    if (alert.onCancel) alert.onCancel();
    hideAlert();
  };

  const handleConfirm = () => {
    triggerHaptic('medium');
    const onConfirm = alert.onConfirm;
    hideAlert(); // 🚨 Close immediately for better UX
    if (onConfirm) onConfirm();
  };

  const isDestructive = alert.type === 'confirm' || alert.type === 'error';
  const isConfirm = alert.type === 'confirm';

  return (
    <Modal
      transparent
      visible={!!alert}
      animationType="none"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={alert.type === 'confirm' ? undefined : handleCancel}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        </Pressable>

        <Animated.View 
          style={[
            styles.alertCard, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.content}>
            <Text style={styles.title}>{alert.title}</Text>
            <Text style={styles.message}>{alert.message}</Text>
          </View>

          <View style={styles.buttonRow}>
            {isConfirm && (
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={handleCancel}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.button, 
                isConfirm ? styles.confirmButton : styles.okButton,
                alert.type === 'error' && styles.errorButton
              ]} 
              onPress={handleConfirm}
            >
              <Text style={[
                styles.buttonText,
                alert.type === 'error' && styles.errorText
              ]}>
                {isConfirm ? (alert.type === 'error' ? 'Delete' : 'Confirm') : 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  alertCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#8E8E93',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  confirmButton: {
    // Normal confirmation uses branding primary
  },
  okButton: {
    // Info/OK buttons
  },
  errorButton: {
    // Error background or text color
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
  },
  buttonText: {
    color: '#6C63FF', // Primary purple-blue
    fontSize: 17,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF453A', // Apple-style red
  },
});

export default ThemedAlert;
