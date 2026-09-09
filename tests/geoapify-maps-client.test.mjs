import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getGeoapifyActivityMap } from "../src/clients/geoapify-maps-client.ts";

afterEach(() => mock.restoreAll());

test("sends long encoded routes intact in a POST body and returns PNG bytes", async () => {
  const polyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@".repeat(200);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=",
    "base64",
  );
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.origin, "https://maps.geoapify.com");
    assert.equal(url.pathname, "/v1/staticmap");
    assert.equal(url.searchParams.get("apiKey"), "test-key");
    assert.ok(url.href.length < 200);
    assert.equal(options.method, "POST");
    assert.equal(options.headers["content-type"], "application/json");
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.format, "png");
    assert.equal(body.width * body.scaleFactor, 1600);
    assert.equal(body.height * body.scaleFactor, 900);
    assert.equal(body.attribution, "default");
    assert.equal(body.center, undefined);
    assert.equal(body.zoom, undefined);
    assert.deepEqual(body.geometries, [{
      type: "polyline5", value: polyline, linecolor: "#fc4c02", linewidth: 5,
    }]);
    return new Response(png, { headers: { "content-type": "image/png" } });
  });

  const result = await getGeoapifyActivityMap({ apiKey: "test-key", polyline });
  assert.deepEqual(Buffer.from(result), png);
  assert.equal(fetchMock.mock.callCount(), 1);
});

for (const status of [401, 429, 503]) {
  test(`rejects HTTP ${status} without exposing the key or response body`, async () => {
    mock.method(globalThis, "fetch", async () => new Response("secret details", { status }));
    await assert.rejects(
      getGeoapifyActivityMap({ apiKey: "test-key", polyline: "route" }),
      { message: `Geoapify did not return the map: ${status}.` },
    );
  });
}

for (const contentType of ["application/json", "image/jpeg", ""]) {
  test(`rejects a successful response with content type '${contentType}'`, async () => {
    mock.method(globalThis, "fetch", async () => new Response("invalid image", {
      headers: { "content-type": contentType },
    }));
    await assert.rejects(
      getGeoapifyActivityMap({ apiKey: "test-key", polyline: "route" }),
      /not a PNG image/,
    );
  });
}

test("propagates timeouts so the worker can publish without a map", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Timed out", "TimeoutError");
  });
  await assert.rejects(
    getGeoapifyActivityMap({ apiKey: "test-key", polyline: "route" }),
    { name: "TimeoutError" },
  );
});
