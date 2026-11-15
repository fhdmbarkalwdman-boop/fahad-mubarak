import { Stack } from 'expo-router';
import { RequireAuth } from '../../components/RequireAuth';
import { usePrefs } from '../../lib/prefs';
import { fonts } from '../../lib/theme';

// UI guard only — real protection is enforced by RLS / owner-checked RPCs.
export default function AdminLayout() {
  const { colors, t } = usePrefs();
  return (
    <RequireAuth owner>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: t('adminPanel') }} />
      </Stack>
    </RequireAuth>
  );
}
