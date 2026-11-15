import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import type { PickedFile } from '../lib/upload';
import { AttachmentPicker } from './Attachments';
import { AppText } from './ui';
import { fonts, radius } from '../lib/theme';

export function MessageBubble({ mine, author, body, date, children }: { mine: boolean; author: string; body: string; date: string; children?: ReactNode }) {
  const { colors, lang } = usePrefs();
  return (
    <View style={{ alignItems: mine ? 'flex-start' : 'flex-end', marginVertical: 4 }}>
      <View
        style={{
          maxWidth: '86%',
          padding: 12,
          gap: 6,
          borderRadius: radius.lg,
          backgroundColor: mine ? colors.accent : colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.border,
          borderBottomStartRadius: mine ? 4 : radius.lg,
          borderBottomEndRadius: mine ? radius.lg : 4,
        }}
      >
        <AppText weight="semibold" size={12} style={{ color: mine ? '#DCE6FF' : colors.accent }}>{author}</AppText>
        {body ? <AppText style={{ color: mine ? '#fff' : colors.text }}>{body}</AppText> : null}
        {children}
        <AppText size={11} style={{ color: mine ? '#C9D6FF' : colors.textMuted }}>{formatDate(date, lang, true)}</AppText>
      </View>
    </View>
  );
}

export function Composer({
  onSend,
  disabled,
  withAttachments,
  maxMb = 10,
  footer,
}: {
  onSend: (text: string, files: PickedFile[]) => Promise<boolean>;
  disabled?: boolean;
  withAttachments?: boolean;
  maxMb?: number;
  footer?: ReactNode;
}) {
  const { colors, t, isRTL } = usePrefs();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [sending, setSending] = useState(false);
  const canSend = !disabled && !sending && (text.trim().length > 0 || files.length > 0);

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const ok = await onSend(text.trim(), files);
    setSending(false);
    if (ok) {
      setText('');
      setFiles([]);
      setShowFiles(false);
    }
  };

  return (
    <View style={{ borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 10, paddingBottom: 10 + insets.bottom, gap: 8 }}>
      {footer}
      {withAttachments && showFiles ? <AttachmentPicker files={files} onChange={setFiles} maxMb={maxMb} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {withAttachments ? (
          <Pressable accessibilityLabel={t('addAttachment')} disabled={disabled} onPress={() => setShowFiles((v) => !v)} style={{ padding: 10 }}>
            <Ionicons name="attach" size={24} color={disabled ? colors.textMuted : colors.accent} />
          </Pressable>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!disabled}
          placeholder={t('writeMessage')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={4000}
          style={{
            flex: 1, minHeight: 44, maxHeight: 140, paddingHorizontal: 14, paddingVertical: 10,
            borderRadius: radius.md, backgroundColor: colors.surfaceAlt, color: colors.text,
            fontFamily: fonts.regular, fontSize: 15, textAlign: isRTL ? 'right' : 'left',
          }}
        />
        <Pressable
          accessibilityLabel={t('send')}
          onPress={send}
          disabled={!canSend}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? colors.accent : colors.border }}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={19} color="#fff" style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }} />}
        </Pressable>
      </View>
    </View>
  );
}
