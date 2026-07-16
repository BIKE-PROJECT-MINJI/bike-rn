import { buildProfileSessionSummary } from './profileSessionSummary';

describe('profileSessionSummary', () => {
  it('사용자에게 필요한 계정 이름과 이메일만 만든다', () => {
    const result = buildProfileSessionSummary(
      {
        userId: 11,
        displayName: '새 라이더',
        email: 'new@example.com',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAtEpochMillis: 1_700_000_600_000,
        refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
      },
    );

    expect(result).toEqual({
      title: '새 라이더',
      emailLabel: '이메일: new@example.com',
    });
  });

  it('표시 이름이 없으면 이메일을 제목으로 사용한다', () => {
    const result = buildProfileSessionSummary(
      {
        displayName: '',
        email: 'legacy@example.com',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAtEpochMillis: 1_699_999_999_000,
        refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
      },
    );

    expect(result).toEqual({
      title: 'legacy@example.com',
      emailLabel: '이메일: legacy@example.com',
    });
  });
});
