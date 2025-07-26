export interface StripeProduct {
  priceId: string;
  name: string;
  description: string;
  mode: 'subscription' | 'payment';
}

export const stripeProducts: StripeProduct[] = [
  {
    priceId: 'price_1Rixo1EafAFTMvbGEUY381Z2', // Monthly price ID
    name: 'SommIA Premium',
    description: '4,99€/mois',
    mode: 'subscription',
  },
  {
    priceId: 'price_1Rp8OmEafAFTMvbGdRLcRMoI', // Annual price ID
    name: 'SommIA Premium (Annuel)',
    description: '60€/an',
    mode: 'subscription',
  },
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};