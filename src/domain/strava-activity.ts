export interface StravaActivity {
  readonly id: number;
  readonly name: string;
  readonly sportType: string;
  readonly distance: number | undefined;
  readonly movingTime: number | undefined;
  readonly totalElevationGain: number | undefined;
  readonly averageSpeed: number | undefined;
  readonly startDate: string;
}
