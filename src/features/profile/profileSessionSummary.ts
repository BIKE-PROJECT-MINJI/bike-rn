import type { AuthSession } from '../../domain/auth/authModels';

export type ProfileSessionSummary = {
  readonly title: string;
  readonly emailLabel: string;
  readonly userIdLabel: string;
  readonly accessTokenLabel: string;
};

export function buildProfileSessionSummary(session: AuthSession, nowEpochMillis: number): ProfileSessionSummary {
  return {
    title: session.displayName || session.email,
    emailLabel: `이메일: ${session.email}`,
    userIdLabel: session.userId === undefined ? '사용자 ID: 이전 세션' : `사용자 ID: ${session.userId}`,
    accessTokenLabel: buildAccessTokenLabel(session.accessTokenExpiresAtEpochMillis, nowEpochMillis),
  };
}

function buildAccessTokenLabel(expiresAtEpochMillis: number, nowEpochMillis: number): string {
  const remainingMillis = expiresAtEpochMillis - nowEpochMillis;
  if (remainingMillis <= 0) {
    return '액세스 토큰 만료됨 - 다시 로그인 필요';
  }
  const remainingMinutes = Math.max(1, Math.ceil(remainingMillis / 60_000));
  return `액세스 토큰 약 ${remainingMinutes}분 남음`;
}
