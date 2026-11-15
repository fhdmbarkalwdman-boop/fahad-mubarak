import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { usePrefs } from '../../lib/prefs';
import { unreadCount } from '../../lib/queries';
import { fonts } from '../../lib/theme';

export default function TabsLayout() {
  const { colors, t } = usePrefs();
  const { session } = useAuth();
  const [unread, setUnread] = useState(0);
  const insets = useSafeAreaInsets();
  const uid = session?.user.id;

  useFocusEffect(
    useCallback(() => {
      if (!uid) {
        setUnread(0);
        return;
      }
      unreadCount(uid).then(setUnread).catch(() => undefined);
    }, [uid]),
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.bold },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t('projectsTitle'),
          tabBarLabel: t('tabProjects'),
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: t('aboutTitle'),
          tabBarLabel: t('tabAbout'),
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('account'),
          tabBarLabel: t('tabAccount'),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
