# 整包 APK 构建说明（v0.88+）

> 当前 `build-app-wgt.yml` 默认**只出 wgt**（免登录/零成本），足够 OTA 升级。
> 本文档解释如何在需要时启用**整包 APK**自动构建，产物可下载到本地手动安装，
> 或上传到 GitHub Release 供手机直接下载。

## 方案 A：DCloud 云端打包（推荐，10 分钟接通）

1. 注册 [DCloud 开发者中心](https://dev.dcloud.net.cn/) 并完成实名
2. 在 [应用管理](https://dev.dcloud.net.cn/app/index) 创建应用，记录 `appid`
3. 把 `appid` 填进 `realty_app/src/manifest.json`（顶层 `"appid": "__UNI__XXXXXXX"`）
4. 升级 `realty_app/src/manifest.json` 的 `versionName` / `versionCode`
5. 在 GitHub repo Settings → Secrets，新增：
   - `DCLOUD_USER`：DCloud 账号（手机号/邮箱）
   - `DCLOUD_PASSWORD`：DCloud 密码
6. 把本目录下的 `apk-cloud-build.yml.Example` 改名为 `apk-cloud-build.yml` 启用
   - 该 workflow 调用 DCloud 云端打包 API（HTTP 401 时需重登）
7. 手动 `workflow_dispatch` 或 push 触发；产物（.apk）会上传到 GitHub Release

> DCloud 云端打包**完全免费**，但同一 appid 每日有次数限制；非频繁发版足够。

## 方案 B：本地 HBuilderX 出 APK（最快，无需 CI）

```powershell
# 1. 用 HBuilderX 打开本仓 realty_app 目录
# 2. 菜单：发行 → 原生 App-云打包
# 3. 选择 Android，勾选"使用公共测试证书"（首次）
#    或上传自有 keystore（正式版）
# 4. 提交打包，5 分钟左右在 HBuilderX 控制台下载 APK
```

适合你"现在就要装"的场景；之后每次改完代码再走一次即可。

## 方案 C：自托管 GitHub Actions 离线打包（完全可控，配置复杂）

依赖 DCloud 提供的 **App 离线 SDK**：
- Android Studio 完整安装（GitHub Actions runner 镜像里没有）
- dcloudio/uni-app-android 模板项目（约 200 MB）
- 自行管理签名 keystore（Base64 入 GH Secrets）

CI 时间：每次构建 25–40 分钟（含 npm ci + gradle 编译）。
工程量：约 1 人天首次配置；后续只需触发 workflow。

> 这条路径本仓暂不启用，等 OTA 跑通后视需要再说。

## 当前 OTA 出包命令回顾

```bash
# 本地复现 wgt 出包（无需登录）
cd realty_app
npm ci
npm run build:app
# 产物在 dist/build/app/，可直接 zip -r app.wgt . 重命名
```

## 配置文件对照

| 文件 | 作用 |
|------|------|
| `src/manifest.json` | 顶层 `appid` / `versionName` / `versionCode` / `versionCode` 必须递增 |
| `.github/workflows/build-app-wgt.yml` | 已启用：wgt + OTA 清单自动发布 |
| `docs/BUILD_APK.md` | 本文档 |
| `static/update/app-update.json` | OTA 清单，CI 自动生成；不要手动改 |
| `static/update/<versionCode>/app.wgt` | 历史 wgt 包，App 内下载即用 |