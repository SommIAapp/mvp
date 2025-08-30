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

export default function PrivacyPolicy() {
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
        <Text style={styles.headerTitle}>{t('legal.privacyPolicy')}</Text>
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
          <Text style={styles.sectionTitle}>{t('legal.privacy.section1Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section1Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section2Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section2Text')}
          </Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section2Bullet1')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section2Bullet2')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section2Bullet3')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section2Bullet4')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section3Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section3Text')}
          </Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section3Bullet1')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section3Bullet2')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section3Bullet3')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section3Bullet4')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section3Bullet5')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section4Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section4Text')}
          </Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section4Text2')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section5Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section5Text')}
          </Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section5Bullet1')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section5Bullet2')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section6Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section6Text')}
          </Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section6Bullet1')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section6Bullet2')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section6Bullet3')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section6Bullet4')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section6Bullet5')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section6Bullet6')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section7Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section7Text')}
          </Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section7Bullet1')}</Text>
          <Text style={styles.bulletPoint}>{t('legal.privacy.section7Bullet2')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section8Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section8Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section9Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section9Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section10Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section10Text')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('legal.privacy.section11Title')}</Text>
          <Text style={styles.paragraph}>
            {t('legal.privacy.section11Text')}
          </Text>
          <Text style={styles.paragraph}>
            {t('legal.privacyEmail')}
          </Text>
          <Text style={styles.paragraph}>
            {t('legal.dpoEmail')}
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