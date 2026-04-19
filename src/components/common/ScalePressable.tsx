import React, { useRef } from 'react';
import { 
  Animated, 
  Pressable, 
  ViewStyle, 
  StyleProp, 
  GestureResponderEvent,
  Insets 
} from 'react-native';
import { ANIMATION } from '../../constants/theme';

interface ScalePressableProps {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  opacityTo?: number;
  useOpacity?: boolean;
  disabled?: boolean;
  hitSlop?: Insets | number;
}

/**
 * Premium Tactile Pressable
 * - Scale & Opacity feedback (spring-driven)
 * - useNativeDriver for zero lag
 * - Instant navigation (calls onPress immediately)
 */
export const ScalePressable: React.FC<ScalePressableProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = ANIMATION.PRESS_SCALE,
  opacityTo = ANIMATION.PRESS_OPACITY,
  useOpacity = true,
  disabled = false,
  hitSlop,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      ...ANIMATION.PRESS_SPRING,
      useNativeDriver: true,
    }).start();

    if (useOpacity) {
      Animated.timing(opacityAnim, {
        toValue: opacityTo,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...ANIMATION.PRESS_SPRING,
      useNativeDriver: true,
    }).start();

    if (useOpacity) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop ?? 8} // Use custom hitSlop or fallback to global default
    >
      <Animated.View style={[
        style,
        { 
          transform: [{ scale: scaleAnim }],
          opacity: useOpacity ? opacityAnim : 1
        }
      ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
