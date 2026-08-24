# AWS Architecture Patterns

「どんなサービスに、どんなAWS構成を組むか」をケーススタディ形式で学ぶ学習Webサービス。

各ケースで、要件の整理→推奨アーキテクチャ（AWS公式アイコンによる構成図）→各サービスの役割→
設計の工夫点→メリット・デメリット→代替パターン→公式ドキュメント、の流れで
「アーキテクチャを選ぶ力」を鍛える。

公開URL：https://aws-architecture-patterns.pages.dev

## 特徴

- 構成図はAWS公式のArchitecture Icons（2026年7月31日版）を使用し、枠線の色・線種も公式規定に準拠
- 図は画像ではなくJSON仕様（nodes/groups/edges）から`diagram.js`がSVGを動的生成。
  機械検証・修正がしやすい
- 依存パッケージなしの静的サイト。ビルド不要

## 起動方法

```bash
node server.js
```

http://localhost:3944 で開く。

## 構成

```
server.js              ローカル開発用の静的配信サーバー
public/
  index.html
  app.js               ケース表示UI
  diagram.js           JSON→SVG構成図レンダラー
  styles.css
  content/
    intro.js           はじめに（構成図の読み方・選定3軸）
    caseNN.js          各ケースの教材データ
  icons/               AWS公式Architecture Icons（抜粋を同梱）
    services/ groups/ resources/
```

## クレジット

構成図のアイコンは[AWSアーキテクチャアイコン](https://aws.amazon.com/jp/architecture/icons/)を使用。
