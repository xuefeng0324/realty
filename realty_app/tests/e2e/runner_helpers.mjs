const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitForHttpReady(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 500;
  const request = options.fetchImpl ?? fetch;
  const startedAt = Date.now();
  let attempts = 0;
  let lastError = "no response";

  while (Date.now() - startedAt < timeoutMs) {
    attempts += 1;
    try {
      const response = await request(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(3000, timeoutMs))
      });
      if (response.ok) {
        return { attempts, durationMs: Date.now() - startedAt, status: response.status };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(intervalMs);
  }

  throw new Error(`E2E server not ready at ${url} after ${timeoutMs}ms (${attempts} attempts, last error: ${lastError})`);
}
