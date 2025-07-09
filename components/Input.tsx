import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  multiline = false,
  numberOfLines = 1,
  maxLength,
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputStyle = [
    styles.input,
    isFocused && styles.inputFocused,
    error && styles.inputError,
    multiline && styles.inputMultiline,
  ];

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        <TextInput
          style={inputStyle}
          placeholder={placeholder}
          placeholderTextColor={Colors.textLight}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={Colors.textLight} />
            ) : (
              <Eye size={20} color={Colors.textLight} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.textLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.accent,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 4,
  },
  errorText: {
    fontSize: Typography.sizes.xs,
    color: Colors.error,
    marginTop: 4,
  },
});