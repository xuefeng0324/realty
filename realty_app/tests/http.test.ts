/**
 * HTTP 客户端单测（src/api/http.ts）。
 *
 * 覆盖：
 *  1. ApiError 构造 & 属性
 *  2. buildUrl 路径拼接、参数过滤、URL 编码（通过 apiGet 间接触发）
 *  3. setApiBaseUrl / getApiBaseUrl 持久化往返
 *  4. apiGet H5 分支：200 / 4xx / 5xx / JSON 解析失败
 *  5. apiPost H5 分支：body 序列化 / 4xx 抛 ApiError / 空 body
 *
 * 注：
 *  - 非 H5 分支（uni.request）在测试里不会走到，因为 uni 编译器会把
 *    `#ifdef H5` 之外的代码保留为独立分支；本仓库 vitest 跑在 node 环境下，
 *    测试运行时 H5 宏不展开。统一按 H5 分支行为测。
 *  - 通过 stub globalThis.fetch 和 uni.getStorageSync/setStorageSync 来隔离副作用。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ApiError,
  apiGet,
  apiPost,
  setApiBaseUrl,
  getApiBaseUrl
} from "../src/api/http";
import { DEFAULT_API_BASE_URL, STORAGE_KEYS } from "../src/config";

// 在 node 环境下，uni 全局不存在（import 时 uni-app 不会自动注入）；
// 这里创建一个最小 stub，只暴露 http.ts 用到的几个 API。
function installUniStub(initial: Record<string, unknown> = {}) {
  const storage = new Map<string, unknown>(Object.entries(initial));
  const stub = {
    getStorageSync: vi.fn((key: string) => storage.get(key) ?? ""),
    setStorageSync: vi.fn((key: string, value: unknown) => {
      storage.set(key, value);
    }),
    removeStorageSync: vi.fn((key: string) => {
      storage.delete(key);
    })
  };
  (globalThis as unknown as { uni: typeof stub }).uni = stub;
  return stub;
}

function uninstallUniStub() {
  delete (globalThis as unknown as { uni?: unknown }).uni;
}

describe("ApiError", () => {
  it("构造时设置 name/status/data,且是 Error 实例", () => {
    const e = new ApiError("boom", 418, { detail: "teapot" });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ApiError");
    expect(e.status).toBe(418);
    expect(e.data).toEqual({ detail: "teapot" });
    expect(e.message).toBe("boom");
  });
});

describe("buildUrl (via apiGet)", () => {
  beforeEach(() => {
    installUniStub();
  });
  afterEach(() => {
    uninstallUniStub();
    vi.restoreAllMocks();
  });

  it("无参数时拼接 base + path", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("{}")
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await apiGet("/api/foo");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toBe(`${DEFAULT_API_BASE_URL}/api/foo`);
  });

  it("path 不以 / 开头时自动补 /", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("{}")
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await apiGet("api/bar");

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toBe(`${DEFAULT_API_BASE_URL}/api/bar`);
  });

  it("过滤掉 undefined / null / 空字符串 参数", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("{}")
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await apiGet("/api/q", { a: 1, b: undefined, c: null, d: "", e: 0 });

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    // 0 是合法值,应该保留; b/c/d 过滤
    expect(calledUrl).toContain("a=1");
    expect(calledUrl).toContain("e=0");
    expect(calledUrl).not.toContain("b=");
    expect(calledUrl).not.toContain("c=");
    expect(calledUrl).not.toContain("d=");
  });

  it("对 key 和 value 都做 encodeURIComponent", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("{}")
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await apiGet("/api/q", { "a b": "x&y" });

    const [calledUrl] = fetchSpy.mock.calls[0] as [string];
    expect(calledUrl).toContain("a%20b=x%26y");
  });
});

describe("setApiBaseUrl / getApiBaseUrl", () => {
  beforeEach(() => {
    installUniStub();
  });
  afterEach(() => {
    uninstallUniStub();
    vi.restoreAllMocks();
  });

  it("默认读 DEFAULT_API_BASE_URL（未设置时）", () => {
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
  });

  it("setApiBaseUrl 后 getApiBaseUrl 返回最新值", () => {
    setApiBaseUrl("https://example.test/api");
    expect(getApiBaseUrl()).toBe("https://example.test/api");
  });

  it("读 storage 时 trim 掉首尾空格", () => {
    installUniStub({ [STORAGE_KEYS.apiBaseUrl]: "  https://spaced.test/  " });
    expect(getApiBaseUrl()).toBe("https://spaced.test/");
  });

  it("storage 是空字符串时回退到 DEFAULT_API_BASE_URL", () => {
    installUniStub({ [STORAGE_KEYS.apiBaseUrl]: "" });
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
  });
});

describe("apiGet H5 分支", () => {
  beforeEach(() => {
    installUniStub();
  });
  afterEach(() => {
    uninstallUniStub();
    vi.restoreAllMocks();
  });

  it("200 + JSON 解析成功,返回 data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ items: [1, 2, 3] }))
    }) as unknown as typeof fetch;

    const data = await apiGet<{ items: number[] }>("/api/listings");
    expect(data).toEqual({ items: [1, 2, 3] });
  });

  it("200 + 空 body 返回 null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve("")
    }) as unknown as typeof fetch;

    const data = await apiGet("/api/empty");
    expect(data).toBeNull();
  });

  it("4xx 抛 ApiError,带 status + 解析后的 data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({ error: "not found" }))
    }) as unknown as typeof fetch;

    await expect(apiGet("/api/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      data: { error: "not found" },
      message: "HTTP 404"
    });
  });

  it("5xx 抛 ApiError", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve("upstream down")
    }) as unknown as typeof fetch;

    await expect(apiGet("/api/down")).rejects.toBeInstanceOf(ApiError);
  });

  it("JSON 解析失败时 data 退化为原始文本（不抛）", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("<html>oops</html>")
    }) as unknown as typeof fetch;

    const data = await apiGet("/api/html");
    expect(data).toBe("<html>oops</html>");
  });
});

describe("apiPost H5 分支", () => {
  beforeEach(() => {
    installUniStub();
  });
  afterEach(() => {
    uninstallUniStub();
    vi.restoreAllMocks();
  });

  it("200 + JSON 返回 data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ ok: true }))
    }) as unknown as typeof fetch;

    const data = await apiPost<{ ok: boolean }>("/api/save", { x: 1 });
    expect(data).toEqual({ ok: true });
  });

  it("body 是对象时 JSON.stringify 后传入", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("{}")
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await apiPost("/api/save", { a: 1, b: "two" });

    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1,"b":"two"}');
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("application/json");
  });

  it("body 是 undefined / null 时不发送 body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("{}")
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await apiPost("/api/ping");
    await apiPost("/api/ping", null);

    expect((fetchSpy.mock.calls[0][1] as RequestInit).body).toBeUndefined();
    expect((fetchSpy.mock.calls[1][1] as RequestInit).body).toBeUndefined();
  });

  it("4xx 抛 ApiError", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: "bad input" }))
    }) as unknown as typeof fetch;

    await expect(apiPost("/api/save", {})).rejects.toMatchObject({
      status: 400,
      data: { error: "bad input" }
    });
  });
});