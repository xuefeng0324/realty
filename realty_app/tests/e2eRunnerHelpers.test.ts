import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

// JavaScript E2E runner helper is executed directly by Node in CI.
// @ts-ignore no declaration file is needed for this internal runner module
import { waitForHttpReady } from "./e2e/runner_helpers.mjs";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("waitForHttpReady", () => {
  it("waits until the server returns a successful response", async () => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests += 1;
      response.statusCode = requests < 3 ? 503 : 200;
      response.end("ok");
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server has no TCP address");

    const result = await waitForHttpReady(`http://127.0.0.1:${address.port}/`, {
      timeoutMs: 1000,
      intervalMs: 5
    });

    expect(result.status).toBe(200);
    expect(result.attempts).toBe(3);
  });

  it("fails before any smoke script starts when the server stays unavailable", async () => {
    await expect(waitForHttpReady("http://127.0.0.1:1/", {
      timeoutMs: 30,
      intervalMs: 5
    })).rejects.toThrow(/E2E server not ready/);
  });
});
