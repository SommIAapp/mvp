import { Mixpanel } from 'mixpanel-react-native';

const trackAutomaticEvents = true;
const mixpanel = new Mixpanel('d524ada14e0f14019998e1cfc666f2f6', trackAutomaticEvents);

class MixpanelService {
  private initialized = false;

  async init() {
    if (this.initialized) return;
    
    await mixpanel.init();
    this.initialized = true;
    console.log('✅ Mixpanel initialized');
  }

  async identify(userId: string, email?: string) {
    await this.init();
    mixpanel.identify(userId);
    if (email) {
      mixpanel.getPeople().set('$email', email);
    }
  }

  track(eventName: string, properties?: any) {
    if (!this.initialized) {
      console.warn('Mixpanel not initialized');
      return;
    }
    mixpanel.track(eventName, properties);
  }

  // Événements spécifiques à SOMMIA
  trackSearch(dish: string, budget?: number, wineType?: string) {
    this.track('Wine Search', {
      dish,
      budget,
      wine_type: wineType,
      has_budget: !!budget,
      has_wine_preference: !!wineType,
    });
  }

  trackRecommendation(dish: string, recommendationsCount: number) {
    this.track('Recommendations Received', {
      dish,
      recommendations_count: recommendationsCount,
      success: recommendationsCount > 0,
    });
  }

  trackScreenView(screenName: string) {
    this.track('Screen View', {
      screen_name: screenName,
    });
  }

  trackError(errorType: string, errorMessage: string) {
    this.track('Error', {
      error_type: errorType,
      error_message: errorMessage,
    });
  }

  trackRestaurantMode(action: string, data?: any) {
    this.track('Restaurant Mode', {
      action,
      ...data,
    });
  }

  trackPremiumAction(action: string) {
    this.track('Premium Action', {
      action,
    });
  }

  trackPhotoMode(action: string, data?: any) {
    this.track('Photo Mode', {
      action,
      ...data,
    });
  }

  trackHistoryAction(action: string, data?: any) {
    this.track('History', {
      action,
      ...data,
    });
  }
}

export const analytics = new MixpanelService();