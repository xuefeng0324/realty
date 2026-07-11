/**
 * 把任意 catch 到的值收窄为可显示的字符串。
 *
 * 用法：
 *   try { ... } catch (e: unknown) {
 *     errorMsg.value = toErrorMessage(e);
 *   }
 *
 * 替代旧版 `e?.message || String(e)` 模式，让 catch 类型从 `any` 收紧到 `unknown`。
 */
export function toErrorMessage(e: unknown, fallback = "未知错误"): string {
  if (e == null) return fallback;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    // ApiError / Error / uni-app request fail 形态都覆盖
    const obj = e as { message?: unknown; errMsg?: unknown };
    if (typeof obj.message === "string" && obj.message.length > 0) return obj.message;
    if (typeof obj.errMsg === "string" && obj.errMsg.length > 0) return obj.errMsg;
  }
  try {
    return String(e);
  } catch {
    return fallback;
  }
}