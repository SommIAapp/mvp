import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { startFreeTrial } = useAuth();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Déplace ONBOARDING_STEPS ici pour qu'il soit recalculé à chaque render
  const ONBOARDING_STEPS = [
    {
      id: 'age',
      title: t('auth.onboarding.ageVerification.title'),
      subtitle: t('auth.onboarding.ageVerification.subtitle'),
      description: t('auth.onboarding.ageVerification.description'),
    },
    {
      id: 'trial',
      title: t('auth.onboarding.trial.title'),
      subtitle: t('auth.onboarding.trial.subtitle'),
      description: t('auth.onboarding.trial.description'),
    },
  ];

  const handleAgeConfirmation = (isAdult: boolean) => {
    if (!isAdult) {
      // Si moins de 18 ans, retour à l'écran de bienvenue
      router.replace('/welcome');
      return;
    }
    // Si 18+, passer à l'étape suivante
    setCurrentStep(1);
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Dernière étape - démarrer l'essai gratuit
      handleStartTrial();
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      if (__DEV__) {
        console.log('🎯 Onboarding: Starting free trial...');
      }
      const { error } = await startFreeTrial();
      
      if (error) {
        console.error('❌ Onboarding: Error starting trial:', error);
        throw error;
      }
      
      if (__DEV__) {
        console.log('✅ Onboarding: Trial started successfully');
      }
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Erreur démarrage essai:', error);
      Alert.alert('Erreur', 'Impossible de démarrer l\'essai gratuit. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#6B2B3A', '#8B4B5A']}
        style={styles.gradient}
      >
        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.content}
        >
          {/* Age verification icon */}
          {currentStep === 0 && (
            <View style={styles.ageIconContainer}>
              <View style={styles.ageCircle}>
                <Text style={styles.ageIconText}>18+</Text>
              </View>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{currentStepData.title}</Text>
          <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
          <Text style={styles.description}>{currentStepData.description}</Text>

          {/* GIF pour l'écran trial */}
          {currentStep === 1 && (
            <Image
              source={require('@/assets/images/triaonboarding.gif')}
              style={styles.trialGif}
              resizeMode="contain"
            />
          )}

          {/* Actions selon l'étape */}
          {currentStep === 0 ? (
            // Age Gate
            <View style={styles.ageButtons}>
              <TouchableOpacity
                style={[styles.ageButton, styles.ageButtonPrimary]}
                onPress={() => handleAgeConfirmation(true)}
              >
                <Text style={styles.ageButtonTextPrimary}>
                  {t('auth.onboarding.ageVerification.confirmAdult')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.ageButton, styles.ageButtonSecondary]}
                onPress={() => handleAgeConfirmation(false)}
              >
                <Text style={styles.ageButtonTextSecondary}>
                  {t('auth.onboarding.ageVerification.confirmMinor')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Autres étapes
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              disabled={loading}
            >
              <Text style={currentStep === ONBOARDING_STEPS.length - 1 ? styles.nextButtonTextCenter : styles.nextButtonText}>
                {currentStep === ONBOARDING_STEPS.length - 1
                  ? t('auth.onboarding.startTrial')
                  : t('auth.onboarding.continue')}
              </Text>
              {currentStep < ONBOARDING_STEPS.length - 1 && (
                <ChevronRight size={24} color="#6B2B3A" />
              )}
            </TouchableOpacity>
          )}

          {/* Message sanitaire */}
          <Text style={styles.healthWarning}>
            {t('common.healthWarning')}
          </Text>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: 'white',
    width: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  ageButtons: {
    width: '100%',
    gap: 16,
  },
  ageButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 28,
    alignItems: 'center',
  },
  ageButtonPrimary: {
    backgroundColor: 'white',
  },
  ageButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'white',
  },
  ageButtonTextPrimary: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B2B3A',
  },
  ageButtonTextSecondary: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 28,
    minWidth: 280,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B2B3A',
  },
  nextButtonTextCenter: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B2B3A',
    textAlign: 'center',
  },
  healthWarning: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 40,
  },
  ageIconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 3,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageIconText: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
  },
  trialGif: {
    width: width - 60, // Réduit de 80 à 60
    height: (width - 60) * 0.7, // Augmente le ratio de 0.6 à 0.7
    borderRadius: 20,
    marginVertical: 20, // Réduit de 24
    alignSelf: 'center',
  },
});