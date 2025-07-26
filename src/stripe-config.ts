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
    priceId: 'price_1Rp8OmEafAFTMvbGdRLcRMoI',
    name: 'SommIA Premium (Annuel)',
    description: 'Annuel - 60€/an (économise 40€ par rapport au mensuel)',
    mode: 'subscription',
  },
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};