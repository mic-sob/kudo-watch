import { build } from "esbuild";

const entryPoints = [
  "src/handlers/discord-interactions.ts",
  "src/handlers/strava-oauth-start.ts",
  "src/handlers/strava-oauth-callback.ts",
  "src/handlers/strava-webhook.ts",
  "src/handlers/activity-worker.ts",
];

await build({
  entryPoints,
  outdir: "dist",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node24",
  sourcemap: true,
  minify: false,
  packages: "bundle",
});
