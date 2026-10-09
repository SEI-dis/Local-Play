# Delta／Manicスキンの対応範囲

2026-10-09。対応機種はGBA・GB/GBC・FC・SFC・MD・NDSです。スキンの追加で未対応機種のゲームが動くようにはなりません。

| 項目 | 対応内容 |
| --- | --- |
| 形式 | `.deltaskin`、`.manicskin`。ローカルZIP内のJSON・PNG・JPEG・WebP・1ページPDF |
| 配置 | iPhone標準／edgeToEdge、iPad標準／splitView、縦横。利用できる配置から端末と縦横比に近いものを選択 |
| 画面 | 複数の表示レイヤー、切り抜き、NDSの上下画面。splitViewのapp領域はコントローラーの上に確保 |
| ボタン | 同時押し、十字キー、ヒット領域拡張、可動スティック、NDSタッチ入力、Manicの通常／選択画像・押下アニメーション |
| ショートカット | メニュー、クイック保存・読込、ステート一覧、速度切替、長押し早送り、上下画面切替、ミュート、スキン・映像・コントローラー設定、チート、撮影、再起動、終了など |
| セーブ保護 | クイック保存・読込にも確認画面。以前の手動保存を上書きしない。複数の機能を一度に実行するボタンは無効化。通信中は従来の操作制限を維持 |
| 表示効果 | Color Controls、Gaussian Blur、Invert、Sepia、Exposure、Hue、Gamma、Color Matrix、Monochrome、Bloom、Affine Transform。Box／Disc BlurはGaussian Blurで代用 |

描画効果はCSS・SVG・Canvasによる近似です。Apple Core Imageの完全互換実装ではありません。
未対応の効果は省略して表示し、未対応の操作は実行せず、スキン設定に注意点を表示します。
CAF効果音、未対応コア専用の操作、ネイティブOS専用の操作は使用できません。
標準スキン向けの配置編集は、外部スキンの配置を変更しません。

## 容量と安全性

上限は圧縮40MiB、展開100MiB、256ファイル、96画像、24配置、1配置12画面・128ボタンです。
変換済みPNGは合計64MiB以下、画像1枚8百万画素以下です。PDFは最大辺2048pxに変換します。
巨大・破損・暗号化されたファイル、不正なパス、外部URLの画像は拒否します。
ファイル内のスクリプトは実行せず、外部画像・フォント・音声を取得しません。
ROM・セーブ・スキンのアップロードAPIはありません。

## 検証

形式テストは新規作成した画像・ROMを使用します。同梱スキンのテストには、下記の許諾を確認した素材も使用します。画像合成の画素、切り抜き、入力解除、
保存・読込の確認、速度操作、端末別配置、外部通信が発生しないことをEdgeとWebKitで確認しました。

別途、Solo Plastic GBAのBlack（Glow／No Glow）、Manic公式のGB・GBC・GBA・NES・SNES・MD、
Delta公式Standard DSの計9ファイル・52配置をローカルで描画し、表示を確認しました。
Solo PlasticとDelta DSの画像・アーカイブは同梱しません。ManicEMUの同梱対象は、別途CC BY 4.0を確認した旧公式版7機種・42配置に限定します。[素材と変更記録](sources/manic-skins/README.md)を参照してください。
実機Safariでの表示・操作は、OSや端末でも確認が必要です。

## 参照資料

- [Delta形式の説明](https://noah978.gitbook.io/delta-docs/skins)
- [Manic形式と公式スキンの案内](https://manicemu.site/guides/homemade-skins/)
- [Apple Core Image Filter Reference](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Reference/CoreImageFilterReference/index.html)

形式の互換性は、第三者のスキンを再配布する許諾ではありません。各作者の利用条件が適用されます。
