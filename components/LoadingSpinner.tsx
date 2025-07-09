import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'small' | 'large';
}

export function LoadingSpinner({ text = "Recommandation en cours...", size = 'large' }: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={Colors.primary} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    marginTop: 12,
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});