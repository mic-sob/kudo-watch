interface PolylineMap {
  readonly id: string;
  readonly polyline: string | undefined;
  readonly summaryPolyline: string | undefined;
}

export interface StravaActivity {
  readonly id: number;
  readonly name: string;
  readonly sportType: string;
  readonly distance: number | undefined;
  readonly movingTime: number | undefined;
  readonly totalElevationGain: number | undefined;
  readonly averageSpeed: number | undefined;
  readonly startDate: string;
  readonly map: PolylineMap | undefined;
}
