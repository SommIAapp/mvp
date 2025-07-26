import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Utensils, MapPin, CircleCheck as CheckCircle, RotateCcw, User, Wine } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantMode } from '@/hooks/useRestaurantMode';

const { width } = Dimensions.get('window');

type RestaurantStep = 'scan' | 'dish' | 'recommendations';

export default function RestaurantScreen() {
  const router = useRouter();
  const { user, profile, canMakeRecommendation } = useAuth();
  const { 
    scanWineCard, 
    getRestaurantRecommendations, 
    currentSession,
    loading,
    error 
  } = useRestaurantMode();

  const [currentStep, setCurrentStep] = useState<RestaurantStep>('scan');
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [extractedWines, setExtractedWines] = useState<any[]>([]);
  const [dishDescription, setDishDescription] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [processingImage, setProcessingImage] = useState(false);
  const [gettingRecommendations, setGettingRecommendations] = useState(false);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'L\'accès à l\'appareil photo est nécessaire pour scanner la carte des vins.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setScannedImage(result.assets[0].uri);
        await processWineCard(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à l\'appareil photo');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'L\'accès à la galerie est nécessaire pour sélectionner une photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setScannedImage(result.assets[0].uri);
        await processWineCard(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder à la galerie');
    }
  };

  const processWineCard = async (imageUri: string) => {
    setProcessingImage(true);
    
    try {
      const result = await scanWineCard(imageUri);
      setExtractedWines(result.extracted_wines || []);
      setCurrentStep('dish');
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert(
        'Erreur de traitement',
        'Impossible d\'analyser la carte des vins. Voulez-vous réessayer ou saisir manuellement ?',
        [
          { text: 'Réessayer', onPress: () => setScannedImage(null) },
          { text: 'Saisie manuelle', onPress: () => handleManualEntry() }
        ]
      );
    } finally {
      setProcessingImage(false);
    }
  };

  const handleManualEntry = () => {
    // For now, simulate manual entry with some example wines
    setExtractedWines([
      { name: 'Château Margaux 2018', type: 'rouge', price_bottle: 45, region: 'Bordeaux' },
      { name: 'Sancerre Loire 2022', type: 'blanc', price_bottle: 28, region: 'Loire' },
      { name: 'Côtes du Rhône 2021', type: 'rouge', price_bottle: 22, region: 'Rhône' }
    ]);
    setCurrentStep('dish');
  };

  const handleGetRecommendations = async () => {
    if (!dishDescription.trim()) {
      Alert.alert('Erreur', 'Veuillez décrire votre plat');
      return;
    }

    if (!canMakeRecommendation()) {
      router.push({
        pathname: '/subscription',
        params: { reason: 'daily_limit' }
      });
      return;
    }

    setGettingRecommendations(true);

    try {
      const result = await getRestaurantRecommendations(
        dishDescription,
        extractedWines,
        undefined
      );
      setRecommendations(result);
      setCurrentStep('recommendations');
    } catch (error) {
      console.error('Restaurant recommendations error:', error);
      Alert.alert('Erreur', 'Impossible de générer les recommandations');
    } finally {
      setGettingRecommendations(false);
    }
  };

  const handleRetakePhoto = () => {
    setScannedImage(null);
    setExtractedWines([]);
    setCurrentStep('scan');
  };

  const renderScanStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>1</Text>
        </View>
        <Text style={styles.stepTitle}>Scannez la carte des vins</Text>
      </View>

      {scannedImage ? (
        <View style={styles.imagePreview}>
          <Image source={{ uri: scannedImage }} style={styles.previewImage} />
          <View style={styles.imageOverlay}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetakePhoto}>
              <RotateCcw size={20} color={Colors.accent} />
              <Text style={styles.retakeText}>Reprendre</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.scanSection}>
          <View style={styles.scanCard}>
            <Camera size={48} color={Colors.primary} strokeWidth={1} />
            <Text style={styles.scanTitle}>Photographiez la carte des vins</Text>
            <Text style={styles.scanSubtitle}>
              Prenez une photo claire de la section vins de la carte
            </Text>
            
            <View style={styles.scanButtons}>
              <Button
                title="Prendre une photo"
                onPress={handleTakePhoto}
                variant="primary"
                size="large"
                fullWidth
              />
              
              <Button
                title="Choisir depuis la galerie"
                onPress={handlePickFromGallery}
                variant="outline"
                size="medium"
                fullWidth
              />
            </View>
          </View>
          
          <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
            <Text style={styles.manualText}>Ou saisir manuellement les vins</Text>
          </TouchableOpacity>
        </View>
      )}

      {processingImage && (
        <View style={styles.processingOverlay}>
          <LoadingSpinner text="Analyse de la carte en cours..." />
        </View>
      )}
    </View>
  );

  const renderDishStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <CheckCircle size={16} color={Colors.accent} />
        </View>
        <Text style={styles.stepTitle}>Décrivez votre plat</Text>
      </View>

      <View style={styles.winesDetected}>
        <Text style={styles.winesDetectedText}>
          ✅ {extractedWines.length} vins détectés sur la carte
        </Text>
      </View>

      <View style={styles.dishSection}>
        <Input
          label="Que mangez-vous ce soir ?"
          placeholder="Décrivez votre plat..."
          value={dishDescription}
          onChangeText={setDishDescription}
          multiline
          numberOfLines={2}
          maxLength={200}
        />

        <Button
          title={gettingRecommendations ? "Analyse en cours..." : "Trouver l'accord parfait"}
          onPress={handleGetRecommendations}
          variant="primary"
          size="large"
          fullWidth
          loading={gettingRecommendations}
        />
      </View>
    </View>
  );

  const renderRecommendationsStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumber}>
          <CheckCircle size={16} color={Colors.accent} />
        </View>
        <Text style={styles.stepTitle}>Vos recommandations</Text>
      </View>

      <Text style={styles.recommendationsSubtitle}>
        Pour {dishDescription} • Carte de ce restaurant
      </Text>

      <ScrollView style={styles.recommendationsList} showsVerticalScrollIndicator={false}>
        {recommendations.map((wine, index) => (
          <View key={index} style={styles.restaurantWineCard}>
            <View style={styles.wineCardHeader}>
              <View style={styles.wineTypeIndicator}>
                <Wine size={20} color={Colors.primary} />
                <Text style={styles.wineType}>{wine.type}</Text>
              </View>
              <Text style={styles.winePrice}>
                €{wine.price_bottle || wine.price_glass}
                {wine.price_glass && '/verre'}
              </Text>
            </View>
            
            <Text style={styles.wineName}>{wine.name}</Text>
            {wine.region && (
              <Text style={styles.wineRegion}>{wine.region}</Text>
            )}
            
            <Text style={styles.wineReasoning}>{wine.reasoning}</Text>
            
            <View style={styles.wineActions}>
              <Button
                title="Demander au serveur"
                onPress={() => Alert.alert('Info', `Demandez le ${wine.name} à votre serveur`)}
                variant="primary"
                size="medium"
                fullWidth
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.newSearchSection}>
        <Button
          title="Nouvelle recherche"
          onPress={() => {
            setCurrentStep('scan');
            setScannedImage(null);
            setExtractedWines([]);
            setDishDescription('');
            setRecommendations([]);
          }}
          variant="outline"
          size="medium"
          fullWidth
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.restaurantIcon}>
              <Utensils size={28} color={Colors.accent} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Mode Restaurant</Text>
              <Text style={styles.headerSubtitle}>
                Trouvez le vin parfait sur la carte
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <User size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 'scan' && renderScanStep()}
        {currentStep === 'dish' && renderDishStep()}
        {currentStep === 'recommendations' && renderRecommendationsStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.accent,
  },
  headerSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.accent,
    opacity: 0.9,
    marginTop: 2,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepContainer: {
    marginBottom: 32,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.accent,
  },
  stepTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  scanSection: {
    alignItems: 'center',
  },
  scanCard: {
    backgroundColor: Colors.softGray,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  scanTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  scanSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
  },
  scanButtons: {
    width: '100%',
    gap: 12,
  },
  manualButton: {
    paddingVertical: 16,
  },
  manualText: {
    fontSize: Typography.sizes.base,
    color: Colors.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  imagePreview: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  imageOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retakeText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    marginLeft: 6,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  winesDetected: {
    backgroundColor: Colors.success,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  winesDetectedText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.accent,
    textAlign: 'center',
  },
  dishSection: {
    gap: 24,
  },
  recommendationsSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  recommendationsList: {
    maxHeight: 400,
  },
  restaurantWineCard: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.secondary,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.darkGray,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  wineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wineTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wineType: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.primary,
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  winePrice: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.secondary,
  },
  wineName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  wineRegion: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  wineReasoning: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    lineHeight: Typography.sizes.base * Typography.lineHeights.relaxed,
    marginBottom: 16,
  },
  wineActions: {
    marginTop: 8,
  },
  newSearchSection: {
    marginTop: 24,
    paddingBottom: 32,
  },
});