import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * LoadingSkeleton
 * A simple placeholder component for feed items while loading.
 */
const LoadingSkeleton = () => {
  return (
    <View style={styles.container}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.textPlaceholder} />
      <View style={[styles.textPlaceholder, { width: '40%' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  imagePlaceholder: {
    height: 180,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    marginBottom: 16,
  },
  textPlaceholder: {
    height: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 4,
    marginBottom: 10,
    width: '70%',
  },
});

export default LoadingSkeleton;
