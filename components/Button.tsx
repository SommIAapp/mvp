import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ];

  const textStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.accent : Colors.primary} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  
  // Variants
  primary: {
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  
  // Sizes
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 56,
  },
  
  // Text styles
  text: {
    fontWeight: Typography.weights.semibold,
    textAlign: 'center',
  },
  primaryText: {
    color: Colors.accent,
  },
  secondaryText: {
    color: Colors.darkGray,
  },
  outlineText: {
    color: Colors.primary,
  },
  
  // Text sizes
  smallText: {
    fontSize: Typography.sizes.sm,
  },
  mediumText: {
    fontSize: Typography.sizes.base,
  },
  largeText: {
    fontSize: Typography.sizes.lg,
  },
});