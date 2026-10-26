/**
 * 周口径统一入口：把任意日期映射到它所属的「周」。
 *
 * 约定（整个 App 统一，Mon~Sun，以周日作为 week_end）：
 *   - 统计窗口 computeWeekWindow(weekEnd) = [weekEnd-6, weekEnd]，即周一~周日
 *   - wangqian_district_weekly.csv 的 week_end 也是周日
 *   - rulesSnapshot.test.ts 明确断言 weekStart = weekEnd - 6
 *
 * 所以 weekEndFromDate 必须返回「当天或之后最近的周日」。
 *
 * 历史 bug（v1.122.54 修）：以前实现是「回溯到上一个周日」，
 * 于是周二抓到的房源（crawl_date=2026-10-13）会被归到 week_end=2026-10-11，
 * 而 2026-10-11 的统计窗口是 [10-05, 10-11]——房源落在窗口外，
 * 结果只有周日当天抓的数据能进周榜，周一~周六抓的全部隐身，
 * 广州（只在周二抓）的小区排行长期为 0 行。
 */

/** 返回当天或之后最近的周日（YYYY-MM-DD）。 */
export function weekEndFromDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  // 周日→自己；周一~周六→往后到本周周日
  const delta = day === 0 ? 0 : 7 - day;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
