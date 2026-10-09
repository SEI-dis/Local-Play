# Web版の公開に向けた確認記録 — 2026-10-09

対象はこの `web/`、検査CIとGitHub Pages用テンプレート、Web-emuの公開対象Git履歴です。
ManicEMUの元のiOSリポジトリ全体やその履歴は取り込んでいません。
配布ファイルの一覧とハッシュは RELEASE_CONTENT.json、確認結果は RELEASE_REVIEW.json に記録しています。
これはコード・配布物の確認であり、あらゆる国の法的紛争が絶対に起きないという保証ではありません。

## 本家UIの移植とAGPL

本家のメニュー・設定のコードは、AGPLの条件に従って利用できます。クレジットだけでは足りません。
AGPL 4・5・6・13条に合わせ、著作権・無保証・ライセンス表示、変更日と変更内容、
改変後の編集可能なソース、対応コアのソース・ビルド手順を同じサイトから無料で取得できるようにしています。
設定→「クレジット・ライセンス」から取得できます。改変WebコードはAGPL-3.0-or-laterで提供します。
購入制限、秘密保持、改変禁止などAGPLに追加の制限を課しません。

ライセンス画面にはManicEMU本家、mGBA本家、64MiBフォーク、Web接続部、各コア、
通信処理、PDF.jsなどの作者・プロジェクト名とGitHubリンクを明示しています。
採用した固定版へのリンクと、同じサイトから取得できる対応ソースを掲載しています。
作者のGitHubページへのリンクだけを、通知保持や対応ソース提供の代替とは扱いません。

ManicEMUのゲームメニュー、手動／自動ステート一覧、編集→削除確認、一般／詳細／サポート／その他の
設定構成を移植しました。移植元の正確なSwiftファイルは sources/manicemu-ui/ に残しています。
ゲームメニューの項目順と上部ショートカットは GameOption / GameOptionsView、共通の行と
ナビゲーションは ASListPage / ASListItemView / ASNavigationView に基づいています。
これらの原本は固定コミットの内容と一致し、個別の著作権表示を保持しています。
UIKitをブラウザ用DOMへ、RealmをIndexedDBへ置き換え、Web版では購入機能やiCloud連携などを省きました。

## 以前の確認事項と対応

| 項目 | 今回の処置 | 証拠 |
| --- | --- | --- |
| 既成WASMと対応ソースが不明確 | FC/SFC/MDを固定バージョンのソースとWeb用のlibretro接続部からビルド。mGBAを含め同梱するソースだけで再ビルドし、JS/WASM全8ファイルのSHA-256一致を確認 | sources/build-evidence.json、各BUILD.md |
| 非商用コアとGPLコードとの組み合わせ | Snes9xとGenesis Plus GXを配布から除外。SFCはMesen-S、MDはClownMDEmuに置換。EmulatorJS・RetroArchフロントエンドも除外 | SOURCES.json、licenses/、ソースアーカイブ |
| 本家画像・ロゴ等の権利 | メニュー・設定のAGPLコードは保持し、ロゴ・純正スキン画像・ゲーム機ロゴを配布しない。標準スキン4色と幾何学アイコンは新規作成。フォントはOS標準のみ | src/skin-art.js、src/skins.js、src/shared.js、assets/、NOTICES.md |
| 元ソースに含まれる画像・フォント・テストROM | Webビルドの依存ファイルと必要なビルド定義、ライセンスだけを選別。アーカイブ内部までROM形式・署名・危険パス・未登録変更を検査 | scripts/audit-content.py、RELEASE_CONTENT.json |

## コア・依存物の扱い

- mGBAとWeb bridge: MPL-2.0のファイル単位ソース公開・通知を維持。inihとEmscriptenの通知も同梱。
- FCEUmm: GPL-2.0-or-laterからGPL-3.0を選択。Mesen-S: GPL-3.0-or-later。
  LGPL-2.1-or-laterの音声・フィルター部分はLGPL 3条に従いGPL-3.0との構成に使用。
  改変して再ビルドできる対応ソースを提供。ClownMDEmu: AGPL-3.0。
- GPLv3/AGPLv3はそれぞれ13条の結合規定に従い、GPL部分の元の通知を消さず提供。
  Mesen-S内部にあるRetroArch由来のGPLフィルターも、その通知を維持。
- BSD/MIT/zlib/Apache/LLVM exception等は licenses/ と元ソースコメントに全文・帰属を保持。
  PDF.jsのApacheライセンスに基づくブラウザ用ファイル、固定バージョン情報、ライブラリソースを提供。
  コアやPDF.jsの更新時はこの確認をやり直す必要があります。

## スキン・ROM・通信

Deltaのファイル形式を読む機能と、他人のスキンを再配布する権利は別です。
スキンを同梱・プロキシ配布せず、利用者が選んだローカルファイルのみ端末で処理します。
作者ごとの利用条件が適用され、公式サイトで紹介されていても、再配布が許可されているとは限りません。
ROM、BIOS、セーブ、ゲーム画像、チートコード集は同梱しません。ROMやBIOSの入手先を案内しません。
所持やローカル処理だけで、任意のROMの取得・改変・利用が必ず適法になるとは表示しません。

