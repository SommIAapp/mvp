import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  
  if (__DEV__) {
    console.log('🏠 Index: Component rendered', {
      user: user ? `${user.id} (${user.email})` : 'null',
      loading
    });
  }
  
  return <Redirect href="/splash" />;
}