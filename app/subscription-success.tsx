import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck as CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { useSubscription } from '@/hooks/useSubscription';

export default function SubscriptionSuccessScreen() {
  const router = useRouter();
  const { fetchSubscription } = useSubscription();

  useEffect(() => {
    // Refresh subscription data after successful payment
    const timer = setTimeout(() => {
      fetchSubscription();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Header avec gradient */}
      <View style={styles.headerSection}>
        <LinearGradient
          colors={['#6B2B3A', '#8B4B5A']}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>SOMMIA</Text>
        </LinearGradient>
        
        <Svg
          height={40}
          width="100%"
          viewBox="0 0 400 40"
          style={styles.wave}
          preserveAspectRatio="none"
        >
          <Path
            d="M0,20 Q100,0 200,15 T400,20 L400,40 L0,40 Z"
            fill="#FAF6F0"
          />
        </Svg>
      </View>

      {/* Contenu centré */}
      <View style={styles.content}>
        <View style={styles.successCard}>
          <View style={styles.iconContainer}>
            <CheckCircle size={80} color={Colors.primary} />
          </View>
          
          <Text style={styles.title}>Bienvenue dans Premium !</Text>
          
          <Text style={styles.message}>
            Ton abonnement SommIA Premium est maintenant actif. 
            Profite de recommandations illimitées et d'explications détaillées !
          </Text>
          
          <View style={styles.benefitsList}>
            <Text style={styles.benefit}>🍷 Recommandations illimitées</Text>
            <Text style={styles.benefit}>📱 Explications sommelier détaillées</Text>
            <Text style={styles.benefit}>🔄 Historique complet de tes découvertes</Text>
          </View>
          
          <Button
            title="Commencer à explorer"
            onPress={handleContinue}
            variant="primary"
            size="large"
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
  },
  headerSection: {
    position: 'relative',
  },
  headerGradient: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 50,
  },
  wave: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    marginBottom: 32,
  },
  benefitsList: {
    marginBottom: 40,
    width: '100%',
  },
  benefit: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
});