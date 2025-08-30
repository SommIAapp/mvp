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
import { useTranslation } from '@/hooks/useTranslation';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

export default function TermsOfService() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('legal.termsOfService')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdate}>
          {t('legal.lastUpdated', { date: 'Janvier 2025' })}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section1Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section1Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section2Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section2Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section3Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section3Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section4Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section4Text')}
          </Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section4Text2')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section5Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section5Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section6Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section6Text')}
          </Text>
          <Text style={styles.paragraph}>
            {t('common.healthWarning')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section7Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section7Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section8Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section8Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section9Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section9Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section10Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section10Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.terms.section11Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.terms.section11Text')} {t('legal.contactEmail')}
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