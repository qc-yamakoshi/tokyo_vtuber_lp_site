# GA4設定と公開前確認（2026年10月4日・同意対応版）

設定は `src/config/analytics.ts` の `ga4MeasurementId` 一か所です。受領IDは **G-65TGMY9D0G**。IDは公開識別子で、パスワードではありません。
変更後は `npm ci` → `npm run check` → `npm run build` → `npm run test:build` → `npm run test:browser` → `npm run release` で再生成します。空文字にするとGoogleタグを読み込みません。hetemlの環境変数だけでは既存の静的HTMLは変わりません。

## 同意と停止

- basic opt-inです。未選択・拒否・パネルを閉じただけの状態ではGoogleタグも解析通信も開始しません。拒否でサイト機能を制限しません。
- 許可/拒否は同じ見た目・大きさのボタンです。画面左下の「アクセス解析の設定」から再開・変更できます。日本語の説明ページは `/analytics/`。キーボードのTab/Enter/Escapeとフォーカスの復帰にも対応します。
- 選択は `tokyo-vtuber-analytics-consent-v1` に `{v:1,choice}` だけ保存します。許可・拒否を再訪時に読み、未指定/壊れた値/別versionは未選択扱いです。localStorageを読めない/書けない場合、選択はページ内だけで、次の読み込みは未同意から始まります。
- 許可時だけqueueとGoogleタグを初期化し、analytics_storageはgranted、広告関連3項目はdeniedにします。拒否状態のGoogleタグを残してcookieless pingを送るadvanced方式ではありません。
- 撤回時は公式の `ga-disable-測定ID` を直ちにtrueにし、このサイトの `_ga` と `_ga_測定ID由来の識別子` をroot pathのhost/apex-domain両方で削除して再読み込みします。scriptを外すだけではタイマーを止められないためです。無関係のCookieは削除しません。別タブでの拒否/選択削除も反映します。
- 撤回は今後の解析を止める操作です。すでに送信済みの情報や撤回以前に開始した通信を取り消すものではありません。Cookie削除は当タグの指定domain/pathのJS Cookieが対象です。

## 計測範囲・URL・流入分析の制限

- 公開HTTPS apexの `/` と `/index.html` を、許可時に一度計測します。UTM・未知query・既知/未知anchor付きの正当な訪問も丸ごと除外しません。HTTP/www/localhost/preview/説明ページ等ではタグを読みません。wwwはapex転送後の許可状態で計測します。
- configの自動page_viewだけを使い、手動page_viewを重ねません。同じdocumentでの再許可・再実行・anchor/history操作に新しいconfigは追加しません。再読み込みした別documentは、許可保存済みなら初回一度です。
- タグを読む前にqueryを全て除去し、DOMに実在するアンカーを保持します。path・history.stateを維持し、history追加・reloadなしでURLを正規化します。現行LPはqueryを機能に使いません。
- page_location/titleは固定、page_referrerは空。氏名/メール/電話番号/入力値/User-ID/独自イベントを追加しません。UTM・広告クリックID・参照元分析は制限され、許可値やcampaign名は推測して追加していません。queryはアドレス欄や再共有URLからも消えます。サーバー初回リクエスト/アクセスログはこの処理の対象外です。
- 正規化に失敗するとタグを読み込まず、`__tokyoVtuberGaBlockedReason = url-normalization-failed` とUIに停止理由を残します。この例外時の訪問は欠落します。
- 現行サイトは静的ページでSPA routerはありません。historyでquery/anchorを変えた場合も正規化し、新しいpage_viewは追加しません。計測対象外のpathにhistoryで移動した場合は停止して再読み込みします。将来queryやSPA routingを機能に使うときは再設計が必要です。

## 所有者がGA4管理画面で確認すること

1. 測定IDが対象サイトのWebストリームであること、ストリームURLが公開apexであること。
2. **拡張計測をOFF**にすること。特に履歴変更のpage_viewはsend_page_view設定とは独立し、フォーム/検索/外部クリック等も自動イベントになるためです。この作業では管理画面を変更・確認していません。
3. Google Signals、ユーザー提供データ、広告連携、追加タグ/送信先を確認し、コード以外に重ねて送信しないこと。コードではSignals/広告パーソナライズをfalseにしています。
4. `/analytics/` の説明が運営の実態・対象地域・方針に合うこと。既存表記以外の会社名/住所/連絡先は作っていません。これはアクセス解析の説明で、事業全体のプライバシーポリシーや法令適合を保証するものではありません。

この作業ではAnalyticsアカウント作成・設定・実データ送信は行っていません。検証はタグモックと全Google通信の捕捉で行います。実Googleタグのpayload・実レポート・管理画面側設定の検証ではありません。公開後に実計測を確認する場合は、以上の設定確認を終えてから、所有者が明示的に許可して行います。

## 公式資料

- [Googleのbasic/advanced consent mode](https://support.google.com/analytics/answer/10000067)
- [Googleタグの同意設定](https://developers.google.com/tag-platform/security/guides/consent)
- [ga-disableによる停止](https://developers.google.com/tag-platform/security/guides/privacy)
- [page_viewと履歴による二重計測](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [設定パラメーター](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [GA4 Cookie](https://support.google.com/analytics/answer/11397207)
- [PII送信を避ける方法](https://support.google.com/analytics/answer/6366371?hl=ja)
