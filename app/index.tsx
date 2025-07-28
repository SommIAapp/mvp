import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, loading } = useAuth();
  
  console.log('🏠 Index: Component rendered', {
    user: user ? `${user.id} (${user.email})` : 'null',
    loading
  });
  
  return <Redirect href="/splash" />;
}