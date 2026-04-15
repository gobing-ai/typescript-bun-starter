import { afterEach, describe, expect, test } from "bun:test";
import { createApiClient, fetchHealth } from "../../src/lib/api-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createApiClient", () => {
  test("unwraps data envelopes for successful API responses", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            status: "ok",
            timestamp: "2026-04-15T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

    const api = createApiClient("https://example.com");
    const response = await api.get<{ status: string; timestamp: string }>("/api/health");

    expect(response.status).toBe(200);
    expect(response.error).toBeUndefined();
    expect(response.data).toEqual({
      status: "ok",
      timestamp: "2026-04-15T00:00:00.000Z",
    });
  });

  test("preserves direct JSON payloads for non-enveloped responses", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "ok",
          timestamp: "2026-04-15T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

    const api = createApiClient("https://example.com");
    const response = await api.get<{ status: string; timestamp: string }>("/");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      status: "ok",
      timestamp: "2026-04-15T00:00:00.000Z",
    });
  });

  test("uses error payloads for failed responses", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
        statusText: "Unauthorized",
      });

    const api = createApiClient("https://example.com");
    const response = await api.get("/api/skills");

    expect(response.status).toBe(401);
    expect(response.data).toBeUndefined();
    expect(response.error).toBe("Missing API key");
  });

  test("falls back to the HTTP status text when error payload is missing", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: "still broken" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
        statusText: "Internal Server Error",
      });

    const api = createApiClient("https://example.com");
    const response = await api.get("/api/skills");

    expect(response.status).toBe(500);
    expect(response.error).toBe("Internal Server Error");
  });

  test("keeps plain-text success payloads when the response is not JSON", async () => {
    globalThis.fetch = async () =>
      new Response("plain text response", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });

    const api = createApiClient("https://example.com");
    const response = await api.get<string>("/plain-text");

    expect(response.status).toBe(200);
    expect(response.data).toBe("plain text response");
  });

  test("returns network errors when fetch throws", async () => {
    globalThis.fetch = async () => {
      throw new Error("socket hang up");
    };

    const api = createApiClient("https://example.com");
    const response = await api.get("/api/skills");

    expect(response.status).toBe(0);
    expect(response.error).toBe("socket hang up");
  });

  test("sends JSON bodies for write methods", async () => {
    const requests: Array<{ input: string | URL | Request; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const api = createApiClient("https://example.com");

    await api.post("/api/skills", { name: "post-skill" });
    await api.put("/api/skills/1", { name: "put-skill" });
    await api.delete("/api/skills/1");

    expect(requests).toHaveLength(3);
    expect(requests[0]?.input).toBe("https://example.com/api/skills");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.body).toBe(JSON.stringify({ name: "post-skill" }));
    expect(requests[1]?.input).toBe("https://example.com/api/skills/1");
    expect(requests[1]?.init?.method).toBe("PUT");
    expect(requests[1]?.init?.body).toBe(JSON.stringify({ name: "put-skill" }));
    expect(requests[2]?.input).toBe("https://example.com/api/skills/1");
    expect(requests[2]?.init?.method).toBe("DELETE");
    expect(requests[2]?.init?.body).toBeUndefined();
  });
});

describe("fetchHealth", () => {
  test("calls the API health endpoint", async () => {
    globalThis.fetch = async (input) => {
      expect(input).toBe("/api/health");

      return new Response(
        JSON.stringify({
          data: {
            status: "ok",
            timestamp: "2026-04-15T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    };

    const response = await fetchHealth();

    expect(response.status).toBe(200);
    expect(response.data?.status).toBe("ok");
  });
});
