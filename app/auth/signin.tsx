import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) throw error;
        
        // Si c'est un nouvel utilisateur, créer le profil avec essai gratuit
        if (data.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profile) {
            await supabase.from('user_profiles').insert({
              id: data.user.id,
              email: data.user.email || credential.email,
              full_name: credential.fullName ? 
                `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() : null,
              subscription_plan: 'trial',
              trial_start_date: new Date().toISOString(),
            });
            
            // Nouvel utilisateur -> onboarding
            router.replace('/auth/onboarding');
          } else {
            // Utilisateur existant -> app
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        // L'utilisateur a annulé
      } else {
        Alert.alert('Erreur', 'Connexion Apple échouée');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
        <Text style={styles.subtitle}>
          Connectez-vous avec votre compte Apple pour accéder à SOMMIA
        </Text>

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />

        <Text style={styles.securityText}>
          Votre confidentialité est garantie. SOMMIA ne partage jamais vos données.
        </Text>
      </View>
    </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  securityText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
});