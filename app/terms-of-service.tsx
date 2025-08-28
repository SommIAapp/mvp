import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function TermsOfService() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions d'Utilisation</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdate}>
          Dernière mise à jour : Janvier 2025
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptation des Conditions</Text>
          <Text style={styles.paragraph}>
            En téléchargeant ou en utilisant l'application SOMMIA, vous acceptez d'être lié par ces conditions d'utilisation. Si vous n'acceptez pas ces conditions, n'utilisez pas l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description du Service</Text>
          <Text style={styles.paragraph}>
            SOMMIA est une application mobile qui fournit des recommandations de vins personnalisées basées sur vos plats et préférences. Le service utilise l'intelligence artificielle pour suggérer des accords mets-vins.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Inscription et Compte</Text>
          <Text style={styles.paragraph}>
            Pour utiliser SOMMIA, vous devez créer un compte avec une adresse email valide. Vous êtes responsable de maintenir la confidentialité de votre compte et de toutes les activités qui se produisent sous votre compte.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Abonnement et Paiement</Text>
          <Text style={styles.paragraph}>
            SOMMIA propose un essai gratuit de 7 jours, après quoi un abonnement payant est requis pour continuer à utiliser le service. Les prix sont affichés dans l'application et peuvent varier selon votre région.
          </Text>
          <Text style={styles.paragraph}>
            Les paiements sont traités via l'App Store d'Apple. L'abonnement se renouvelle automatiquement sauf annulation au moins 24 heures avant la fin de la période en cours.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Politique d'Annulation</Text>
          <Text style={styles.paragraph}>
            Vous pouvez annuler votre abonnement à tout moment dans les paramètres de votre compte Apple. L'annulation prendra effet à la fin de la période de facturation en cours.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Utilisation Responsable</Text>
          <Text style={styles.paragraph}>
            SOMMIA est destiné aux personnes de 18 ans et plus. L'application fournit des suggestions de boissons alcoolisées et doit être utilisée de manière responsable et conforme aux lois locales.
          </Text>
          <Text style={styles.paragraph}>
            L'abus d'alcool est dangereux pour la santé. À consommer avec modération.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Propriété Intellectuelle</Text>
          <Text style={styles.paragraph}>
            Tout le contenu de SOMMIA, incluant textes, graphiques, logos, et logiciels, est la propriété de SOMMIA ou de ses fournisseurs de contenu et est protégé par les lois sur la propriété intellectuelle.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Collecte de Données</Text>
          <Text style={styles.paragraph}>
            Nous collectons et utilisons vos données conformément à notre Politique de Confidentialité. En utilisant SOMMIA, vous consentez à la collecte et l'utilisation de vos informations comme décrit.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Limitation de Responsabilité</Text>
          <Text style={styles.paragraph}>
            Les recommandations de SOMMIA sont fournies à titre informatif uniquement. Nous ne garantissons pas l'exactitude ou la pertinence des suggestions. L'utilisation des recommandations se fait à vos propres risques.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Modifications des Conditions</Text>
          <Text style={styles.paragraph}>
            Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications entrent en vigueur dès leur publication dans l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact</Text>
          <Text style={styles.paragraph}>
            Pour toute question concernant ces conditions d'utilisation, contactez-nous à : support@sommia.app
          </Text>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.softGray,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  lastUpdate: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.relaxed,
    marginBottom: 8,
  },
  footer: {
    height: 40,
  },
});