import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuth } from '@/hooks/useAuth';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email requis';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!password) {
      newErrors.password = 'Mot de passe requis';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      if (error.message?.includes('Email not confirmed')) {
        Alert.alert(
          'Email non confirmé', 
          'Veuillez vérifier votre boîte email et cliquer sur le lien de confirmation avant de vous connecter.'
        );
      } else {
        Alert.alert('Erreur', 'Email ou mot de passe incorrect');
      }
    } else {
      router.replace('/(tabs)');
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
        <Text style={styles.title}>Connexion</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.form}>
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
            placeholder="Ton mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
          
          <Button
            title="Se connecter"
            onPress={handleSignIn}
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Pas encore de compte ?{' '}
            <Text 
              style={styles.link}
              onPress={() => router.push('/auth/signup')}
            >
              Créer un compte
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