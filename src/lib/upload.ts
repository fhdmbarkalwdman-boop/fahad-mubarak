import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { Attachment } from './types';

export type PickedFile = { uri: string; name: string; mimeType: string; size: number };

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'application/zip': 'zip',
};

const extOf = (name: string, mime: string) =>
  (name.includes('.') ? name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '') ||
  EXT[mime] || 'bin';

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function pickImages(multiple = false): Promise<PickedFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 0.85,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    name: a.fileName ?? `image-${Date.now()}.${a.mimeType === 'image/png' ? 'png' : 'jpg'}`,
    mimeType: a.mimeType ?? 'image/jpeg',
    size: a.fileSize ?? 0,
  }));
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType ?? 'application/octet-stream',
    size: a.size ?? 0,
  }));
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/** Uploads to a bucket under `<folder>/<uuid>.<ext>` and returns the storage path. */
export async function uploadToBucket(bucket: string, folder: string, file: PickedFile): Promise<{ path: string; size: number }> {
  const bytes = await readBytes(file.uri);
  const path = `${folder}/${uuid()}.${extOf(file.name, file.mimeType)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (error) throw error;
  return { path, size: bytes.byteLength };
}

/** Uploads a private attachment and registers it (server validates size/type/ownership). */
export async function uploadAttachment(userId: string, file: PickedFile, requestId?: string): Promise<Attachment> {
  const { path, size } = await uploadToBucket('attachments', userId, file);
  const { data, error } = await supabase
    .from('attachments')
    .insert({ path, file_name: file.name.slice(0, 200), mime_type: file.mimeType, size_bytes: size, request_id: requestId ?? null })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('attachments').remove([path]);
    throw error;
  }
  return data as Attachment;
}

export async function publicImageUpload(bucket: 'public-media' | 'avatars', folder: string, file: PickedFile) {
  const { path } = await uploadToBucket(bucket, folder, file);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
