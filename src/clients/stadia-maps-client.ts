const STADIA_STATIC_MAP_URL =
  "https://tiles.stadiamaps.com/static/outdoors.png";

export async function getStadiaActivityMap(input: {
  readonly apiKey: string;
  readonly polyline: string;
}): Promise<ArrayBuffer> {
  const url = new URL(STADIA_STATIC_MAP_URL);
  url.searchParams.set("size", "800x450@2x");
  url.searchParams.set("line_precision", "5");
  url.searchParams.set("l", `${input.polyline},fc4c02,5`);

  const response = await fetch(url, {
    headers: { authorization: `Stadia-Auth ${input.apiKey}` },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Stadia Maps did not return the map: ${response.status}.`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.startsWith("image/") !== true) {
    throw new Error("Stadia Maps returned a response that is not an image.");
  }

  return response.arrayBuffer();
}
