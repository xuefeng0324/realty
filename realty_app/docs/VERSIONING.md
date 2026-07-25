# 版本号规范（VERSIONING）

> 唯一真相：**App 对外版本** = `versionName` + `versionCode`。  
> 禁止口头「随便加一下」；发版必须用脚本或严格按本表手改，并写进 README / changelog。

## 两套号，别混

| 字段 | 形态 | 用途 | 文件 |
|------|------|------|------|
| **versionName** | SemVer `MAJOR.MINOR.PATCH`（如 `1.121.6`） | 给人看；关于页 / OTA 文案 | `src/manifest.json`、`src/config.ts` → `APP_VERSION`、OTA `app-update.json` |
| **versionCode** | **正整数**，只增不减（如 `127`） | 机器比新旧；OTA / 应用商店升级判断 | 同上 + 离线 `build.gradle`（打整包时） |
| `package.json` → `version` | 与 **versionName 同步** | npm 元数据，**不是**另一套产品版本 | `package.json` |

历史债：早期 README / `package.json` 用过 `0.x`，App 后来走到 `1.x`。  
**自本规范生效起**：以 `src/manifest.json` 的 `versionName` / `versionCode` 为准；`package.json` 由 bump 脚本对齐。

## 什么时候必须 bump

| 场景 | 要不要 bump | 建议档位 |
|------|-------------|----------|
| 出整包 APK（含启动页/原生层） | **必须** | 视改动选 major/minor/patch，**versionCode 必 +1** |
| 出 OTA wgt / 改业务 JS·页面 | **必须** | 通常 `patch`；功能面大用 `minor` |
| 仅文档 / CI / 脚本 / changelog | **不要** | — |
| 「为了让用户能点到检查更新」的验证包 | **必须** | `patch` + versionCode +1（禁止为验证乱跳 MINOR） |

## 档位怎么加（versionName）

遵循 SemVer，**每次发版只动一档**：

| 命令 / 档位 | versionName 变化 | 典型场景 |
|-------------|------------------|----------|
| `major` | `X+1.0.0` | 协议/包名/数据模型不兼容、大改版 |
| `minor` | `X.Y+1.0` | 新功能、用户可感知的能力（新页、新榜、新模块） |
| `patch` | `X.Y.Z+1` | Bug 修复、OTA/CDN、启动页文案、小优化 |

**铁律：**

1. 任意发版（APK 或 wgt）→ **`versionCode` 一律 +1**，与档位无关。  
2. `versionCode` **禁止回退、禁止复用**；OTA 只认它比大小。  
3. `versionName` 与 `versionCode` **同一次提交一起改**，禁止只改其中一个。  
4. README 版本表 **只新增一行**，禁止改历史行。  
5. changelog：`changelog/YYYY-MM-DD-vX.Y.Z-标题.md`。

## 推荐流程（强制脚本）

```powershell
cd realty_app
# 先看当前与将变成什么
node scripts/bump-version.mjs patch --dry-run

# 真正改文件（manifest / config / package.json）
node scripts/bump-version.mjs patch
# 或：node scripts/bump-version.mjs minor
# 或：node scripts/bump-version.mjs major
```

脚本会：

- 读 `src/manifest.json` 当前 `versionName` / `versionCode`
- 按档位算新 `versionName`，`versionCode = 旧值 + 1`
- 写回 `manifest.json`、`config.ts` 的 `APP_VERSION`、`package.json` 的 `version`
- 打印下一步：补 README 行、写 changelog、再构建 / 提交

打离线 APK 时，把同一对 `versionName` / `versionCode` 写进 `HBuilder-Integrate-AS/simpleDemo/build.gradle`（脚本可加 `--gradle` 路径，见脚本帮助）。

## 禁止事项（踩过的坑）

- ❌ 同一天 `1.121.0` → `1.121.1` → … → `1.121.6` 为「试 OTA」连跳，却不写规则  
- ❌ 只升 `versionName` 不升 `versionCode`（手机以为没更新）  
- ❌ 整包用 `126`、清单写 `125`、口头说 `1.121.5` 三套对不上  
- ❌ 用 `package.json` 的 `0.87.0` 当 App 版本对外宣传  
- ❌ AI / 人工「随便 +1」而不跑 bump 脚本、不写 README

## 与提交规范的关系

见 [README.md · 提交规范](../README.md#提交规范)。发版类改动在 type-check / test 之外，**还必须**：

1. `node scripts/bump-version.mjs <major|minor|patch>`  
2. README 版本表新增一行  
3. 新增 changelog 文件  
4. 若发 OTA：更新 / 由 CI 生成 `static/update/app-update.json` 与 `static/update/<versionCode>/app.wgt`

---

最后更新：2026-07-25（针对 OTA / 整包版本混乱补齐）
