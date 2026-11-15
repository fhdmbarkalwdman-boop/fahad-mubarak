import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { listenForNotificationTaps, registerForPush } from '../lib/push';
import { fonts } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppStack() {
  const { ready, colors, scheme, t } = usePrefs();
  const { loading, session } = useAuth();
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const done = ready && fontsLoaded && !loading;

  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => undefined);
  }, [done]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);

  // Register this device for push when signed in (without prompting again if denied).
  useEffect(() => {
    if (session?.user.id) registerForPush(false).catch(() => undefined);
  }, [session?.user.id]);

  useEffect(() => listenForNotificationTaps(), []);

  if (!done) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('tabHome') }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AuthProvider>
          <AppStack />
        </AuthProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
