import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const OnThisDayScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>On This Day Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0B0B',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default OnThisDayScreen;