通信プレイを始めない通常の動作では、取得先はこのサイトのアプリファイルだけです。
ユーザーファイルのアップロードAPI、分析・広告・クラウドセーブはありません。通信プレイを明示的に開始した場合だけ、
Celio中継サーバーへ接続し、32個のシリアル通信値と接続状態を送ります。ROM・セーブファイルを
送るAPIはありませんが、IPアドレスとゲームの通信内容はサーバー側へ伝わります。
liru55のMPL-2.0通信コードの改変版と原文・ライセンス・採用リビジョンを同梱しています。
既存のAGPLアプリ・GPLデバイス処理とのライセンス表示と対応ソースは維持しています。
個々のゲームで交換・対戦ができるかどうかは、ライセンスとは別に動作確認が必要です。
保存先・通信経路・HTTP送信防止と、その限界は PRIVACY_AUDIT.md に記録しています。

## 2026-10-09の公開前検査

- ROM共有のメニュー・実処理・未対応時のROMダウンロード処理を削除。古いメニュー設定でも復活しないことを確認。
- アーカイブ内も含めてROM・BIOS・第三者スキン・認証情報の候補を検査。公開対象Git履歴と現在の登録候補も検査。
- 本家参照ファイルの著作権・ライセンス・固定ハッシュ、対応ソースZIPと現在の編集可能なコードの一致を確認。
- 開発出力を除いた配布用コピーで検査し、公開工程では記録やソースZIPを自動で承認・再生成しない構成に変更。
- UIの機能別分割後にEdge全テストと対応WebKitテストを実施。結果・限界は RELEASE_VALIDATION.md に記録。

## 一次資料

- ManicEMUの[LICENSE](https://github.com/Manic-EMU/ManicEMU/blob/fbaeab79c214d5920bb51afa6f2d786fb2b12a58/LICENSE) と同梱AGPL本文
- [MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/)、[GPL/AGPLの互換性](https://www.gnu.org/licenses/license-compatibility.en.html)
- [Mesen-S](https://github.com/libretro/Mesen-S/tree/9e4fdeb9b336470bc96beb8765b2e79c86a2da1e)、[ClownMDEmu](https://github.com/Clownacy/clownmdemu-libretro/tree/d43c2708b0a31c285ce16724b6c4a2e92af07346)
- [MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)、[文化庁：著作物の利用と許諾](https://www.bunka.go.jp/chosakuken/keiyaku_manual/1_1_1.html)
- [Delta公式スキン案内](https://faq.deltaemulator.com/using-delta/controller-skins)、[PDF.js](https://mozilla.github.io/pdf.js/getting_started/)

公開時はREADMEの手順に従い、check-releaseによる検査を行ってください。
ソースを削除した配布、別の素材・コアを追加した配布はこの確認の対象外です。

## 2026年10月9日の追加

ゲーム詳細をGameInfoView / GameInfoNavigationView / GameInfoDetailView / GameInfoCoverViewから移植し、
原本と変更通知を保持しました。NDSはlibretro/desmume2015の固定ソースをEmscripten 4.0.15で
ビルドしました。採用ファイルはGPL-2.0-or-laterと保持された許容的通知に従い、GPL-3.0を選択し、
AGPLとの結合は13条に従います。コンパイラの依存ファイルとビルド定義・通知を同梱します。
詳細は sources/nds-web/BUILD.md と sources/nds-build-evidence.json に記録します。
NDSの独立再ビルド成果物と配布JS/WASMのSHA-256を今回も比較し、一致を確認しました。
check-releaseはNDSも含め、対応ソースの固定ハッシュ・再ビルド証拠・配布バイナリを検査します。

外部カバーの検索・自動取得は、画像ごとの許諾を本プロジェクトで確認できないため公開版から除去しました。
Libretro Thumbnailsの公開リポジトリやクレジットを、個別画像の包括的な利用許諾とは扱いません。
カバー変更は端末内の画像選択と保存だけです。既存の利用者データは削除しません。
この判断は外部画像取得一般を違法と認定するものではありません。

## 選択できる追加コアと更新検査

VBA-Nextは `src/types.h` の「version 2, or ... any later version」に基づきGPL-3.0を選択します。
音声部分のLGPL-2.1-or-later、libretro-commonの許容的ライセンスと個別著作権表示も残します。
melonDSはGPL-3.0-or-laterで、FreeBIOSのBSD-2-Clause全文とGilead Kutnickの著作権表記を
Webページから参照できます。AGPLのWebアダプタとの結合はGPL/AGPL第13条に従います。

jgenesisはREADMEとLICENSEに基づくGPL-3.0です。AGPLのWebラッパーを追加し、即時セーブ出力用の
変更をソース内に明記しました。依存クレートのライセンスを一覧化し、MIT・Apache-2.0・BSD・Zlib・
Unicode等の通知とソースを同梱します。選択可能な代替ライセンスは原文を維持します。
対象ファイルには非商用限定のコアを採用していません。PicoDriveはその条件のため除外しました。
デスクトップUI・素材・テスト用バイナリは配布せず、未使用の32X内蔵ファームウェア参照を除去しました。
Webラッパーが生成するMD構成は本体単体だけです。Sega CD・32X・SFCの外部コプロセッサROMは同梱しません。

追加コアのソースは `alternate-c-cores-source.tar.gz` と `jgenesis-web-source.tar.gz`、ビルド手順は
`sources/alternate-web/BUILD.md`、依存一覧は同ディレクトリの `DEPENDENCIES.json` です。
公開判定では `sources/alternate-build-evidence.json` と配布バイナリ・アーカイブのハッシュを照合します。
ソースを取得できるリンクは `licenses.html` に常設し、変更版でも維持します。

64MBコアの更新検査は固定コミットから候補を作り、ソースの変更一覧・ビルド・保存互換性を確認します。
人によるライセンス確認と配布レビューを省略せず、Actionsの成果物は検査レポートだけに限定します。
新しい作者ソースや未審査のWASMを、自動で公開することはありません。
