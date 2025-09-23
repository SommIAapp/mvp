// Version temporaire pour Bolt - remplacée par la vraie en production
export const Analytics = {
  async init() {
    console.log('📊 Analytics: Init (Bolt mode - no Mixpanel)');
  },

  track(event: string, properties?: any) {
    if (__DEV__) {
      console.log(`📊 Analytics Event: ${event}`, properties);
    }
  },

  identify(userId: string) {
    console.log(`📊 Analytics: User identified - ${userId}`);
  },

  events: {
    APP_OPENED: 'App Opened',
    RECOMMENDATION_MADE: 'Recommendation Made',
    RESTAURANT_SCAN_STARTED: 'Restaurant Scan Started',
    PAYWALL_SHOWN: 'Paywall Shown',
    SUBSCRIPTION_STARTED: 'Subscription Started',
  }
};