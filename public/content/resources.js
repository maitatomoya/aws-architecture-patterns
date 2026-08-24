// 参考資料リスト：AWS公式のパターン集・設計資料へのリンク集
// 掲載URLは追加時にHTTP 200を確認すること（品質ルール）
registerResources({
  tocTitle: "参考資料リスト",
  content: `<h2>参考資料リスト：公式のパターン集と設計資料</h2>
<p>この教材の50ケースは入口にすぎません。実際の設計では、AWSが公式に公開している
パターン集・リファレンスアーキテクチャを引ける力が武器になります。ここでは
「次にどこを見ればよいか」を用途別に整理します。<strong>すべてAWS公式（または公式運営）の資料</strong>です。</p>

<h3>パターン・構成図を探す</h3>
<table>
<tr><th>資料</th><th>内容</th><th>こういうときに見る</th></tr>
<tr>
<td><a href="https://aws.amazon.com/jp/architecture/" target="_blank" rel="noopener noreferrer">AWSアーキテクチャセンター</a></td>
<td>公式の総合ハブ。リファレンスアーキテクチャ・ベストプラクティス・事例動画がここに集約されている</td>
<td>まず最初にブックマークする場所。迷ったらここから辿る</td>
</tr>
<tr>
<td><a href="https://aws.amazon.com/jp/architecture/reference-architecture-diagrams/" target="_blank" rel="noopener noreferrer">リファレンスアーキテクチャ図</a></td>
<td>公式の構成図集（350件超）。業種（小売・金融・ゲーム・製造など）×技術カテゴリで絞り込める。PDFの構成図＋解説つき</td>
<td>「この業種・このユースケースの定石構成が知りたい」とき。この教材のケースと同じ粒度</td>
</tr>
<tr>
<td><a href="https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/welcome.html" target="_blank" rel="noopener noreferrer">AWS規範ガイダンスのPatterns</a></td>
<td>その名も「パターン」のカタログ（500件超）。移行・モダナイゼーション・最適化の実装手順が構成図・コードつきで載っている</td>
<td>設計が決まったあと「実際にどう作るか・どう移行するか」の手順が欲しいとき</td>
</tr>
<tr>
<td><a href="https://serverlessland.com/patterns" target="_blank" rel="noopener noreferrer">Serverless Land Patterns</a></td>
<td>AWSサーバーレスチーム運営のパターン集（数百件）。「API Gateway→SQS→Lambda」のようなサービス間連携が、SAM/CDK/TerraformのIaCテンプレートつきで載っている</td>
<td>サーバーレスの部品の組み合わせ方と、その実装コードが欲しいとき</td>
</tr>
<tr>
<td><a href="https://aws.amazon.com/jp/solutions/" target="_blank" rel="noopener noreferrer">AWSソリューションライブラリ</a></td>
<td>ユースケース別・業種別の「Guidance」集。構成図に加えて費用の試算とデプロイ可能なコードがセットになっている</td>
<td>構成の費用感の裏取りや、検証環境をすぐ立ち上げたいとき</td>
</tr>
</table>

<h3>設計の考え方を深める</h3>
<table>
<tr><th>資料</th><th>内容</th><th>こういうときに見る</th></tr>
<tr>
<td><a href="https://aws.amazon.com/jp/architecture/well-architected/" target="_blank" rel="noopener noreferrer">AWS Well-Architected Framework</a></td>
<td>公式の設計原則集。運用・セキュリティ・信頼性・パフォーマンス・コスト・持続可能性の6本柱で構成を評価する</td>
<td>作った構成をレビューする物差しが欲しいとき。この教材の「選定3軸」の完全版にあたる</td>
</tr>
<tr>
<td><a href="https://docs.aws.amazon.com/wellarchitected/latest/userguide/lenses.html" target="_blank" rel="noopener noreferrer">Well-Architectedレンズ</a></td>
<td>分野特化版のWell-Architected。サーバーレス・SaaS・ゲーム・生成AI・IoTなど、分野ごとのベストプラクティスと参照アーキテクチャ</td>
<td>特定分野（例：ゲームバックエンド、SaaSマルチテナント）を深掘りするとき</td>
</tr>
<tr>
<td><a href="https://aws.amazon.com/jp/whitepapers/" target="_blank" rel="noopener noreferrer">AWSホワイトペーパー</a></td>
<td>公式の技術文書集。WordPressベストプラクティス、SaaSテナント分離、災害対策（DR）など定番テーマの決定版資料</td>
<td>1つのテーマを体系的に学びたいとき。本教材の各ケースの参考文献にも多数登場している</td>
</tr>
<tr>
<td><a href="https://aws.amazon.com/jp/blogs/architecture/" target="_blank" rel="noopener noreferrer">AWSアーキテクチャブログ</a></td>
<td>実際の顧客事例や新しい設計パターンの解説記事。「This is My Architecture」という実例紹介シリーズもここから辿れる</td>
<td>最新のパターンや実例を継続的に追いたいとき</td>
</tr>
</table>

<h3>構成図を描く</h3>
<table>
<tr><th>資料</th><th>内容</th><th>こういうときに見る</th></tr>
<tr>
<td><a href="https://aws.amazon.com/jp/architecture/icons/" target="_blank" rel="noopener noreferrer">AWSアーキテクチャアイコン</a></td>
<td>公式のアイコン素材集。PowerPoint・draw.io等の素材と、枠線の色や描き方のガイドラインが配布されている。この教材の構成図もこの素材とルールで描いている</td>
<td>自分で構成図を描くとき。チームの図の描き方を揃えたいとき</td>
</tr>
</table>

<div class="intro-note">
<p><strong>使い方のこつ</strong>：資料の量に圧倒される必要はありません。実務では
「①アーキテクチャセンターで近い構成図を探す→②Well-Architectedの観点で自分の要件に合わせて調整する→
③規範ガイダンスやSolutions Libraryで実装の具体を確認する」という順で引くと迷いません。
この教材で「枠の意味」と「選定の軸」を身につけていれば、公式資料はぐっと読みやすくなっているはずです。</p>
</div>

<p class="resources-checked">掲載リンクは2026年8月24日時点で全件アクセス確認済みです。</p>`
});
