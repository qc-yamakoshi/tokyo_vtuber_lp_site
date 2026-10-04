# 東京VTuber不動産：Astro版

公開元はこの astro フォルダです。リポジトリ直下の html は別版なので混ぜません。

## ビルド環境

Astro 7.3.5。Nodeは22.12.0以上の対応する偶数版が必要です。検証・推奨環境は **Node 24.18.0 / npm 11.16.0**（.nvmrcとpackageManagerに記録）。hetemlにはNode/npmは不要です。PCの既存Nodeが20系なら、そのままでは今回のAstroを実行できません。

依存はpackage.jsonとpackage-lock.jsonをセットで維持します。latestや^での無制限な更新は避け、更新時に互換性を確認します。TypeScriptは@astrojs/checkの対応範囲に合わせて6.0.3を使用し、未対応の7系は採用していません。

PowerShellの例：

~~~powershell
$env:ASTRO_TELEMETRY_DISABLED = "1"
npm ci
npm run check
npm run build
npm run test:build
npm run test:browser
npm run release
~~~

npm ciはlockfileどおりの依存をインストールします。npm run checkは型・Astro診断です。既存lint設定はありません。test:buildは空ID/不正ID/再ビルド同一性を確認し、一時変更した測定IDを必ず戻します。test:browserは実ブラウザとlocalhostプレビューで表示・リンク・GA4を検証します。全Analytics通信をモックまたは遮断し、Googleへ実データを送りません。Edge/Chromeがない場合はPlaywrightのブラウザを別途用意し、BROWSER_EXECUTABLEにそのパスを設定できます。

ローカルプレビュー：

~~~powershell
$env:ASTRO_TELEMETRY_DISABLED = "1"
npm run preview -- --host 127.0.0.1
~~~

画面だけ確認する場合、localhostではGA4タグの取得・計測は始まりません。公開HTTPSのLPでも、訪問者が許可するまではタグを読み込みません。拒否・閉じるだけでは解析しません。左下の設定ボタンから変更・撤回できます。UTM・query・アンカー付き訪問も許可後に一度計測しますが、UTM/参照元の流入分析は制限されています。日本語の説明ページは `/analytics/`、設定と制約はdocs/GA4設定.mdを確認してください。

## 公開パッケージ

npm run releaseはbuild後にreleases/heteml-日時/を作ります。upload内は公開用ファイルだけです。CNAME、ソース、Git、環境変数、依存・説明資料は公開対象から外します。資料はuploadと同階層です。ZIPを作る場合はこのreleaseフォルダの中身をまとめ、展開後はuploadの中身だけをFTPSで /vtuber_fudousan 直下へ置きます。

- docs/配置手順.md：10月4日JSTの配置・SSL・www転送・メール/DNS保護
- docs/GA4設定.md：測定ID一か所設定、拡張計測OFF、PII対策、同意/プライバシーの残確認
- docs/検証結果.md：更新前後のバージョン、回帰検証、残る監査指摘

ユーザーの承認範囲は作業ブランチとdraft PRの更新までです。mainへのmerge、heteml転送、DNS、Google Workspace、Analyticsアカウント設定は行いません。既存workflowはmain pushでGitHub Pagesを配信するため、作業ブランチ公開とmain mergeは別です。移行後のprivate化も別作業です。
