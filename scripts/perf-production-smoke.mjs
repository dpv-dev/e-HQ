const baseUrl = process.env.PERF_BASE_URL ?? "https://app.eeee.mu";
const paths = [
  "/",
  "/index.html",
  "/console/office/bank",
  "/console/distribution/settings",
  "/console/command-center/settings"
];

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

const results = [];
for (const path of paths) {
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
