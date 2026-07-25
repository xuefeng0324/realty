# 整包 APK 构建说明（v0.88+）

> 当前 `build-app-wgt.yml` 默认**只出 wgt**（免登录/零成本），OTA 升级够用。
> 本文档说明如何在需要时启用**整包 APK**自动构建：产物可下载到本地手动安装，
> 或上传到 GitHub Release 供手机扫码下载。

## 0. 平时由 CI 自动做了什么（v0.88.0+）

每次 `git push` 到 `main` 且 `realty_app/**` 有改动：

1. CI 跑 `type-check` + `npm test`（失败就不出包）
2. 编译 `npm run build:app` → 在 `dist/build/app/` 产出 wgt
3. 把 `dist/build/app/` 改名 `<versionCode>/` 后 commit 回 `static/update/`
4. 生成 `app-update.json`（含 sha256 + jsDelivr URL）并 commit
5. App 内「设置 → 检查更新」即时识别

你**不需要手动做任何事**就有 OTA。
当 OTA 失败、或者你想把 APK 装给别人的手机（没装过基础包）时，再用下方三种方案出 APK。

## 方案 A：DCloud 云端打包（推荐，10 分钟接通，零成本）

1. 注册 [DCloud 开发者中心](https://dev.dcloud.net.cn/) 并完成实名
2. 在 [应用管理](https://dev.dcloud.net.cn/app/index) 创建应用，记录 `appid`（形如 `__UNI__ABCDEFG`）
3. 把 `appid` 填进 `realty_app/src/manifest.json`（顶层 `"appid": "__UNI__XXXXXXX"`）
4. 把 `versionName` / `versionCode` 与已发版的 OTA 对齐（首次安装需要 ≥ 已发版）
5. 在 GitHub repo Settings → Secrets，新增：
   - `DCLOUD_USER`：DCloud 账号（手机号/邮箱）
   - `DCLOUD_PASSWORD`：DCloud 密码
6. 复制本目录下的 `apk-cloud-build.yml.example` 为 `apk-cloud-build.yml`
7. 推一次空 commit 或 `workflow_dispatch` 触发；产物（.apk）会上传到 GitHub Release

DCloud 云端打包**完全免费**，但同一 appid 每日有次数限制；非频繁发版足够。
该 workflow 单独命名 `apk-cloud-build.yml`，与 wgt 流水线互不干扰。

## 方案 B：本地 HBuilderX 出 APK（最快，无需 CI）

```powershell
# 1. 用 HBuilderX 打开本仓 realty_app 目录
# 2. 菜单：发行 → 原生 App - 云打包
# 3. 选择 Android，勾选"使用公共测试证书"（首次）
#    或上传自有 keystore（正式版）
# 4. 提交打包，5 分钟左右在 HBuilderX 控制台下载 APK
```

适合"现在就要装"的场景；之后每次改完代码再走一次即可。

如果想脚本化一键（HBuilderX 已安装且登录过）：

```powershell
powershell -File realty_app/scripts/build_apk.ps1 -OutDir "$env:USERPROFILE\Downloads"
```

> 该脚本只做 `npm run build:app` + 校验产物目录大小，APK 仍由 HBuilderX UI 触发；
> 完全命令行调用 DCloud 云端打包需用户二次确认（防误操作），脚本不替你点。

## 方案 C：自托管 GitHub Actions 离线打包（完全可控，配置复杂）

依赖 DCloud 提供的 **App 离线 SDK**：

- Android Studio 完整安装（GitHub Actions runner 镜像里没有）
- dcloudio/uni-app-android 模板项目（约 200 MB）
- 自行管理签名 keystore（Base64 入 GH Secrets）

CI 时间：每次构建 25–40 分钟（含 `npm ci` + gradle 编译）。
工程量：约 1 人天首次配置；后续只需触发 workflow。

### 落地步骤（v1.121.1）

1. **机器装 Android SDK**（cmdline-tools + platform-30 + build-tools 34），设 `ANDROID_HOME`
2. **注册 self-hosted runner**：`https://github.com/xuefeng0324/realty/settings/actions/runners/new`，labels 加 `realty-app`；装成 Windows 服务
3. **生成 keystore**：用 HBuilderX 自带 `keytool.exe`，alias=realty，storepass=realty123（开发用，正式请改强密码）。base64 入 GH Secrets：
   - `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASS`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASS`
4. **push main** → `apk-self-hosted.yml` 自动跑（缺 secret 时 skip，CI 仍绿）

> 当前 workflow 文件：`.github/workflows/apk-self-hosted.yml`
> 测试 keystore 路径：`C:\Users\Admin\realty-release.keystore`（不入 git）

## 当前 OTA 出包命令回顾

```bash
# 本地复现 wgt 出包（无需登录）
cd realty_app
npm ci
npm run build:app
# 产物在 dist/build/app/，可直接压缩为 .wgt 上传到 static/update/
```

## 配置文件对照

| 文件 | 作用 |
|------|------|
| `src/manifest.json` | 顶层 `appid` / `versionName` / `versionCode`（必须递增） |
| `.github/workflows/build-app-wgt.yml` | 已启用：wgt + OTA 清单自动发布 |
| `docs/BUILD_APK.md` | 本文档 |
| `static/update/app-update.json` | OTA 清单，CI 自动生成；不要手动改 |
| `static/update/<versionCode>/app.wgt` | 历史 wgt 包，App 内下载即用 |
| `scripts/build_apk.ps1` | 本地一键：编译 wgt 并打印产物信息 |
| `scripts/build_app_icons.mjs` | 零依赖（Node 22）生成 `static/app-icons/{72,96,144,192}.png`；SVG 在 `static/app-icon.svg` |

## 应用图标（v1.121.0+）

`static/app-icons/` 现在是 4 张「深蓝渐变 + amber 柱 + pin 圆点」的简约品牌图标。
本仓提供两个零依赖维护路径：

1. **重新生成 PNG**：本地 Node 22+ 直接跑

   ```powershell
   node realty_app/scripts/build_app_icons.mjs
   ```

   输出 `72/96/144/192.png`。再拷一份到 `unpackage/res/icons/`（HBuilderX 云打包读这个目录）。
2. **改主设计**：编辑 `realty_app/static/app-icon.svg`（矢量），CI 出新 PNG。
   CI 出 PNG 的步骤目前靠你本地跑脚本（见 README 末尾 v1.121.0 changelog 后续 TODO）。

> iOS / 启动屏 / 各 DPI 适配可后续再扩。当前图标先满足安卓端"基础包+OTA"主线。
