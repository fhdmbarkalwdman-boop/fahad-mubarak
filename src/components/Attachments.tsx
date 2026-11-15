import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { errorKey } from '../lib/errors';
import { formatBytes } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { pickDocuments, pickImages, signedUrl, type PickedFile } from '../lib/upload';
import type { Attachment } from '../lib/types';
import { AppText, Button } from './ui';

const MAX_FILES = 5;

/** Local list of files chosen before sending (uploaded on submit). */
export function AttachmentPicker({ files, onChange, maxMb }: { files: PickedFile[]; onChange: (f: PickedFile[]) => void; maxMb: number }) {
  const { t, colors } = usePrefs();
  const add = async (kind: 'image' | 'doc') => {
    try {
      const picked = kind === 'image' ? await pickImages(true) : await pickDocuments();
      const tooBig = picked.filter((f) => f.size > maxMb * 1024 * 1024);
      if (tooBig.length) Alert.alert(t('err_FILE_TOO_LARGE'), `${maxMb} MB`);
      const next = [...files, ...picked.filter((f) => !tooBig.includes(f))].slice(0, MAX_FILES);
      onChange(next);
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button small variant="secondary" icon="image-outline" title={t('addImage')} onPress={() => add('image')} disabled={files.length >= MAX_FILES} />
        <Button small variant="secondary" icon="attach" title={t('addAttachment')} onPress={() => add('doc')} disabled={files.length >= MAX_FILES} />
      </View>
      {files.map((f, i) => (
        <View key={f.uri + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceAlt }}>
          <Ionicons name={f.mimeType.startsWith('image/') ? 'image' : 'document-text'} size={18} color={colors.accent} />
          <AppText size={13} numberOfLines={1} style={{ flex: 1 }}>{f.name}</AppText>
          {f.size ? <AppText muted size={12}>{formatBytes(f.size)}</AppText> : null}
          <Pressable accessibilityLabel={t('delete')} hitSlop={8} onPress={() => onChange(files.filter((_, j) => j !== i))}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** Uploaded attachments; opens a short-lived signed URL. */
export function AttachmentList({ items, compact }: { items: Attachment[]; compact?: boolean }) {
  const { t, colors } = usePrefs();
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) return null;
  const open = async (a: Attachment) => {
    setBusy(a.id);
    try {
      const url = await signedUrl(a.path);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert(t('error'), t(errorKey(e)));
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      {items.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => open(a)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 8, padding: compact ? 8 : 10, borderRadius: 10,
            backgroundColor: colors.surfaceAlt, opacity: pressed || busy === a.id ? 0.6 : 1,
          })}
        >
          <Ionicons name={a.mime_type.startsWith('image/') ? 'image' : 'document-attach'} size={18} color={colors.accent} />
          <AppText size={13} numberOfLines={1} style={{ flex: 1 }}>{a.file_name}</AppText>
          <AppText muted size={12}>{formatBytes(a.size_bytes)}</AppText>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}
