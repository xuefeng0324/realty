/**
 * 仅 dev 注入 eruda 控制台；prod 构建时整段会被 Vite tree-shake 剥离。
 * 用 ?url + 动态 <script> 注入，避免在 HTML 内嵌 eruda 字符串。
 */
export async function loadErudaInDev(): Promise<void> {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console
  console.log("[realty_app] dev: loading eruda console");
  await injectScript("https://cdn.jsdelivr.net/npm/eruda@2.5.0/eruda.min.js");
  // eruda 已挂载到 window，调用 init()
  (window as unknown as { eruda?: { init: () => void } }).eruda?.init();
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