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
        <Text style={styles.headerTitle}>{t('privacy.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdate}>
          {t('privacy.lastUpdate')}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.introduction.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.introduction.content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.dataCollected.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.dataCollected.intro')}
          </Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataCollected.account')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataCollected.usage')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataCollected.technical')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataCollected.payment')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.dataUsage.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.dataUsage.intro')}
          </Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataUsage.recommendations')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataUsage.account')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataUsage.improve')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataUsage.communication')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.dataUsage.analytics')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.storage.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.storage.content1')}
          </Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.storage.content2')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.sharing.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.sharing.intro')}
          </Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.sharing.providers')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.sharing.legal')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.rights.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.rights.intro')}
          </Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.rights.access')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.rights.rectify')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.rights.delete')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.rights.export')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.rights.object')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.rights.withdraw')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.retention.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.retention.intro')}
          </Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.retention.personal')}</Text>
          <Text style={styles.bulletPoint}>{t('privacy.sections.retention.anonymous')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.cookies.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.cookies.content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.minors.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.minors.content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.changes.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.changes.content')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacy.sections.contact.title')}</Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.contact.intro')}
          </Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.contact.email')}
          </Text>
          <Text style={styles.paragraph}>
            {t('privacy.sections.contact.dpo')}
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