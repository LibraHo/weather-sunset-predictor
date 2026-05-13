# WeChat Mini Program CLI

Installed tooling:

- `miniprogram-ci`: official upload and preview CLI/SDK for Mini Program CI.
- `miniprogram-automator`: JS SDK for debugging and automating Mini Programs through WeChat DevTools.
- `scripts/wechat-devtools-cli.cjs`: local wrapper around the WeChat DevTools `cli.bat`.

## Required Local Setup

Install WeChat DevTools on this Windows machine and enable:

`Settings > Security > Service Port`

For upload and preview, download the upload private key from the Mini Program admin console and configure the IP whitelist there.

## Environment Variables

```powershell
$env:WECHAT_APPID="wxYourAppId"
$env:WECHAT_PRIVATE_KEY_PATH="C:\keys\private.wxYourAppId.key"
$env:WECHAT_PROJECT_PATH="C:\path\to\your\miniprogram"
$env:WECHAT_VERSION="1.0.0"
$env:WECHAT_DESC="test upload"
$env:WECHAT_AUTO_PORT="9420"
```

If WeChat DevTools is installed in a non-standard location:

```powershell
$env:WECHAT_DEVTOOLS_CLI="C:\path\to\WeChatDevTools\cli.bat"
```

## Commands

```powershell
npm run mp:preview
npm run mp:upload
npm run mp:ci -- --help
npm run mp:devtools -- --help
npm run mp:auto
npm run mp:auto:check
```

`mp:auto` opens the project through WeChat DevTools automation mode on `ws://127.0.0.1:9420` by default. Use `mp:auto:check` after DevTools is running to verify `miniprogram-automator` can connect.

Preview writes a QR code to `miniprogram-preview-qrcode.jpg` by default. Override it with:

```powershell
$env:WECHAT_QRCODE_OUTPUT="C:\tmp\preview.jpg"
```
