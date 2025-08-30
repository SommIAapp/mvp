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

export default function PrivacyPolicy() {
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
        <Text style={styles.headerTitle}>Politique de Confidentialité</Text>
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
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            SOMMIA s'engage à protéger votre vie privée. Cette politique explique quelles informations nous collectons, comment nous les utilisons et vos droits concernant vos données personnelles.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Données Collectées</Text>
          <Text style={styles.paragraph}>
            Nous collectons les types de données suivants :
          </Text>
          <Text style={styles.bulletPoint}>
            • Informations de compte : Email, nom (optionnel)
          </Text>
          <Text style={styles.bulletPoint}>
            • Données d'usage : Historique des recommandations, préférences de vin, photos de plats (temporaires)
          </Text>
          <Text style={styles.bulletPoint}>
            • Données techniques : Type d'appareil, version de l'app, identifiants anonymes
          </Text>
          <Text style={styles.bulletPoint}>
            • Données de paiement : Gérées exclusivement par Apple, nous ne stockons aucune information bancaire
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Utilisation des Données</Text>
          <Text style={styles.paragraph}>
            Vos données sont utilisées pour :
          </Text>
          <Text style={styles.bulletPoint}>
            • Fournir des recommandations de vin personnalisées
          </Text>
          <Text style={styles.bulletPoint}>
            • Gérer votre compte et abonnement
          </Text>
          <Text style={styles.bulletPoint}>
            • Améliorer nos algorithmes de recommandation
          </Text>
          <Text style={styles.bulletPoint}>
            • Vous envoyer des communications liées au service (avec votre consentement)
          </Text>
          <Text style={styles.bulletPoint}>
            • Analyser l'utilisation de l'app de manière anonyme
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Stockage et Sécurité</Text>
          <Text style={styles.paragraph}>
            Vos données sont stockées sur des serveurs sécurisés en Europe. Nous utilisons des mesures de sécurité standard de l'industrie incluant le cryptage pour protéger vos informations.
          </Text>
          <Text style={styles.paragraph}>
            Les photos de plats sont traitées temporairement pour l'analyse et ne sont pas conservées après le traitement.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Partage des Données</Text>
          <Text style={styles.paragraph}>
            Nous ne vendons jamais vos données personnelles. Nous partageons vos données uniquement avec :
          </Text>
          <Text style={styles.bulletPoint}>
            • Nos prestataires techniques essentiels (hébergement, analyse)
          </Text>
          <Text style={styles.bulletPoint}>
            • Les autorités légales si requis par la loi
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Vos Droits (RGPD)</Text>
          <Text style={styles.paragraph}>
            Conformément au RGPD, vous avez le droit de :
          </Text>
          <Text style={styles.bulletPoint}>
            • Accéder à vos données personnelles
          </Text>
          <Text style={styles.bulletPoint}>
            • Rectifier vos données
          </Text>
          <Text style={styles.bulletPoint}>
            • Supprimer votre compte et toutes vos données
          </Text>
          <Text style={styles.bulletPoint}>
            • Exporter vos données (portabilité)
          </Text>
          <Text style={styles.bulletPoint}>
            • Vous opposer au traitement de vos données
          </Text>
          <Text style={styles.bulletPoint}>
            • Retirer votre consentement à tout moment
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Conservation des Données</Text>
          <Text style={styles.paragraph}>
            Nous conservons vos données tant que votre compte est actif. Après suppression de votre compte :
          </Text>
          <Text style={styles.bulletPoint}>
            • Les données personnelles sont supprimées sous 30 jours
          </Text>
          <Text style={styles.bulletPoint}>
            • Les données anonymisées peuvent être conservées pour l'amélioration du service
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Cookies et Tracking</Text>
          <Text style={styles.paragraph}>
            L'application utilise des identifiants anonymes pour améliorer votre expérience. Aucun cookie tiers de publicité n'est utilisé.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Mineurs</Text>
          <Text style={styles.paragraph}>
            SOMMIA est réservé aux personnes de 18 ans et plus. Nous ne collectons pas sciemment de données sur les mineurs.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Modifications</Text>
          <Text style={styles.paragraph}>
            Nous pouvons mettre à jour cette politique. Les changements importants seront notifiés dans l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact</Text>
          <Text style={styles.paragraph}>
            Pour exercer vos droits ou toute question sur vos données :
          </Text>
          <Text style={styles.paragraph}>
            Email : privacy@sommia.app
          </Text>
          <Text style={styles.paragraph}>
            Délégué à la Protection des Données : dpo@sommia.app
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
  bulletPoint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.relaxed,
    marginLeft: 8,
    marginBottom: 4,
  },
  footer: {
    height: 40,
  },
});