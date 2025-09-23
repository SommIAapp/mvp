import Mixpanel from 'mixpanel-react-native';

const MIXPANEL_TOKEN = 'd524ada14e0f14019998e1cfc666f2f6';

let mixpanelInstance: Mixpanel | null = null;

export const Analytics = {
  async init() {
    try {
      if (!mixpanelInstance) {
        mixpanelInstance = new Mixpanel(MIXPANEL_TOKEN, true);
        await mixpanelInstance.init();
        console.log('✅ Mixpanel initialized');
      }
    } catch (error) {
      console.error('❌ Mixpanel init error:', error);
    }
  },

  track(event: string, properties?: any) {
    if (__DEV__) {
      console.log(`📊 Analytics: ${event}`, properties);
    }
    mixpanelInstance?.track(event, properties);
  },

  identify(userId: string) {
    mixpanelInstance?.identify(userId);
  },

  setUserProperties(properties: any) {
    mixpanelInstance?.getPeople().set(properties);
  },

  // Événements SOMMIA
  events: {
    // App Lifecycle
    APP_OPENED: 'App Opened',
    APP_UPDATED: 'App Updated',
    
    // Onboarding
    ONBOARDING_START: 'Onboarding Started',
    ONBOARDING_AGE_CONFIRMED: 'Age Confirmed',
    ONBOARDING_COMPLETE: 'Onboarding Completed',
    
    // Recommendations
    RECOMMENDATION_REQUESTED: 'Recommendation Requested',
    RECOMMENDATION_RECEIVED: 'Recommendation Received',
    RECOMMENDATION_ERROR: 'Recommendation Error',
    WINE_SELECTED: 'Wine Selected',
    
    // Restaurant Mode
    RESTAURANT_SCAN_START: 'Restaurant Scan Started',
    RESTAURANT_SCAN_SUCCESS: 'Restaurant Scan Success',
    RESTAURANT_SCAN_ERROR: 'Restaurant Scan Error',
    RESTAURANT_RECOMMENDATION: 'Restaurant Recommendation Made',
    
    // Paywall & Monetization
    PAYWALL_SHOWN: 'Paywall Shown',
    TRIAL_STARTED: 'Trial Started',
    SUBSCRIPTION_STARTED: 'Subscription Started',
    SUBSCRIPTION_CANCELLED: 'Subscription Cancelled',
    SUBSCRIPTION_RESTORED: 'Subscription Restored',
    
    // User Engagement
    SETTINGS_CHANGED: 'Settings Changed',
    LANGUAGE_CHANGED: 'Language Changed',
    SUPPORT_CONTACTED: 'Support Contacted',
    APP_REVIEWED: 'App Reviewed',
    
    // Errors
    ERROR_OCCURRED: 'Error Occurred',
    API_ERROR: 'API Error',
    NETWORK_ERROR: 'Network Error',
  }
};
