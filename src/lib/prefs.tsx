import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings, I18nManager, Platform, useColorScheme } from 'react-native';
import { dictionaries, type Lang, type StringKey } from './strings';
import { darkColors, lightColors, type ThemeColors } from './theme';

export type ThemePref = 'system' | 'light' | 'dark';

type PrefsValue = {
  ready: boolean;
  lang: Lang;
  isRTL: boolean;
  themePref: ThemePref;
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  /** Picks the English variant of a bilingual field when in English (falls back to Arabic). */
  pick: (ar: string | null | undefined, en: string | null | undefined) => string;
  setLang: (lang: Lang) => Promise<void>;
  setThemePref: (pref: ThemePref) => Promise<void>;
};

const PrefsContext = createContext<PrefsValue | null>(null);
const LANG_KEY = 'fahdar.lang';
const THEME_KEY = 'fahdar.theme';

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'ar';
}

async function applyDirection(lang: Lang) {
  const wantRTL = lang === 'ar';
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = wantRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }
  if (I18nManager.isRTL === wantRTL) return false;
  I18nManager.allowRTL(wantRTL);
  I18nManager.forceRTL(wantRTL);
  // Layout direction only changes after a JS reload.
  try {
    await Updates.reloadAsync();
  } catch {
    if (__DEV__) DevSettings.reload();
  }
  return true;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>('ar');
  const [themePref, setThemePrefState] = useState<ThemePref>('system');

  useEffect(() => {
    (async () => {
      let storedLang: Lang = deviceLang();
      let storedTheme: ThemePref = 'system';
      try {
        const [l, th] = await Promise.all([AsyncStorage.getItem(LANG_KEY), AsyncStorage.getItem(THEME_KEY)]);
        if (l === 'ar' || l === 'en') storedLang = l;
        if (th === 'light' || th === 'dark' || th === 'system') storedTheme = th;
      } catch {
        // storage unavailable: use defaults
      }
      setLangState(storedLang);
      setThemePrefState(storedTheme);
      const reloading = await applyDirection(storedLang);
      if (!reloading) setReady(true);
    })();
  }, []);

  const setLang = useCallback(async (next: Lang) => {
    await AsyncStorage.setItem(LANG_KEY, next).catch(() => undefined);
    setLangState(next);
    await applyDirection(next);
  }, []);

  const setThemePref = useCallback(async (next: ThemePref) => {
    setThemePrefState(next);
    await AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<PrefsValue>(() => {
    const scheme = themePref === 'system' ? (system === 'dark' ? 'dark' : 'light') : themePref;
    const dict = dictionaries[lang];
    return {
      ready,
      lang,
      isRTL: lang === 'ar',
      themePref,
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      t: (key, params) => {
        let s = dict[key] ?? dictionaries.ar[key] ?? key;
        if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
        return s;
      },
      pick: (arText, enText) => (lang === 'en' && enText ? enText : arText || enText || ''),
      setLang,
      setThemePref,
    };
  }, [ready, lang, themePref, system, setLang, setThemePref]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
