import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { LogoMark } from './Logo';
import { AppText, Button, Card, LoadingView, Screen } from './ui';

export function RequireAuth({ children, owner }: { children: ReactNode; owner?: boolean }) {
  const { session, loading, profileReady, isOwner } = useAuth();
  const { t } = usePrefs();
  const pathname = usePathname();
  if (loading || !profileReady) return <LoadingView />;
  if (!session) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <LogoMark size={64} />
          <AppText weight="bold" size={18} style={{ textAlign: 'center' }}>{t('signInRequired')}</AppText>
          <Button title={t('signIn')} style={{ alignSelf: 'stretch' }} onPress={() => router.push({ pathname: '/auth/sign-in', params: { next: pathname } })} />
          <Button title={t('signUp')} variant="secondary" style={{ alignSelf: 'stretch' }} onPress={() => router.push({ pathname: '/auth/sign-up', params: { next: pathname } })} />
        </Card>
      </Screen>
    );
  }
  if (owner && !isOwner) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <AppText weight="bold" size={18}>{t('forbidden')}</AppText>
        </Card>
      </Screen>
    );
  }
  return <>{children}</>;
}
