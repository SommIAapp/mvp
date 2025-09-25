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

        if (error) {
          console.error('❌ Supabase Apple Sign In error:', error);
          throw error;
        }
        
        if (data.user) {
          // Étape 1: Chercher d'abord par apple_user_id pour éviter les doublons
          if (__DEV__) {
            console.log('🔍 Checking for existing profile with apple_user_id:', credential.user);
          }
          
          const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('apple_user_id', credential.user)
            .single();

          if (existingProfile) {
            if (__DEV__) {
              console.log('✅ Found existing profile with apple_user_id, using existing profile');
            }
            // Profil existant trouvé par apple_user_id - naviguer selon le statut
            if (existingProfile.subscription_plan === 'free' && !existingProfile.trial_start_date) {
              // Utilisateur existant qui n'a pas encore fait son onboarding
              router.replace('/auth/onboarding');
            } else {
              // Utilisateur existant avec essai déjà fait ou premium
              router.replace('/(tabs)');
            }
            return;
          }

          // Étape 2: Si pas trouvé par apple_user_id, chercher par Supabase user ID (logique existante)
          if (__DEV__) {
            console.log('🔍 No profile found with apple_user_id, checking by Supabase user ID');
          }
          
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profile) {
            // Nouvel utilisateur - créer profil avec apple_user_id
            if (__DEV__) {
              console.log('📝 Creating new profile with apple_user_id:', credential.user);
            }
            
            const fullName = credential.fullName ? 
              `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim() : null;
            
            await supabase.from('user_profiles').insert({
              id: data.user.id,
              email: data.user.email || credential.email,
              full_name: fullName,
              apple_user_id: credential.user,
              subscription_plan: 'free',
              daily_count: 0,
              monthly_count: 0,
            });
            
            if (__DEV__) {
              console.log('✅ New profile created, going to onboarding');
            }
            router.replace('/auth/onboarding');
          } else {
            // Profil existant trouvé par Supabase ID - mettre à jour avec apple_user_id si manquant
            if (__DEV__) {
              console.log('🔄 Found existing profile by Supabase ID, updating apple_user_id if missing');
            }
            if (!profile.apple_user_id) {
              await supabase.from('user_profiles')
                .update({ apple_user_id: credential.user })
                .eq('id', data.user.id);
            }
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error('Apple Sign In detailed error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          fullError: JSON.stringify(error, null, 2)
        });
      }
      
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert(
          t('welcome.error'),
          t('welcome.signinError')
        );
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
        
        <Text style={styles.healthWarning}>
          {t('common.healthWarning')}
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
    paddingTop: 60,
    paddingBottom: 30,
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
  buttonSection: {
    gap: 12,
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
    paddingHorizontal: 20,
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
