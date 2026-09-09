const GEOAPIFY_STATIC_MAP_URL = "https://maps.geoapify.com/v1/staticmap";

export async function getGeoapifyActivityMap(input: {
  readonly apiKey: string;
  readonly polyline: string;
}): Promise<ArrayBuffer> {
  const url = new URL(GEOAPIFY_STATIC_MAP_URL);
  url.searchParams.set("apiKey", input.apiKey);

  // POST avoids URL length limits for detailed Strava routes. Omitting the
  // center and zoom lets Geoapify fit the map to the complete geometry.
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      style: "osm-bright",
      width: 800,
      height: 450,
      scaleFactor: 2,
      format: "png",
      attribution: "default",
      geometries: [{
        type: "polyline5",
        value: input.polyline,
        linecolor: "#fc4c02",
        linewidth: 5,
      }],
    }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Geoapify did not return the map: ${response.status}.`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.split(";")[0]?.trim().toLowerCase() !== "image/png") {
    throw new Error("Geoapify returned a response that is not a PNG image.");
  }

  return response.arrayBuffer();
}
