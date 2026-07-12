const baseUrl = process.env.PERF_BASE_URL ?? "https://app.eeee.mu";
const paths = [
  "/",
  "/index.html",
  "/console/office/bank",
  "/console/distribution/settings",
  "/console/command-center/settings"
];
const sampleCount = Number.parseInt(process.env.PERF_SAMPLES ?? "10", 10);

async function measure(path) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const body = await response.arrayBuffer();
  const durationMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  console.log(`PASS ${path}: ${response.status} in ${durationMs} ms (${body.byteLength} bytes)`);
  return { path, response, body: new TextDecoder().decode(body), durationMs };
}

async function measureSamples(path) {
  const durations = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const result = await measure(path);
    durations.push(result.durationMs);
  }

  const sorted = [...durations].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  console.log(`SUMMARY ${path}: median ${median} ms, p95 ${p95} ms, samples ${sampleCount}`);
}

const results = [];
for (const path of paths.slice(2)) {
  results.push(await measure(path));
}

await measureSamples("/");
await measureSamples("/index.html");

for (const path of paths.slice(0, 2)) {
  results.push(await measure(path));
}

const index = results.find((result) => result.path === "/index.html");
if (index === undefined) {
  throw new Error("index.html result missing");
}

if (index.body.includes("workspace-office-")) {
  throw new Error("Production public index still references the Office workspace chunk");
}

const assetMatches = [...index.body.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/gu)];
for (const match of assetMatches) {
  const assetPath = match[1];
  await measure(assetPath.startsWith("/") ? assetPath : `/${assetPath}`);
}

const slowest = [...results].sort((left, right) => right.durationMs - left.durationMs)[0];
console.log(`Slowest document request: ${slowest.path} (${slowest.durationMs} ms)`);
