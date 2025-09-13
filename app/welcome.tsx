import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { t, locale, changeLanguage } = useTranslation();
  const [loading, setLoading] = React.useState(false);

  const handleLanguageChange = async (lang: string) => {
    changeLanguage(lang);
    await AsyncStorage.setItem('user_language', lang);
  };

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
        
        if (data.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profile) {
            // Nouvel utilisateur - créer profil avec essai gratuit
            await supabase.from('user_profiles').insert({
              id: data.user.id,
              email: data.user.email || credential.email,
              full_name: credential.fullName ? 
                `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() : null,
              subscription_plan: 'trial',
              trial_start_date: new Date().toISOString(),
              daily_count: 0,
              monthly_count: 0,
            });
            
            // Aller à l'onboarding pour nouveau utilisateur
            router.replace('/auth/onboarding');
          } else {
            // Utilisateur existant - aller directement à l'app
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('Erreur', 'Connexion Apple échouée');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <LinearGradient
          colors={[Colors.primary, '#8B4A52']}
          style={styles.gradientBackground}
        >
          <View style={styles.languageSelector}>
            <TouchableOpacity
              style={[styles.languageButton, locale === 'fr' && styles.languageButtonActive]}
              onPress={() => handleLanguageChange('fr')}
            >
              <Text style={[styles.languageButtonText, locale === 'fr' && styles.languageButtonTextActive]}>
                FR
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.languageButton, locale === 'en' && styles.languageButtonActive]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.languageButtonText, locale === 'en' && styles.languageButtonTextActive]}>
                EN
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.heroContent}>
            <Image
              source={require('../assets/images/appstorelogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>{t('welcome.subtitle')}</Text>
          </View>
        </LinearGradient>
        
        <View style={styles.waveContainer}>
          <Svg
            height="40"
            width={width}
            viewBox={`0 0 ${width} 40`}
            style={styles.wave}
          >
            <Path
              d={`M0,20 Q${width/4},0 ${width/2},15 T${width},20 L${width},40 L0,40 Z`}
              fill={Colors.accent}
            />
          </Svg>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.contentSection}>
          <Text style={styles.description}>
            {t('welcome.description')}
          </Text>
        </View>

        <View style={styles.buttonSection}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={28}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
          
          <Text style={styles.securityText}>
            {t('welcome.privacy')}
          </Text>
        </View>
      </View>

      <Text style={styles.healthWarning}>
        {t('common.healthWarning')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  topSection: {
    height: height * 0.5,
    position: 'relative',
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  waveContainer: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    width: width,
    height: 40,
    overflow: 'hidden',
    zIndex: 5,
  },
  wave: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: Colors.accent,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  heroContent: {
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.accent,
    marginBottom: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  contentSection: {
    marginTop: 40,
  },
  description: {
    fontSize: Typography.sizes.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.lg * Typography.lineHeights.relaxed,
  },
  buttonSection: {
    gap: 16,
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  securityText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  healthWarning: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 20,
    paddingHorizontal: 40,
    fontStyle: 'italic',
  },
  languageSelector: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  languageButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'white',
  },
  languageButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  languageButtonTextActive: {
    color: 'white',
  },
});