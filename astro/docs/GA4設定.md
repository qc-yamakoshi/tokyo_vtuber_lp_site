# GA4設定と公開前確認

設定は `src/config/analytics.ts` の `ga4MeasurementId` 一か所です。現在の値はユーザー提供の **G-65TGMY9D0G**。これは公開識別子で、パスワードではありません。

IDを変更したら `npm ci` → `npm run build` → `npm run release` で作り直します。空文字 `""` にすればタグはHTMLへ出力されません。FTPS転送後にhetemlの環境変数を設定しても、既存HTMLは変わりません。

## 実装の範囲

- `https://tokyo-vtuber-fudousan.com/` と `/index.html` の通常アクセスのみ計測します。localhost、プレビュー、HTTP、www、別ドメインではタグ取得・計測を開始しません。wwwはapexへ転送した後に計測します。
- プライバシー保護を優先し、**クエリまたはフラグメント付きの初回アクセスは計測しません**。UTM付きURLやアンカーへの直リンクも対象外です。通常ページ読み込み後のサイト内アンカー移動では追加page_viewを送信しません。
- Googleタグの `config` による自動page_viewだけを使い、手動page_viewは追加しません。同一ドキュメントでの初期化は1回に制限します。GTM・別のGoogleタグを重ねて埋め込まないでください。
- `page_location` は固定の公開ルート、`page_title` は固定のサイトタイトル、`page_referrer` は空にします。クエリ、入力フォーム、メールアドレス、氏名、電話番号、User-ID、カスタムイベントを送りません。Google Signals・広告パーソナライズはコードで無効にしています。
- 通常のGA4はCookie等の識別子を利用します。「個人情報を送らない」設計は、通信やCookieが存在しないことを意味しません。

## 公開前：所有者がGA4管理画面で確認すること

この作業ではアカウント作成・プロパティ設定・データ送信をしていません。

1. IDが対象サイトのWebデータストリームであること、ストリームURLが公開ドメインであることを確認します。
2. **拡張計測をOFF**にします。このLPはページ読み込みの基本計測だけを使います。履歴変更・サイト内検索・フォーム操作・外部クリックなどの自動イベントは不要で、URLや入力由来の情報を増やす可能性があります。拡張計測の履歴イベントはコードの `send_page_view` と別に動くため、管理画面側の確認が必要です。
3. Google Signals、ユーザー提供データ、広告連携、追加タグ・送信先を勝手に有効にしないでください。既存設定は所有者が確認してください。
4. プライバシー表示を公開ページから読める形で用意し、GA4利用目的・Googleへの送信・Cookie等・拒否方法・運営者連絡先を記載します。現行ページにプライバシーポリシーがないため、**公開前の残確認事項**です。運営者情報や法的文言を推測して掲載していません。
5. 対象地域と運営方針に応じて同意取得が必要か確認します。EU/英国/スイス等のアクセスや広告用途ではGoogleの同意ポリシーも確認します。**この実装には同意バナー/CMP/Consent Modeはありません**。事前同意が必要な運用なら、同意取得前にタグを読み込まない処理を追加するまでIDを空にした版を使ってください。

公開後のリアルタイム/DebugView確認は本番計測を伴うため、所有者が別途行う作業です。今回の検証はモックと通信遮断で行います。

## 公式資料

- [Astroの静的配信](https://docs.astro.build/en/guides/deploy/)
- [Astroのスクリプト](https://docs.astro.build/en/guides/client-side-scripts/)
- [Googleのpage_view仕様](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Googleの設定パラメーター](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [PII送信を避ける方法](https://support.google.com/analytics/answer/6366371?hl=ja)
- [GoogleのEUユーザー同意ポリシー](https://www.google.com/about/company/user-consent-policy/)
