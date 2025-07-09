import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuth } from '@/hooks/useAuth';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ 
    fullName?: string; 
    email?: string; 
    password?: string; 
  }>({});

  const validateForm = () => {
    const newErrors: { fullName?: string; email?: string; password?: string } = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Nom requis';
    }
    
    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!password) {
      newErrors.password = 'Mot de passe requis';
    } else if (password.length < 8) {
      newErrors.password = 'Minimum 8 caractères';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      router.replace('/subscription');
    }
    
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Button
          title=""
          onPress={() => router.back()}
          variant="outline"
          size="small"
        />
        <Text style={styles.title}>Créer un compte</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.form}>
          <Input
            label="Nom complet"
            placeholder="Ton nom"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
          />
          
          <Input
            label="Email"
            placeholder="ton@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            error={errors.email}
          />
          
          <Input
            label="Mot de passe"
            placeholder="Minimum 8 caractères"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
          
          <Button
            title="Créer mon compte"
            onPress={handleSignUp}
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Déjà un compte ?{' '}
            <Text 
              style={styles.link}
              onPress={() => router.push('/auth/signin')}
            >
              Se connecter
            </Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginLeft: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  form: {
    marginBottom: 32,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
  },
  link: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
});