import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuth } from '@/hooks/useAuth';

export default function SignUpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    try {
      if (!validateForm()) return;
      
      setLoading(true);
      console.log('🎯 handleSignUp - Starting signup process');

      // Validation supplémentaire
      if (!email || !password || !fullName) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs');
        return;
      }

      if (password.length < 8) {
        Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
        return;
      }

      // Créer le compte
      const { error } = await signUp(email, password, fullName);

      if (error) {
        Alert.alert('Erreur', error.message || 'Impossible de créer le compte');
        return;
      }

      console.log('✅ handleSignUp - Account created successfully');
      
      // Navigation vers l'app principale
      setTimeout(() => {
        console.log('✅ handleSignUp - Navigating to app');
        router.replace('/(tabs)');
      }, 1500);

    } catch (error) {
      console.error('❌ handleSignUp error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la création du compte');
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.title}>{t('auth.signUp')}</Text>
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
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            error={errors.email}
          />
          
          <Input
            label={t('auth.password')}
            placeholder="Minimum 8 caractères"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
          
          <Button
            title={t('auth.signUp')}
            onPress={handleSignUp}
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
          />
          
          <Text style={styles.termsText}>
            En créant un compte, vous acceptez nos{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => router.push('/terms-of-service')}
            >
              Conditions d'Utilisation
            </Text>
            {' '}et notre{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => router.push('/privacy-policy')}
            >
              Politique de Confidentialité
            </Text>
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('auth.alreadyHaveAccount')}{' '}
            <Text 
              style={styles.link}
              onPress={() => router.push('/auth/signin')}
            >
              {t('auth.signIn')}
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
  termsText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  termsLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});