export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
}

export const stripeProducts: StripeProduct[] = [
  {
    priceId: 'price_1Rixo1EafAFTMvbGEUY381Z2',
    name: 'SommIA Premium',
    description: 'Mensuel - 4,99€/mois',
    mode: 'subscription',
  },
  {
    priceId: 'price_1RpsAdEafAFTMvbGPm0iKFUg',
    name: 'SommIA Premium (Hebdomadaire)',
    description: 'Hebdomadaire - 2,99€/semaine',
    mode: 'subscription',
  },
  {
    priceId: 'price_1RpXeuEafAFTMvbGpj42kAWx',
    name: 'SommIA Premium (Annuel)',
    description: 'Annuel - 30€/an',
    mode: 'subscription',
  },
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};