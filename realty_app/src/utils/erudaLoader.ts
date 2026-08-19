/**
 * Eruda 只在 dev 且显式携带 `?eruda=1` 时注入。
 * 它的右下角浮动入口会覆盖 uni-app 原生 TabBar，因此不能作为开发服默认层；
 * 同时避免自动化回归依赖外部 CDN。
 */
export function shouldLoadEruda(search: string): boolean {
  return new URLSearchParams(search).get("eruda") === "1";
}

export async function loadErudaInDev(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined" || !shouldLoadEruda(window.location.search)) return;
  // eslint-disable-next-line no-console
  console.log("[realty_app] dev: loading eruda console");
  try {
    await injectScript("https://cdn.jsdelivr.net/npm/eruda@2.5.0/eruda.min.js");
    // eruda 已挂载到 window，调用 init()
    (window as unknown as { eruda?: { init: () => void } }).eruda?.init();
  } catch (error) {
    // Eruda 是可选调试工具，加载失败不应制造应用级未处理 rejection。
    console.warn("[realty_app] dev: eruda unavailable", error);
  }
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
