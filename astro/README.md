# 東京VTuber不動産 Astro版

## 起動方法

```powershell
npm install
npm run dev
```

ブラウザで `http://localhost:4321/` を開きます。

## 主に編集するファイル

- 文章・構成: `src/components/LandingPage.astro`
- ヘッダー・フッター: `src/pages/index.astro`
- デザイン: `src/styles/global.css`
- 画像: `public/assets/images/`

## 公開用ビルド

```powershell
npm run build
```

`dist`フォルダに公開用ファイルが生成されます。
