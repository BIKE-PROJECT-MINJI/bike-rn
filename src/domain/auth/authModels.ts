export type AuthSession = {
  readonly userId: number;
  readonly displayName: string;
  readonly email: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresAtEpochMillis: number;
  readonly refreshTokenExpiresAtEpochMillis: number;
};

export type AuthTokenResponse = {
  readonly tokenType: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresInSec: number;
  readonly refreshExpiresInSec: number;
  readonly userId: number;
  readonly displayName: string;
};
