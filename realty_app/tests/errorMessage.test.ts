/**
 * errorMessage.ts 单测。
 *
 * catch 块已经从 catch(e:any) 统一迁到 catch(e) + toErrorMessage(e),
 * 这个工具被 6 个页面 / 10 处调用,值得给它单测覆盖。
 */

import { describe, it, expect } from "vitest";
import { toErrorMessage } from "../src/utils/errorMessage";

describe("toErrorMessage", () => {
  it("null / undefined 返回 fallback", () => {
    expect(toErrorMessage(null)).toBe("未知错误");
    expect(toErrorMessage(undefined)).toBe("未知错误");
  });

  it("字符串原样返回", () => {
    expect(toErrorMessage("boom")).toBe("boom");
    expect(toErrorMessage("")).toBe(""); // 空字符串不算 fallback,原样保留
  });

  it("Error 实例提取 message", () => {
    expect(toErrorMessage(new Error("kaboom"))).toBe("kaboom");
    expect(toErrorMessage(new TypeError("bad type"))).toBe("bad type");
  });

  it("对象有 message 字段时返回 message", () => {
    expect(toErrorMessage({ message: "api down" })).toBe("api down");
  });

  it("uni-app request fail 的 {errMsg} 形态走 errMsg", () => {
    expect(toErrorMessage({ errMsg: "request:fail timeout" })).toBe(
      "request:fail timeout"
    );
  });

  it("message 优先于 errMsg", () => {
    expect(toErrorMessage({ message: "from message", errMsg: "from errMsg" })).toBe(
      "from message"
    );
  });

  it("空字符串 message / errMsg 退化到下一个字段", () => {
    expect(toErrorMessage({ message: "", errMsg: "from errMsg" })).toBe(
      "from errMsg"
    );
    expect(toErrorMessage({ message: "real", errMsg: "" })).toBe("real");
  });

  it("自定义 fallback 参数生效", () => {
    expect(toErrorMessage(null, "网络异常")).toBe("网络异常");
    expect(toErrorMessage(undefined, "操作失败")).toBe("操作失败");
  });

  it("裸对象无 message/errMsg 时退化到 String(e)", () => {
    // String({foo:1}) === '[object Object]',至少不是抛错
    expect(toErrorMessage({ foo: 1 })).toBe("[object Object]");
  });

  it("数字 / 布尔走 String() 分支", () => {
    expect(toErrorMessage(42)).toBe("42");
    expect(toErrorMessage(false)).toBe("false");
  });
});