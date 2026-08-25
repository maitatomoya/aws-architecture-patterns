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

<h3>AWS認定試験との対応（SAA-C03）</h3>
<p>この教材は<strong>試験対策専用ではありません</strong>。合格に必要なサービス名や上限値の暗記は扱っていません。
一方で、AWS Certified Solutions Architect - Associate（SAA-C03）が問うのは
「この要件ならどのサービスを選ぶか」という判断そのものです。選択肢を丸暗記するのではなく
<strong>なぜその構成が正解になるのかという背景を理解する副教材</strong>として、この50ケースは相性がよいはずです。
以下の分野名と配点は<a href="https://d1.awsstatic.com/ja_JP/training-and-certification/docs-sa-assoc/AWS-Certified-Solutions-Architect-Associate_Exam-Guide.pdf" target="_blank" rel="noopener noreferrer">公式の試験ガイド（PDF・日本語）</a>の記載に合わせています。
試験の概要・受験方法は<a href="https://aws.amazon.com/jp/certification/certified-solutions-architect-associate/" target="_blank" rel="noopener noreferrer">AWS Certified Solutions Architect - Associate（公式）</a>を確認してください。</p>
<table>
<tr><th>試験ドメイン（配点）</th><th>この分野で問われること</th><th>背景を理解できるケース</th></tr>
<tr>
<td>第1分野：セキュアなアーキテクチャの設計（30%）</td>
<td>IAMと最小権限、パブリック／プライベートサブネットによるネットワーク分離、保管時・転送時の暗号化と鍵管理、複数アカウントにまたがる統制</td>
<td><a href="#case-9">ケース9 SaaSマルチテナント基盤</a>／<a href="#case-11">ケース11 BtoB会員制ポータル</a>／<a href="#case-32">ケース32 閉域の社内業務システム</a>／<a href="#case-36">ケース36 社外とのファイル転送基盤</a>／<a href="#case-37">ケース37 マルチアカウント統制</a>／<a href="#case-47">ケース47 セキュリティ監視・脅威検知</a>／<a href="#case-50">ケース50 秘密情報・鍵管理</a></td>
</tr>
<tr>
<td>第2分野：弾力性に優れたアーキテクチャの設計（26%）</td>
<td>スケーラブルで疎結合な構成、単一障害点の排除、マルチAZ・マルチリージョンでの冗長化、バックアップとRTO・RPOの設計</td>
<td><a href="#case-7">ケース7 スタートアップのMVP Webアプリ</a>／<a href="#case-8">ケース8 中規模ECサイト</a>／<a href="#case-15">ケース15 非同期ジョブ・キュー処理</a>／<a href="#case-19">ケース19 マイクロサービスのイベント連携</a>／<a href="#case-33">ケース33 オンプレとのハイブリッド接続</a>／<a href="#case-48">ケース48 バックアップ・アーカイブ基盤</a>／<a href="#case-49">ケース49 災害対策（DR）・マルチリージョン</a></td>
</tr>
<tr>
<td>第3分野：高パフォーマンスなアーキテクチャの設計（24%）</td>
<td>キャッシュとCDNによる高速化、読み取り分散とデータベースの選定、レイテンシーを詰めるネットワーク設計、大量データの取り込みと変換</td>
<td><a href="#case-3">ケース3 大規模ニュース・メディアサイト</a>／<a href="#case-6">ケース6 グローバル向けサイト・多地域配信</a>／<a href="#case-13">ケース13 オンラインゲームのバックエンド</a>／<a href="#case-21">ケース21 ニアリアルタイム分析基盤</a>／<a href="#case-22">ケース22 DWHとBIダッシュボード</a>／<a href="#case-25">ケース25 サイト内検索基盤</a>／<a href="#case-39">ケース39 リアルタイムチャット</a></td>
</tr>
<tr>
<td>第4分野：コストを最適化したアーキテクチャの設計（20%）</td>
<td>ストレージクラスとライフサイクルによる保管費の削減、サーバーレスやスポットインスタンスの使いどころ、スキャン量を減らすデータ設計、データ転送とNATゲートウェイの費用</td>
<td><a href="#case-1">ケース1 コーポレートサイト・LP（静的サイト）</a>／<a href="#case-4">ケース4 動画配信サービス（VOD）</a>／<a href="#case-14">ケース14 サーバーレスREST API</a>／<a href="#case-16">ケース16 定期バッチ処理</a>／<a href="#case-20">ケース20 データレイク構築</a>／<a href="#case-23">ケース23 ログ収集・分析基盤</a>／<a href="#case-45">ケース45 コンテナ基盤の選定（ECS/EKS/App Runner）</a></td>
</tr>
</table>
<p>表のケースは、その分野の考え方が構成の中心になっているものを選んでいます。
出題範囲そのものを網羅した対応表ではないため、受験前には必ず公式の試験ガイドで範囲を確認してください。
各ケースの末尾にある確認問題に自分の言葉で答えられるかを試すと、試験本番で問われる
「要件が変わったらどう変えるか」の判断練習になります。</p>

<div class="intro-note">
<p><strong>使い方のこつ</strong>：資料の量に圧倒される必要はありません。実務では
「①アーキテクチャセンターで近い構成図を探す→②Well-Architectedの観点で自分の要件に合わせて調整する→
③規範ガイダンスやSolutions Libraryで実装の具体を確認する」という順で引くと迷いません。
この教材で「枠の意味」と「選定の軸」を身につけていれば、公式資料はぐっと読みやすくなっているはずです。</p>
</div>

<p class="resources-checked">掲載リンクは2026年8月25日時点で全件アクセス確認済みです。</p>`
});
