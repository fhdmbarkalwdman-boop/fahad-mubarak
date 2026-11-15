export type RequestStatus =
  | 'new' | 'under_review' | 'needs_info' | 'accepted' | 'rejected' | 'in_progress' | 'completed';
export type ProjectType =
  | 'mobile_app' | 'website' | 'platform' | 'management_system' | 'ecommerce' | 'improvement' | 'ai' | 'other';
export type Specialty =
  | 'programming' | 'web' | 'mobile' | 'ai' | 'databases' | 'cybersecurity' | 'tools' | 'general';
export type ConsultationStatus = 'open' | 'answered' | 'closed';
export type PortfolioStatus = 'idea' | 'in_progress' | 'completed' | 'paused';

export const REQUEST_STATUSES: RequestStatus[] =
  ['new', 'under_review', 'needs_info', 'accepted', 'rejected', 'in_progress', 'completed'];
export const PROJECT_TYPES: ProjectType[] =
  ['mobile_app', 'website', 'platform', 'management_system', 'ecommerce', 'improvement', 'ai', 'other'];
export const SPECIALTIES: Specialty[] =
  ['programming', 'web', 'mobile', 'ai', 'databases', 'cybersecurity', 'tools', 'general'];
export const PLATFORMS = ['android', 'ios', 'web', 'desktop', 'other'] as const;
export const PORTFOLIO_STATUSES: PortfolioStatus[] = ['idea', 'in_progress', 'completed', 'paused'];

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  locale: 'ar' | 'en';
  role: 'user' | 'owner';
  created_at: string;
};

export type SocialLink = { label: string; url: string };

export type OwnerProfile = {
  full_name: string;
  full_name_en: string;
  headline: string;
  headline_en: string;
  bio: string;
  bio_en: string;
  avatar_url: string | null;
  interests: string[];
  skills: string[];
  programming_areas: string[];
  social_links: SocialLink[];
  contact_email: string | null;
  updated_at: string;
};

export type Project = {
  id: string;
  title: string;
  title_en: string;
  summary: string;
  summary_en: string;
  description: string;
  description_en: string;
  idea: string;
  idea_en: string;
  category: string;
  technologies: string[];
  status: PortfolioStatus;
  cover_url: string | null;
  gallery: string[];
  link: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Achievement = {
  id: string;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  achieved_on: string | null;
  link: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
};

export type SiteUpdate = {
  id: string;
  title: string;
  title_en: string;
  body: string;
  body_en: string;
  is_published: boolean;
  created_at: string;
};

export type ProjectRequest = {
  id: string;
  request_number: string;
  user_id: string;
  project_name: string;
  description: string;
  project_type: ProjectType;
  platforms: string[];
  budget: string | null;
  timeline: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
};

export type RequestMessage = {
  id: string;
  request_id: string;
  sender_id: string | null;
  is_owner: boolean;
  kind: 'message' | 'status';
  new_status: RequestStatus | null;
  body: string;
  created_at: string;
};

export type Consultation = {
  id: string;
  user_id: string;
  specialty: Specialty;
  subject: string;
  status: ConsultationStatus;
  user_message_count: number;
  message_limit: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsultationMessage = {
  id: string;
  consultation_id: string;
  sender_id: string | null;
  is_owner: boolean;
  body: string;
  created_at: string;
};

export type Attachment = {
  id: string;
  uploaded_by: string | null;
  path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  request_id: string | null;
  consultation_id: string | null;
  consultation_message_id: string | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
};

export type AdminSettings = {
  requests_enabled: boolean;
  requests_paused_message: string;
  consultations_enabled: boolean;
  consultations_per_month: number;
  messages_per_consultation: number;
  max_open_requests: number;
  max_attachment_mb: number;
  quota_timezone: string;
  updated_at: string;
};

export type Quota = {
  used: number;
  monthly_limit: number;
  extra: number;
  remaining: number;
  messages_per_consultation: number;
  resets_at: string;
  enabled: boolean;
};

export type ActivityLog = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
