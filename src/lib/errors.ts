import type { StringKey } from './strings';

const SERVER_CODES = [
  'REQUESTS_PAUSED', 'OPEN_REQUESTS_LIMIT', 'CONSULTATIONS_PAUSED', 'MONTHLY_LIMIT_REACHED',
  'MESSAGE_LIMIT_REACHED', 'CONSULTATION_CLOSED', 'FILE_TOO_LARGE', 'FILE_TYPE_NOT_ALLOWED',
  'INVALID_SUBJECT', 'INVALID_BODY', 'EMPTY_MESSAGE', 'FORBIDDEN', 'NOT_FOUND', 'AUTH_REQUIRED',
  'TOO_MANY_ATTACHMENTS', 'INVALID_TIMEZONE', 'OWNER_ACCOUNT_PROTECTED',
] as const;

/** Maps any thrown error (Postgres/Auth/network) to a translated message key. */
export function errorKey(e: unknown): StringKey {
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  for (const code of SERVER_CODES) if (msg.includes(code)) return `err_${code}` as StringKey;
  if (/invalid login credentials/i.test(msg)) return 'invalidCredentials';
  if (/email not confirmed/i.test(msg)) return 'emailNotConfirmed';
  if (/already registered|already been registered|user_already_exists/i.test(msg)) return 'userExists';
  if (/violates check constraint|invalid input/i.test(msg)) return 'err_validation';
  if (/permission denied|row-level security|42501/i.test(msg)) return 'err_FORBIDDEN';
  if (/network|fetch failed|Failed to fetch|timeout/i.test(msg)) return 'networkError';
  return 'errorGeneric';
}
