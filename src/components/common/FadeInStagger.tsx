import React, { useEffect, useRef, useState } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';
import { ANIMATION } from '../../constants/theme';

interface FadeInStaggerProps {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Premium Entry Animation
 * - Fades in (0 -> 1)
 * - Translates up (10 -> 0)
 * - Staggers based on index (capped at index 6)
 * - State-guarded (runs only once per mount)
 */
export const FadeInStagger: React.FC<FadeInStaggerProps> = ({
  children,
  index,
  style,
}) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (hasAnimated) return;

    // Skip animation entirely for items deep in the list
    if (index > ANIMATION.STAGGER_MAX_INDEX) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      setHasAnimated(true);
      return;
    }

    const delay = Math.min(index * ANIMATION.STAGGER_DELAY, ANIMATION.STAGGER_MAX_DELAY);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION.FADE_DURATION,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIMATION.FADE_DURATION,
        delay,
        useNativeDriver: true,
      }),
    ]).start(() => setHasAnimated(true));
  }, [index, hasAnimated]);

  return (
    <Animated.View style={[
      style,
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }
    ]}>
      {children}
    </Animated.View>
  );
};
