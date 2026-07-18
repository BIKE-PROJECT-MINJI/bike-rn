import type { AuthSession } from '../../domain/auth/authModels';

export type ProfileSessionSummary = {
  readonly title: string;
  readonly emailLabel: string;
};

export function buildProfileSessionSummary(session: AuthSession): ProfileSessionSummary {
  return {
    title: session.displayName || session.email,
    emailLabel: `이메일: ${session.email}`,
  };
}
