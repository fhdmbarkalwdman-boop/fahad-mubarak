import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushResult = 'enabled' | 'denied' | 'unavailable' | 'error';
let currentToken: string | null = null;

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/** Asks permission (if needed), gets the Expo push token and stores it server-side. */
export async function registerForPush(askPermission: boolean): Promise<PushResult> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FAHDAR',
        importance: AndroidImportance.HIGH,
        lightColor: '#2C56D6',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && askPermission) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return 'denied';
    const pid = projectId();
    if (!pid) return 'unavailable';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw error;
    currentToken = token;
    return 'enabled';
  } catch {
    return 'error';
  }
}

/** Removes this device's token before signing out so the next user doesn't get pushes. */
export async function unregisterPush() {
  if (!currentToken) return;
  await supabase.from('push_tokens').delete().eq('token', currentToken);
  currentToken = null;
}

export function routeForNotification(data: Record<string, unknown> | undefined): string {
  if (!data) return '/notifications';
  if (typeof data.request_id === 'string') return `/request/${data.request_id}`;
  if (typeof data.consultation_id === 'string') return `/consultation/${data.consultation_id}`;
  return '/notifications';
}

/** Navigates when the user taps a push notification. */
export function listenForNotificationTaps() {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown>;
    router.push(routeForNotification(data) as never);
  });
  return () => sub.remove();
}
