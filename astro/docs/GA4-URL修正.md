# GA4 URL付き訪問の最小修正（ローカル準備）

この文書は2026年10月3日の修正時点の履歴です。2026年10月4日の同意UI・説明ページを含む最終仕様はGA4設定.mdと検証結果.mdを参照してください。

PR #2の初回版はquery/hash付き訪問をタグ起動条件から除外し、UTM付き流入やアンカーへの直リンクを丸ごと計測できませんでした。今回の修正では訪問の除外を取り除き、Googleタグが生queryを自動取得しないよう、タグ読込前にURLを正規化します。

修正前のローカルcommitは `d27f55eb70392d43875d482e2d5d84eae4b891fd`。GitHub APIで同一treeを公開したPR #2のcommitは `cf9f0b57d40aeff633ef3d54be3fe6d8e1cd6d7a` です。この追加修正はローカルのみで、PR・共有ZIPは更新していません。

## 方針と維持する動作

- 初回configを1回だけ実行し `send_page_view: true` を維持します。手動page_viewは追加しません。固定のpage_location/title、空のpage_referrer、Google Signals/広告パーソナライズOFFも維持します。
- DOMContentLoaded後、queryを全除去。fragmentはDOMに実在する要素IDの場合だけ保持します。pathとhistory.stateをそのまま残し、replaceStateで履歴を増やさず・reloadせず正規化します。既存の静的DOMとmain.jsにquery依存処理がないことを調査済みです。
- UTM、広告クリックID、未知query、未知fragmentはGoogleタグから見えるURLに残しません。許可値の業務ルールは未確定なので、広告コード・キャンペーン名は作っていません。
- 正規化に失敗した例外時はタグを起動しません。理由を `__tokyoVtuberGaBlockedReason` に残し、その場合の計測欠落を明示します。

## トレードオフと残事項

訪問数の初回計測を復旧しますが、UTM・広告ID・参照元による流入分析は制限されます。queryはアドレス欄からも消えるため、再共有時のキャンペーン値は失われます。サイトに将来query機能やhashルーティングを追加する際は再設計が必要です。初回hetemlリクエストに含まれるURLやサーバーアクセスログは対象外です。

同意UI・プライバシー説明ページ・Consent Modeは今回も未実装です。拡張計測OFF、プロパティ/ストリーム、必要な同意と表示は未確認のままです。公開readyとはしていません。DNS/GWS/heteml/Analytics設定には触れていません。

## 検証方法と限界

実ブラウザで、Googleタグをローカルの観測用モックへ置換し、他の外部リクエストも遮断します。queueのconfig回数・パラメーター、モック読込時の生location、タグURLを調べます。メールのpercent/double encoding、重複query、電話番号のダミー、UTM/広告IDに機密値を混ぜたケース、既知/未知/不正encodingのfragmentを確認します。

正規化後のpath/hash、実際のアンカースクロール・クリック・戻る操作、history.state/length、navigationイベントが増えないこと、再評価で重複初期化しないことも確認します。replaceStateがthrow/無操作になる例外ケースはタグ0・理由ありを期待します。

これは公式仕様に基づくconfigとURLの検証で、実gtagのネットワークpayload・実計測・GA4レポートの確認ではありません。Googleタグの自動イベントや管理画面側の追加設定は未検証です。実計測を伴う公開後の確認は、同意・表示・ストリーム設定を確認してから別途行う必要があります。

結果は同フォルダの `GA4-URL修正検証.json` に記録します。初回版の検証ログ.jsonと検証結果.mdは以前の公開準備時点の記録です。

検証結果：Astro checkは13ファイルでerrors/warnings/hints各0。build成功、空ID/不正ID/再build同一性の3項目成功。Edge 154.0.4258.48の実ブラウザ25項目成功（4画面サイズ、17 URLケース、DOM準備前の重複実行、正規化例外2ケース、ID単一出力）。console/page errors、assets404、失敗/想定外の外部リクエストは0。初回版と比較して公開ファイルの変更はindex.htmlだけです。共有済みZIPのSHA-256も初回版から不変です。

## 公式根拠

- [page_view：configで自動送信、page_location上書き、標準値はfragmentを含まない](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [GoogleタグAPI：config/eventのスコープと優先順位](https://developers.google.com/tag-platform/gtagjs/reference)
- [設定：page_locationはdocument.location、referrerは流入算出に使う、campaign_*はUTMを上書き](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [自動イベント：first_visit/session_start/user_engagementは拡張計測と別](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [PII：URLパス・パラメーター・タイトルから機密情報を除去](https://support.google.com/analytics/answer/6366371?hl=ja)
- [replaceState：現在の履歴項目を置換し、ページをロードしない](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
