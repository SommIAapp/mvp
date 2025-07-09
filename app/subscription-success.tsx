import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck as CheckCircle } from 'lucide-react-native';
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
      <View style={styles.content}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
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