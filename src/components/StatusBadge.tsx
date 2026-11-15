import { usePrefs } from '../lib/prefs';
import type { ConsultationStatus, PortfolioStatus, RequestStatus } from '../lib/types';
import { Badge } from './ui';

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { t, colors } = usePrefs();
  const color = {
    new: colors.info,
    under_review: colors.warning,
    needs_info: colors.warning,
    accepted: colors.success,
    rejected: colors.danger,
    in_progress: colors.accent,
    completed: colors.success,
  }[status];
  return <Badge label={t(`status_${status}`)} color={color} />;
}

export function ConsultationStatusBadge({ status }: { status: ConsultationStatus }) {
  const { t, colors } = usePrefs();
  const color = { open: colors.warning, answered: colors.success, closed: colors.textMuted }[status];
  return <Badge label={t(`cstatus_${status}`)} color={color} />;
}

export function PortfolioStatusBadge({ status }: { status: PortfolioStatus }) {
  const { t, colors } = usePrefs();
  const color = { idea: colors.info, in_progress: colors.accent, completed: colors.success, paused: colors.textMuted }[status];
  return <Badge label={t(`pstatus_${status}`)} color={color} />;
}
