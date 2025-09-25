import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');
const RATING_STORAGE_KEY = 'user_has_rated_app';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function RatingModal({ visible, onClose }: RatingModalProps) {
  const { t } = useTranslation();

  const handleRateNow = async () => {
    // Marquer comme noté
    await AsyncStorage.setItem(RATING_STORAGE_KEY, 'true');
    
    // Demander le rating
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
    }
    
    onClose();
  };

  const handleLater = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#6B2B3A', '#8B4B5A']}
            style={styles.gradient}
          >
            {/* Stars */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={styles.starIcon}>⭐</Text>
              ))}
            </View>

            {/* Content */}
            <Text style={styles.title}>{t('rating.modal.title')}</Text>
            <Text style={styles.subtitle}>{t('rating.modal.subtitle')}</Text>
            <Text style={styles.description}>{t('rating.modal.description')}</Text>

            {/* Buttons */}
            <TouchableOpacity
              style={styles.rateButton}
              onPress={handleRateNow}
            >
              <Text style={styles.rateButtonText}>{t('rating.modal.rateNow')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleLater}
            >
              <Text style={styles.laterButtonText}>{t('rating.modal.later')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

export async function hasUserRated(): Promise<boolean> {
  try {
    const hasRated = await AsyncStorage.getItem(RATING_STORAGE_KEY);
    return hasRated === 'true';
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: 30,
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  starIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  rateButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    width: '100%',
    marginBottom: 12,
  },
  rateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B2B3A',
    textAlign: 'center',
  },
  laterButton: {
    paddingVertical: 12,
  },
  laterButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
});