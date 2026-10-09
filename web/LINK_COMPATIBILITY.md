# Celio通信の互換確認

確認日: 2026-10-08。tests/link.cjsが生成する自作GBAプログラムで検査しました。

## 実装

src/room-link.jsは、liru55/mgba-celio-webのMPL-2.0通信コードを移植したものです。
部屋作成・参加、Engine.IO 4 / Socket.IOイベント、32ワードのシリアルパケット、順序番号・ACK、状態・コマンドを合わせています。
既存の64MiB対応コアへCelioDeviceを接続し、コアのバイナリやステート形式は変更していません。

UIの通常操作では接続しません。「部屋を作る」「参加」で、相手の版と同じ
celio-server.up.railway.appへWSS接続します。部屋番号は4桁で、パスワード認証はありません。

## 確認した組み合わせ

| 対象 | 固定版 |
| --- | --- |
| このWeb版のコア | onikoro334274-cell/mGBA_celio_edition 0ba86121bd92aa570d38301086d8e8f584238d62 |
| 移植元の通信コード | liru55/mgba-celio-web 58d463ebe2302e4fc70098760dcfc84ca69329db / web/link-session.js |
| 比較用の公開版 | liru55/mgba-celio-web gh-pages eb441dc2e4ddec951c70c413599ab2a0e77a739b |
| ローカル検査用サーバー | Celio-Link/Celio-Server d19ad22a0c6a11467c9234c6cacd291eb0f15dbd |

比較用ファイルは改変せず使用しました。配布アプリには比較用WASMを同梱しません。

| ファイル | SHA-256 |
| --- | --- |
| 公開版 mgba.js | f15e0fde3c66253ff3c0dc9d216710f5676dc90fdd13e5c8560a99e48d7ae810 |
| 公開版 mgba.wasm | 3f5cb4f061b29ed7dedbc4dab4c94cc55a6353fe71980963f782cd17ea612c59 |
| 公開版 link-session.js | 063e1a11aeee3ed43e5a3178f206920e8388c8c3c6a22f024daddc7980ad3d65 |

## 検査範囲

room-link.cjsとprivacy.cjsはWindows上のEdge・WebKitの両方で合格しました。
save-safety.cjsで、端末内バックアップ・正常終了時の保存・中断時の復旧・容量不足時の拒否も確認しました。

- この版が部屋を作り、公開版のコア・通信処理が参加する組み合わせ。
- 公開版側が部屋を作り、この版が参加する組み合わせ。
- 各GBA CPUがSIO経由で相手の値を受け取り、相手の色を描くこと。
- 2つの独立したブラウザ保存領域で、部屋番号UIから接続すること。
- 通信中は1倍速で、自動保存が通信前のバックアップを上書きしないこと。
- 接続を切ると通信前のCPUレジスタ・セーブ・画面を戻し、元の速度設定へ戻ること。
- 正常終了コマンドとサーバーのsessionCloseを受けた場合だけ、正常終了として扱うこと。
- バックアップの保存に失敗した場合は開始せず、破損した保存データを復元しないこと。
- 通信画面の表示・番号入力・通常プレイで自動接続しないこと。
- 送信イベント・サイズ・32ワードの形式を限定し、ユーザーファイル名などを含めないこと。

検査用のローカルサーバーは、固定版のClient・SessionManager・Sessionをそのまま使い、待ち受けを127.0.0.1の一時ポートに限定しています。
公開中継サーバーでも自作プログラムによる相互接続を確認しました。公開サービスの将来の稼働や仕様は管理できません。

実際のゲームでの交換・対戦の完了、異なるゲーム・改造版同士の互換、Windows版・iOSアプリ版・実機との接続は未検証です。
モバイル端末の実機検査は未実施です。PC版WebKitの結果だけで実機対応を保証しません。

## 再検査

Playwrightを開発用環境に用意します。ブラウザにはEdge/ChromiumまたはWebKitを使います。
検査用の依存ファイルはGit管理外のwork以下へ置きます。

1. sources/celio-server-source.tar.gzをwork/celio-serverへ展開し、その中で `npm ci --ignore-scripts --no-audit --no-fund` を実行します。
2. 同フォルダーで `node_modules/.bin/esbuild src/client.ts src/sessionManager.ts --bundle --packages=external --format=esm --platform=node --outdir=test-built` を実行します。Windowsでは `.cmd` を使用できます。
3. 比較用固定版のmgba.js・mgba.wasm・link-session.jsをGitHubの上記コミットからwork/celio-referenceへ取得し、上記ハッシュと照合します。ROM・セーブを取得する必要はありません。
4. CELIO_SERVER_ROOTとCELIO_REFERENCE_ROOTをそれぞれの絶対パスに設定し、`node web/tests/room-link.cjs` を実行します。PLAYWRIGHT_MODULEには必要ならPlaywrightのインストール先を設定します。WebKitはBROWSER_ENGINE=webkitを設定します。
5. `node web/tests/privacy.cjs` と `node web/tests/save-safety.cjs` も実行します。save-safetyはローカル開発サーバーを起動しておきます。

room-link.cjsのWebSocket転送はテスト専用のNodeプロセス内で行います。製品にプロキシAPIやアップロードAPIを追加するものではありません。
