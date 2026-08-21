export interface StravaAthlete {
  readonly id: number;
  readonly firstname: string;
  readonly lastname: string;
}

export interface StravaTokenExchange {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly athlete: StravaAthlete;
}

