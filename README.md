# Local Play

ManicEMUのUIをWebへ移植した、開発中の非公式エミュレーターです。
NDS（実験版）、GBA（最大64MiB）、GB/GBC、FC、SFC、MDに対応します。

最終更新：2026-10-09。アプリのバージョン表記は `0.3.0` です。

[ブラウザで開く](https://sei-dis.github.io/Local-Play/)。初回は更新操作なしで利用できます。

- ROM選択でゲーム詳細・設定を開き、「プレイ」で起動。ManicEMUの公開ソースを参照した画面遷移・メニュー構成。
- 端末内の画像を使ったカバー変更。外部カバーの検索・自動取得は行いません。
- 赤いボタン・チェック類を共通部品化。下部タブのグラデーションは維持。
- NDS専用スキン：縦は上下2画面＋下部の操作部、横は左に大画面＋右上にサブ画面。画面別の配置編集、タッチ操作、画面入れ替え、省電力モード。
- GB／GBC、GBA、FC、SFC、MDも専用スキンに対応。機種標準＋4色、縦横別の配置、画面／ボタンの移動・サイズ変更、重ね表示と透明度、グリッド・吸着・中央／左右対称の配置補助。ゲーム別／機種共通で保存。
- `save` / `load`、手動ステートの追加、自動ステートとゲーム内セーブの履歴を各5回分保持。
- Delta／Manicスキンの端末内取り込み。複数画面、切り抜き、表示効果、クイック操作、NDSタッチに対応。効果の近似や未対応の操作は [対応範囲](web/SKIN_COMPATIBILITY.md) を参照。
- 保存件数で伸縮しないステート一覧と、設定の補助ページから設定画面へ戻る導線。
- 1〜5倍速、倍速中の音程維持（初期状態でオン）、輪郭補正2倍／4倍。
- GBA通信のWi-Fiボタンと、ゲームを操作しながら使える移動可能な通信パネル。
- 全対応機種でコアを選択可能。セーブ・ステートはコアごとに保持し、64MiB GBA ROMはmGBA Celioを使用。

iPhoneを優先して調整していますが、確認済みなのは主にPC版Edge・WebKitと自作テストプログラムです。
iPhone実機の性能・発熱、市販ゲームの互換性、実際の交換・対戦は未検証です。

- 使い方・対応形式・制限・開発手順: [`web/README.md`](web/README.md)
- 移植元とWeb実装の対応: [`web/sources/manicemu-ui/README.md`](web/sources/manicemu-ui/README.md)
- ライセンス・帰属: [`web/NOTICES.md`](web/NOTICES.md)、[`web/LICENSE_AUDIT.md`](web/LICENSE_AUDIT.md)
- 通信互換の検査: [`web/LINK_COMPATIBILITY.md`](web/LINK_COMPATIBILITY.md)
- コア更新候補のビルド・検査: [`web/CORE_UPDATES.md`](web/CORE_UPDATES.md)

## 起動

Node.jsを用意し、リポジトリのルートで実行します。通常の起動に `npm install` やコアの再ビルドは不要です。

```sh
node web/scripts/serve.cjs
```

ブラウザで `http://127.0.0.1:4173/` を開きます。開発サーバーはこのPC内からのみ接続できます。
Python 3は配布ソースZIPの生成や一部の検査で使用します。

変更後の生成ファイル更新手順は [`web/README.md`](web/README.md) を参照してください。
初回は公開版を読み込みます。準備済みの更新は、全タブがライブラリか設定の一覧に戻り、保存や取り込みが終わると自動で反映します。
プレイ中・通信中・編集中や、状態を確認できないタブがある場合は待機します。全タブを閉じた後にも切り替わります。
すぐ反映したい場合はゲームを保存・終了後に「設定 → アプリの更新」を開き、
その画面以外のアプリのタブを閉じて「更新」を押します。サイトデータは削除しないでください。

## データの扱い

ROM・BIOS・セーブ・ステートをこのリポジトリへ登録しないでください。ユーザーデータは利用端末のIndexedDBへ保存します。アップロード用APIはありません。

通信プレイを明示的に開始すると、Celio中継サーバーへゲームのケーブル通信データを送ります。ROM・セーブファイルは送りませんが、プレイヤー情報や交換内容が通信に含まれる場合があります。
ROMファイルの共有・書き出し機能はありません。セーブデータの書き出しには対応しています。
カバー画像は端末内で選択・保存します。外部の画像サービスへ接続しません。

## 公開

公開・更新・停止の手順は [`deployment/README.md`](deployment/README.md) にまとめています。
GitHub Pages用ワークフローは [`.github/workflows/web-pages.yml`](.github/workflows/web-pages.yml) です。
PagesのSourceをGitHub Actionsに設定し、同じコミットのCI成功後に「Publish Local Play」を手動実行します。
pushは検査だけを行い、公開を自動実行しません。

2026-10-09に配布物・対応ソース・帰属表示・データ保護を再確認しました。根拠は
[`web/RELEASE_VALIDATION.md`](web/RELEASE_VALIDATION.md) と `web/RELEASE_REVIEW.json` に記録しています。
GitHubのCIはテストと配布検査を行い、サイトを公開しません。変更時は確認記録も更新してください。

改変Web UIはAGPL-3.0-or-laterです。コア・ライブラリ・移植部分にはそれぞれのライセンスが適用されます。公開時は `web/licenses/` と `web/sources/`、帰属・変更表示を保持してください。
