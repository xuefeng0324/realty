/**
 * 远端拉取：多 CDN 镜像回退。
 *
 * 背景：`cdn.jsdelivr.net` 在中国大陆经常被屏蔽/污染，导致「刷新」直接失败。
 * 这里按「大陆可用性」优先级尝试多个镜像，命中即返回，并回传命中的 base，
 * 供调用方用同一镜像继续拉 CSV（避免 meta 里写死的 cdn.jsdelivr 再次被墙）。
 */

const REPO = "xuefeng0324/realty";

/** static 根的候选镜像（大陆友好优先）。用户可在设置里用 realty:cdnBase 覆盖。 */
export function getStaticBases(): string[] {
  const u = (typeof uni !== "undefined" ? uni : undefined) as any;
  const custom = u?.getStorageSync
    ? String(u.getStorageSync("realty:cdnBase") || "").trim()
    : "";
  const bases = [
    `https://gcore.jsdelivr.net/gh/${REPO}@main/realty_app/static`,
    `https://fastly.jsdelivr.net/gh/${REPO}@main/realty_app/static`,
    `https://cdn.jsdelivr.net/gh/${REPO}@main/realty_app/static`,
    `https://jsdelivr.b-cdn.net/gh/${REPO}@main/realty_app/static`,
    `https://raw.githubusercontent.com/${REPO}/main/realty_app/static`
  ];
  return custom ? [custom.replace(/\/+$/, ""), ...bases] : bases;
}

/** 用 uni.request 拉文本（h5/app-plus/小程序通用）；返回字符串或 null。 */
export function downloadText(url: string, timeoutMs = 15000): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (v: string | null) => {
      if (!resolved) {
        resolved = true;
        resolve(v);
      }
    };

    const u = (typeof uni !== "undefined" ? uni : undefined) as any;
    if (u && typeof u.request === "function") {
      u.request({
        url,
        method: "GET",
        timeout: timeoutMs,
        success: (res: any) => {
          if (res.statusCode === 200 && typeof res.data === "string") {
            finish(res.data);
          } else if (res.statusCode === 200 && res.data != null) {
            // 某些平台把 json 自动 parse 成对象，这里转回字符串
            try {
              finish(JSON.stringify(res.data));
            } catch {
              finish(null);
            }
          } else {
            finish(null);
          }
        },
        fail: () => finish(null)
      });
      return;
    }
    if (typeof fetch === "function") {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      fetch(url, { signal: ctl.signal })
        .then((r) => r.text())
        .then((txt) => {
          clearTimeout(t);
          finish(txt);
        })
        .catch(() => {
          clearTimeout(t);
          finish(null);
        });
      return;
    }
    finish(null);
  });
}

export interface MirrorFetch {
  text: string;
  base: string;
}

/**
 * 依次尝试各镜像拉取 relPath（如 "seed/crawl_meta.json" / "wangqian_meta.json"），
 * 命中且通过 validate 即返回 { text, base }；全失败返回 null。
 */
export async function fetchFromMirrors(
  relPath: string,
  timeoutMs = 12000,
  validate?: (t: string) => boolean
): Promise<MirrorFetch | null> {
  const rel = relPath.replace(/^\/+/, "");
  for (const base of getStaticBases()) {
    const text = await downloadText(`${base}/${rel}`, timeoutMs);
    if (text && text.length > 0 && (!validate || validate(text))) {
      return { text, base };
    }
  }
  return null;
}
