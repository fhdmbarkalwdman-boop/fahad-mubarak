import { supabase } from './supabase';
import type { Achievement, AdminSettings, OwnerProfile, Project, SiteUpdate } from './types';
import { must } from './useAsync';

export const fetchOwnerProfile = async () =>
  must(await supabase.from('owner_profile').select('*').eq('id', 1).single()) as OwnerProfile;

export const fetchSettings = async () =>
  must(await supabase.from('admin_settings').select('*').eq('id', 1).single()) as AdminSettings;

export const fetchPublishedProjects = async (limit?: number) => {
  let q = supabase.from('projects').select('*').eq('is_published', true)
    .order('is_featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false });
  if (limit) q = q.limit(limit);
  return must(await q) as Project[];
};

export const fetchAchievements = async (limit?: number) => {
  let q = supabase.from('achievements').select('*').eq('is_published', true)
    .order('sort_order').order('achieved_on', { ascending: false, nullsFirst: false });
  if (limit) q = q.limit(limit);
  return must(await q) as Achievement[];
};

export const fetchUpdates = async (limit?: number) => {
  let q = supabase.from('site_updates').select('*').eq('is_published', true).order('created_at', { ascending: false });
  if (limit) q = q.limit(limit);
  return must(await q) as SiteUpdate[];
};

export const unreadCount = async (userId: string) => {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
};
