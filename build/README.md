# build —— 打包与构建配置

存放应用打包相关的配置与资源。

## 内容规划

- electron-builder 配置（也可放在 `package.json` 的 `build` 字段）。
- 应用图标（`.ico`）。
- Windows manifest：声明 `requireAdministrator`，使应用启动时弹出 UAC 提权框。
- 代码签名相关配置（证书本身**不入库**，通过安全方式注入）。
