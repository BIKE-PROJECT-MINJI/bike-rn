import { buildProfileSessionSummary } from './profileSessionSummary';

describe('profileSessionSummary', () => {
  it('테스트 계정 식별 정보와 액세스 토큰 남은 시간을 만든다', () => {
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
      1_700_000_000_000,
    );

    expect(result).toEqual({
      title: '새 라이더',
      emailLabel: '이메일: new@example.com',
      userIdLabel: '사용자 ID: 11',
      accessTokenLabel: '액세스 토큰 약 10분 남음',
    });
  });

  it('이전 세션과 만료된 토큰을 구분해 표시한다', () => {
    const result = buildProfileSessionSummary(
      {
        displayName: '',
        email: 'legacy@example.com',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAtEpochMillis: 1_699_999_999_000,
        refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
      },
      1_700_000_000_000,
    );

    expect(result).toEqual({
      title: 'legacy@example.com',
      emailLabel: '이메일: legacy@example.com',
      userIdLabel: '사용자 ID: 이전 세션',
      accessTokenLabel: '액세스 토큰 만료됨 - 다시 로그인 필요',
    });
  });
});
