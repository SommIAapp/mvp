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

const ONBOARDING_STEPS = [
  {
    id: 'age',
    title: 'Vérification d\'âge',
    subtitle: 'SOMMIA est réservé aux adultes',
    description: 'Pour continuer, confirmez que vous avez 18 ans ou plus',
  },
  {
    id: 'welcome',
    title: 'Bienvenue sur SOMMIA',
    subtitle: 'Votre sommelier personnel',
    description: 'Découvrez le vin parfait pour chaque plat grâce à SOMMIA',
  },
  {
    id: 'trial',
    title: '7 jours gratuits',
    subtitle: 'Essayez sans engagement',
    description: 'Profitez de toutes les fonctionnalités premium pendant 7 jours',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { startFreeTrial } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

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
      await startFreeTrial();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Erreur démarrage essai:', error);
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
          {/* Title */}
          <Text style={styles.title}>{currentStepData.title}</Text>
          <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
          <Text style={styles.description}>{currentStepData.description}</Text>

          {/* Actions selon l'étape */}
          {currentStep === 0 ? (
            // Age Gate
            <View style={styles.ageButtons}>
              <TouchableOpacity
                style={[styles.ageButton, styles.ageButtonPrimary]}
                onPress={() => handleAgeConfirmation(true)}
              >
                <Text style={styles.ageButtonTextPrimary}>
                  J'ai 18 ans ou plus
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.ageButton, styles.ageButtonSecondary]}
                onPress={() => handleAgeConfirmation(false)}
              >
                <Text style={styles.ageButtonTextSecondary}>
                  J'ai moins de 18 ans
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
              <Text style={styles.nextButtonText}>
                {currentStep === ONBOARDING_STEPS.length - 1
                  ? 'Commencer l\'essai gratuit'
                  : 'Continuer'}
              </Text>
              <ChevronRight size={24} color="white" />
            </TouchableOpacity>
          )}

          {/* Message sanitaire */}
          <Text style={styles.healthWarning}>
            L'abus d'alcool est dangereux pour la santé, à consommer avec modération
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
    paddingTop: 60,
    paddingBottom: 40,
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
    backgroundColor: 'white',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 28,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B2B3A',
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
});