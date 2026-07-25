# 東京VTuber不動産 忠実再現版

参照画像のPC/スマホ構成を基準に、HTML/CSSとAstroで再構築したLPです。

- `html/index.html`: 静的HTML版
- `astro/`: Astro版
- `assets/images/`: 参照画像から切り出した仮素材。正式なキャラクター・写真素材へ差し替えてください。

## Astro起動
```bash
cd astro
npm install
npm run dev
```


## Google予約・お問い合わせの埋め込み

以下の2つのプレースホルダー文字列を実際の埋め込みURLに置き換えてください。

- `PASTE_GOOGLE_CALENDAR_BOOKING_EMBED_URL_HERE`
- `PASTE_GOOGLE_FORM_EMBED_URL_HERE`

HTML版は `html/index.html`、Astro版は `astro/src/components/LandingPage.astro` にあります。

## キャラクターの追加

- HTML版: `html/index.html` の `article.character-card` を複製します。
- Astro版: `astro/src/components/LandingPage.astro` 冒頭の `characters` 配列へオブジェクトを追加します。
- 一覧は人数に応じて自動で1〜2列へ変わり、スマートフォンでは1列表示になります。


## 予約・お問い合わせ機能の表示切替

### Astro版
`astro/src/pages/index.astro`の先頭にある次の2項目へURLを入力します。空欄の場合は、予約・お問い合わせセクションに「Coming Soon」が表示されます。URLを入力すると自動で埋め込み表示へ切り替わります。

```js
const bookingUrl = ""; // Googleカレンダー予約ページの埋め込みURL
const inquiryUrl = ""; // Googleフォームの埋め込みURL
```

### HTML版
`html/index.html`の`body`タグへURLを入力します。

```html
<body data-booking-url="" data-inquiry-url="">
```

## URL設定（Astro版）

`astro/src/config/site.ts`だけを編集します。

```ts
export const siteConfig = {
  bookingUrl: "",
  inquiryUrl: "",
  xUrl: "x.com/アカウント名",
  youtubeUrl: "youtube.com/@チャンネル名",
  instagramUrl: "",
};
```

`https://`は省略可能です。空欄の項目は表示されません。
