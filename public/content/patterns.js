// 設計パターン名鑑：会話や設計レビューに登場する「名前のついた設計パターン」の索引
// 掲載URLは追加時にHTTP 200と着地先URL（リダイレクトでトップに飛ばされていないか）を確認すること
registerPatternCatalog({
  tocTitle: "設計パターン名鑑",
  updated: "2026年9月3日",
  lead: `<p>設計の会話には「そこはサーキットブレーカーを入れよう」「スパースインデックスでいけるね」のように、<strong>名前のついたパターン</strong>が当たり前のように登場します。名前は設計者どうしの共通言語で、名前を知っているだけで会話とドキュメントの解像度が一気に上がります。このページは、よく登場する名前を分類ごとに集めた索引です。全部を覚える必要はありません。<strong>知らない名前に出会ったときに引く辞書</strong>として使ってください。</p>
<p>パターン名の出どころは主に3つあります。①<a href="https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/introduction.html" target="_blank" rel="noopener noreferrer">AWS規範ガイダンスのクラウドデザインパターン集</a>、②<a href="https://learn.microsoft.com/ja-jp/azure/architecture/patterns/" target="_blank" rel="noopener noreferrer">Microsoftのクラウドデザインパターンカタログ</a>（Azureのドキュメントですが、パターン名はクラウド共通の語彙として広く使われています）、③Martin Fowler氏らによる原典記事です。各パターンの「もっと知る」には、AWS公式の日本語ドキュメントを優先しつつ、公式に該当ページが無いものはこれらの原典へのリンクを載せています。</p>`,
  groups: [
    {
      name: "スケーラビリティと可用性",
      patterns: [
        {
          name: "スケールアウトとスケールアップ",
          en: "Scale Out / Scale Up",
          desc: "処理能力の増やし方には2つの方向があります。サーバーの<strong>台数を増やす</strong>のがスケールアウト（水平スケーリング）、<strong>1台あたりの性能を上げる</strong>のがスケールアップ（垂直スケーリング）です。減らす方向はそれぞれスケールイン・スケールダウンと呼びます。クラウドでは需要に合わせて台数を自動で増減できるため、まずスケールアウトできる作りにしておくのが基本戦略です。逆に、台数を増やせないデータベースなどは、スケールアップが現実的な選択になる場面もあります。",
          aws: "EC2 Auto Scaling、ECSのサービスAuto Scaling、DynamoDBオンデマンドモード",
          cases: [2, 7, 8],
          references: [
            { title: "Amazon EC2 Auto Scalingとは", url: "https://docs.aws.amazon.com/ja_jp/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html" }
          ]
        },
        {
          name: "マルチAZ配置",
          en: "Multi-AZ",
          desc: "1つのリージョン内にある複数のアベイラビリティゾーン（独立したデータセンター群）にサーバーやデータベースを分散して置き、1つのAZが丸ごと止まってもサービスを続けられるようにする配置の定石です。「卵を1つのかごに盛るな」をAWSで実践する最初の一歩で、本番システムではほぼ必須の前提になります。",
          aws: "複数AZにまたがるALB+Auto Scaling、RDSのマルチAZ配置、Aurora",
          cases: [8, 11, 12],
          references: [
            { title: "Amazon RDSのマルチAZ配置", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html" }
          ]
        },
        {
          name: "サーキットブレーカー",
          en: "Circuit Breaker",
          desc: "呼び出し先のサービスが不調のとき、呼び出しを一時的に遮断して失敗し続ける処理への無駄な接続を止め、共倒れ（連鎖障害）を防ぐパターンです。家庭のブレーカーと同じで、異常を検知したら回路を「開き」、しばらくしてから試験的に少しだけ流し、回復していれば元に戻します。マイクロサービス間の呼び出しで特によく登場します。",
          aws: "実装はアプリ側のライブラリが中心。Step Functionsのエラー分岐やRoute 53ヘルスチェックも同じ発想",
          references: [
            { title: "サーキットブレーカーパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html" },
            { title: "CircuitBreaker（Martin Fowler・原典）", url: "https://martinfowler.com/bliki/CircuitBreaker.html" }
          ]
        },
        {
          name: "バルクヘッド",
          en: "Bulkhead",
          desc: "船の浸水を1区画に閉じ込める隔壁（バルクヘッド）が名前の由来です。コネクションプールや実行環境などのリソースを機能ごとに区切り、1つの機能の過負荷や障害が他の機能のリソースまで食いつぶすのを防ぎます。「全部が少しずつ壊れる」より「一部だけが壊れて残りは無事」を選ぶ考え方です。",
          aws: "Lambdaの予約済み同時実行数、機能ごとのキュー分割、セル分割",
          references: [
            { title: "Bulkheadパターン（Microsoftクラウドデザインパターン）", url: "https://learn.microsoft.com/ja-jp/azure/architecture/patterns/bulkhead" }
          ]
        },
        {
          name: "リトライと指数バックオフ+ジッター",
          en: "Retry with Exponential Backoff and Jitter",
          desc: "失敗した呼び出しをすぐ再試行するのではなく、待ち時間を2倍ずつ延ばしながら（指数バックオフ）、さらにランダムなゆらぎ（ジッター）を混ぜて再試行するパターンです。全クライアントが同じ間隔で一斉に再試行すると、回復しかけた相手に負荷の波が周期的に押し寄せて回復を妨げてしまう（リトライストーム）ため、待ち時間を散らすところまで含めて定石です。AWSのSDKにはこの挙動が標準で組み込まれています。",
          cases: [15, 18],
          references: [
            { title: "再試行とバックオフのパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html" },
            { title: "ジッターを伴うタイムアウト、再試行、バックオフ（Amazon Builders' Library）", url: "https://aws.amazon.com/jp/builders-library/timeouts-retries-and-backoff-with-jitter/" }
          ]
        },
        {
          name: "べき等性",
          en: "Idempotency",
          desc: "同じ処理を2回実行しても、結果が1回だけ実行したときと変わらない性質のことです。リトライやキューの「少なくとも1回」配信は同じメッセージが重複して届く前提なので、受け側がべき等でなければ二重課金や二重登録が起きます。注文IDなどの一意キーで「処理済みなら何もしない」を実装するのが定番で、リトライ系のパターンとは常にセットで語られます。",
          aws: "DynamoDBの条件付き書き込み、Lambda Powertoolsのべき等性ユーティリティ",
          cases: [15, 19],
          references: [
            { title: "べき等APIで再試行を安全にする（Amazon Builders' Library）", url: "https://aws.amazon.com/jp/builders-library/making-retries-safe-with-idempotent-APIs/" }
          ]
        },
        {
          name: "スロットリング",
          en: "Throttling",
          desc: "一定量を超えたリクエストを意図的に断り（HTTP 429を返し）、システム全体を過負荷から守るパターンです。遊園地の入場制限と同じで、全員を一度に入れてサービス全体を止めるより、超過分に待ってもらう方が全体の被害が小さくなります。APIの利用者ごとの上限設定（レート制限）としても使われます。",
          aws: "API Gatewayのスロットリング、WAFのレートベースルール",
          cases: [14, 39],
          references: [
            { title: "API Gatewayのスロットリング", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-request-throttling.html" }
          ]
        },
        {
          name: "セルベースアーキテクチャ",
          en: "Cell-Based Architecture",
          desc: "システム全体を「セル」と呼ぶ独立した小さな複製に分割し、利用者を特定のセルに割り当てるパターンです。障害もデプロイの失敗も1セルの中に閉じ込められるため、影響範囲が「全利用者」から「1セル分の利用者」に縮まります。大規模SaaSやAWS自身のサービスの内部設計で使われる、影響範囲を最小化する上級パターンです。",
          references: [
            { title: "セルベースアーキテクチャによる影響範囲の縮小（AWS公式）", url: "https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html" }
          ]
        },
        {
          name: "シャッフルシャーディング",
          en: "Shuffle Sharding",
          desc: "利用者ごとにリソース（サーバーなど）の組み合わせをトランプを切るようにランダムに割り当てるAWS発の技法です。単純にグループ分けすると同じグループの利用者は運命共同体になりますが、組み合わせをシャッフルすると「ある問題利用者と完全に同じ組み合わせ」に当たる他の利用者が激減し、巻き添え障害の確率を劇的に下げられます。Route 53などAWSサービスの内部で実際に使われています。",
          references: [
            { title: "シャッフルシャーディングを使うワークロードの分離（Amazon Builders' Library）", url: "https://aws.amazon.com/jp/builders-library/workload-isolation-using-shuffle-sharding/" }
          ]
        }
      ]
    },
    {
      name: "配信とキャッシュ",
      patterns: [
        {
          name: "エッジキャッシュ配信",
          en: "Cache Distribution",
          desc: "世界中に配置されたエッジロケーション（利用者の近くの拠点）にコンテンツのコピーを置き、一番近い場所から配信するパターンです。表示が速くなるだけでなく、オリジン（大元のサーバー）へのアクセスと転送量が減るため、負荷対策と費用対策を同時に満たします。静的ファイルに限らず、APIレスポンスのキャッシュにも使えます。",
          aws: "CloudFront",
          cases: [1, 3, 6],
          references: [
            { title: "Amazon CloudFrontとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Introduction.html" }
          ]
        },
        {
          name: "静的コンテンツオフロード",
          en: "Static Content Hosting",
          desc: "HTML・画像・動画などの静的ファイルを、Webサーバーではなくオブジェクトストレージから直接配信するパターンです。サーバーは動的な処理に専念でき、静的ファイルの分だけサーバー台数を減らせます。サーバーを1台も持たない静的サイト（S3+CloudFront）はこの考え方の極致で、日本ではAWSクラウドデザインパターン（CDP）の「Web Storageパターン」の名でも知られています。",
          aws: "S3+CloudFront",
          cases: [1, 2],
          references: [
            { title: "Amazon S3での静的ウェブサイトのホスティング", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/WebsiteHosting.html" }
          ]
        },
        {
          name: "キャッシュアサイド",
          en: "Cache-Aside / Lazy Loading",
          desc: "アプリがまずキャッシュを見て、あればそれを使い（ヒット）、なければデータベースから読んでキャッシュに書き戻してから返す（ミス）、最も基本的なキャッシュ戦略です。実際に読まれたデータだけがキャッシュされるため無駄がありません。一方で、更新後もキャッシュに古いデータが残り得るため、有効期限（TTL）や更新時の削除とセットで設計します。",
          aws: "ElastiCache（Valkey/Redis/Memcached）+RDSやDynamoDB",
          cases: [8],
          references: [
            { title: "キャッシュ戦略（ElastiCache公式）", url: "https://docs.aws.amazon.com/ja_jp/AmazonElastiCache/latest/dg/Strategies.html" },
            { title: "Cache-Asideパターン（Microsoftクラウドデザインパターン）", url: "https://learn.microsoft.com/ja-jp/azure/architecture/patterns/cache-aside" }
          ]
        },
        {
          name: "ライトスルー",
          en: "Write-Through",
          desc: "データベースへ書き込むと同時にキャッシュも更新する戦略です。キャッシュが常に最新なので、読んだ瞬間に古いデータをつかむ心配がほぼなくなります。その代わり書き込みのたびに二重の作業が発生し、一度も読まれないデータまでキャッシュしてしまうため、読み取りが多く鮮度が重要なデータに向きます。キャッシュアサイドと組み合わせて使われることも多い戦略です。",
          aws: "ElastiCache+DynamoDB（DAXはライトスルー型のキャッシュ）",
          references: [
            { title: "キャッシュ戦略（ElastiCache公式）", url: "https://docs.aws.amazon.com/ja_jp/AmazonElastiCache/latest/dg/Strategies.html" }
          ]
        }
      ]
    },
    {
      name: "データベースとデータ設計",
      patterns: [
        {
          name: "リードレプリカ",
          en: "Read Replica",
          desc: "書き込みを担う本体のデータベースから複製した、読み取り専用のコピーを用意するパターンです。Webサービスの多くは読み取りが書き込みの何倍もあるため、参照系のクエリをレプリカへ逃がすだけで本体の負荷が大きく下がります。複製にはわずかな遅延があるので、「書いた直後に必ず最新を読みたい」処理は本体へ向ける、といった使い分けが設計のポイントです。",
          aws: "RDSリードレプリカ、Auroraのリーダーインスタンス",
          cases: [3, 22],
          references: [
            { title: "Amazon RDSのリードレプリカ", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/USER_ReadRepl.html" }
          ]
        },
        {
          name: "シャーディング",
          en: "Sharding / Write Sharding",
          desc: "データをキー（ユーザーIDなど）で複数のデータベースやパーティションに分割し、書き込み負荷を分散するパターンです。1台では書き込みが捌けない規模で登場します。DynamoDBでは、特定のパーティションキーへのアクセス集中（ホットパーティション）を避けるため、キーにランダムな接尾辞を付けて書き込みを散らす「書き込みシャーディング」がこの名前で呼ばれます。",
          aws: "DynamoDBの書き込みシャーディング、Auroraのシャード分割（Limitless Database）",
          references: [
            { title: "書き込みシャーディングを使用したパーティションキーの設計（DynamoDB公式）", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html" }
          ]
        },
        {
          name: "スパースインデックス",
          en: "Sparse Index",
          desc: "DynamoDBのグローバルセカンダリインデックス（GSI）は、インデックスのキーに指定した属性を<strong>持つ項目だけ</strong>が載る、という性質があります。これを逆手に取り、「処理待ちの注文だけ」「エラーになった項目だけ」のように対象の項目にだけ属性を付けて、まばら（スパース）で小さな索引を作るパターンです。テーブル全体をスキャンせずに少数の対象だけを効率よく一覧でき、インデックスの容量費用も最小で済みます。",
          aws: "DynamoDBのGSI",
          references: [
            { title: "スパースインデックスの活用（DynamoDB公式）", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/bp-indexes-general-sparse-indexes.html" }
          ]
        },
        {
          name: "シングルテーブルデザイン",
          en: "Single Table Design",
          desc: "RDBのように正規化した多数のテーブルを作るのではなく、DynamoDBの1つのテーブルに複数種類のデータを載せ、「どんな問い合わせをするか」から逆算してキーを設計する方法です。DynamoDBにはJOINがないため、関連するデータを1回のQueryでまとめて取れるようにキーを工夫するのが狙いです。RDB経験者ほど最初は面食らう、DynamoDB設計の代表的な流儀です。",
          aws: "DynamoDB",
          references: [
            { title: "NoSQL設計のベストプラクティス（DynamoDB公式）", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/bp-general-nosql-design.html" }
          ]
        },
        {
          name: "CQRS",
          en: "Command Query Responsibility Segregation",
          desc: "書き込み（コマンド）と読み取り（クエリ）の責務を分け、それぞれに適したモデルやデータストアを使うパターンです。たとえば書き込みは整合性重視のRDB、読み取りは表示に最適化した検索エンジンや非正規化テーブル、と分けます。読み書きの要件が大きく食い違うときに効きますが、2系統のデータを同期する複雑さが増えるため、必要になってから導入するのが定石です。",
          aws: "書き込みRDS+読み取りOpenSearchなど。同期にはDynamoDB StreamsやDMSを使う",
          references: [
            { title: "CQRSパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/modernization-data-persistence/cqrs-pattern.html" },
            { title: "CQRS（Martin Fowler・原典）", url: "https://martinfowler.com/bliki/CQRS.html" }
          ]
        },
        {
          name: "イベントソーシング",
          en: "Event Sourcing",
          desc: "「現在の状態」を上書き保存するのではなく、起きた出来事（イベント）を追記だけで残し、状態はイベントの積み重ねから導くパターンです。銀行の通帳が残高だけでなく全取引を記録しているのと同じで、履歴が完全に残るため監査や「あの時点の状態の再現」に強くなります。CQRSと組み合わせて語られることが多いパターンです。",
          aws: "イベントの保存にDynamoDBやKinesis、読み取りモデルの構築にLambda",
          cases: [19],
          references: [
            { title: "イベントソーシングパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing.html" }
          ]
        },
        {
          name: "変更データキャプチャ",
          en: "CDC / Change Data Capture",
          desc: "データベースへの変更（挿入・更新・削除）を検知してストリームとして流し、別のシステムへ届けるパターンです。アプリに手を入れずにDBの変更だけを拾えるのが強みで、検索インデックスや分析基盤への同期、キャッシュの無効化などの定番手段になっています。",
          aws: "DynamoDB Streams、DMSのCDCタスク、AuroraとKinesisの連携",
          cases: [21, 25],
          references: [
            { title: "DMSでの変更データキャプチャ（CDC）", url: "https://docs.aws.amazon.com/ja_jp/dms/latest/userguide/CHAP_Task.CDC.html" },
            { title: "DynamoDB Streamsによる変更のキャプチャ", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Streams.html" }
          ]
        }
      ]
    },
    {
      name: "非同期処理とメッセージング",
      patterns: [
        {
          name: "キューによる負荷平準化",
          en: "Queue-Based Load Leveling",
          desc: "リクエストをいったんキューに積み、処理側は自分のペースで取り出して処理するパターンです。行列のできる店の整理券と同じで、急なアクセスの山はキューが吸収し、後段の処理系は一定のペースを保てます。「受け付けたことを先に返し、重い処理は後ろで着々と進める」非同期設計の中心にあるパターンです。",
          aws: "SQS+Lambda/ECS",
          cases: [15, 42],
          references: [
            { title: "Amazon SQSとは", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html" },
            { title: "Queue-Based Load Levelingパターン（Microsoftクラウドデザインパターン）", url: "https://learn.microsoft.com/ja-jp/azure/architecture/patterns/queue-based-load-leveling" }
          ]
        },
        {
          name: "パブリッシュ/サブスクライブ",
          en: "Publish/Subscribe（Pub/Sub）",
          desc: "送り手はトピックへイベントを発行（パブリッシュ）するだけ、受け手は興味のあるトピックを購読（サブスクライブ）するだけで、お互いの存在を知らずに済むパターンです。受け手を追加しても送り手のコードは変わらないため、システムを疎結合に保つ基本形として、イベント駆動アーキテクチャの土台になっています。",
          aws: "SNS、EventBridge",
          cases: [19, 39],
          references: [
            { title: "パブリッシュ/サブスクライブパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/publish-subscribe.html" }
          ]
        },
        {
          name: "ファンアウト",
          en: "Fan-out",
          desc: "1つのイベントを複数の宛先へ同時に配るパターンです。名前は扇（ファン）が開く形から来ています。「注文確定」という1つのイベントを、在庫更新・メール送信・分析記録の3つの処理へ同時に届ける、といった使い方をします。SNSトピックの後ろに複数のSQSキューをぶら下げる構成が定番です。",
          aws: "SNS→複数のSQS、EventBridgeの複数ターゲット",
          cases: [19, 39],
          references: [
            { title: "SNSからSQSへのファンアウト（公式）", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/sns-sqs-as-subscriber.html" }
          ]
        },
        {
          name: "デッドレターキュー",
          en: "Dead Letter Queue（DLQ）",
          desc: "何度リトライしても処理できないメッセージを、本流のキューから退避させておく専用キューです。配達できない手紙を集める郵便局の「還付郵便」置き場のようなもので、不良メッセージが本流に詰まって後続を道連れにするのを防ぎ、原因を後からゆっくり調査できます。キューを使う構成ではほぼ必須の安全装置です。",
          aws: "SQSのデッドレターキュー、Lambdaの失敗時送信先",
          cases: [15, 17],
          references: [
            { title: "SQSのデッドレターキュー（公式）", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html" }
          ]
        },
        {
          name: "優先度キュー",
          en: "Priority Queue",
          desc: "重要なジョブを後回しにしないよう、優先度の高い仕事と低い仕事を分けて処理するパターンです。SQSにはメッセージ単位の優先度機能がないため、AWSでは「高優先」「低優先」のキューを分け、処理側が高優先のキューを先に見る構成で実現するのが定番です。",
          aws: "優先度別のSQSキュー+処理側の読み分け",
          references: [
            { title: "Priority Queueパターン（Microsoftクラウドデザインパターン）", url: "https://learn.microsoft.com/ja-jp/azure/architecture/patterns/priority-queue" }
          ]
        },
        {
          name: "クレームチェック",
          en: "Claim Check",
          desc: "画像のような大きなデータ本体はストレージに置き、メッセージには「引換券」にあたる参照キーだけを流すパターンです。名前はクロークの手荷物引換券が由来です。キューにはサイズ上限（SQSは標準256KB）があるため、大きなデータを扱うメッセージングではこの形がほぼ必須になります。",
          aws: "本体をS3に置き、SQSやEventBridgeにはS3のキーだけを流す",
          cases: [17],
          references: [
            { title: "Claim Checkパターン（Microsoftクラウドデザインパターン）", url: "https://learn.microsoft.com/ja-jp/azure/architecture/patterns/claim-check" }
          ]
        },
        {
          name: "サーガ",
          en: "Saga",
          desc: "複数のサービスにまたがる一連の処理（在庫確保→決済→発送手配など）で、途中で失敗したら<strong>補償処理</strong>（それまでの操作の取り消し）を実行して整合性を保つパターンです。サービスをまたぐDBトランザクションが使えない分散システムでの現実解で、指揮者役が進行を管理する「オーケストレーション型」と、イベントの連鎖で自律的に進む「コレオグラフィ型」の2方式があります。",
          aws: "Step Functions（オーケストレーション型）、EventBridge（コレオグラフィ型）",
          cases: [12],
          references: [
            { title: "サーガパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/saga.html" },
            { title: "サーガオーケストレーション（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html" }
          ]
        },
        {
          name: "トランザクショナルアウトボックス",
          en: "Transactional Outbox",
          desc: "「データベースを更新し、かつイベントも発行する」という2つの操作を、確実に両方成立させるためのパターンです。イベントをまずDB内の送信箱（outbox）テーブルへ<strong>同じトランザクションで</strong>書き込み、別のプロセスが送信箱から取り出して配信します。DB更新は成功したのにイベント発行だけ失敗する「二重書き込み問題」の代表的な解決策です。",
          aws: "RDS+送信箱テーブル+ポーリングまたはCDC、DynamoDB+DynamoDB Streams",
          references: [
            { title: "トランザクショナルアウトボックスパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html" }
          ]
        },
        {
          name: "スキャッターギャザー",
          en: "Scatter-Gather",
          desc: "リクエストを複数の宛先へ同時にばらまき（スキャッター）、返ってきた結果を集めて（ギャザー）1つにまとめて返すパターンです。複数の保険会社へ同時に見積もりを依頼して一覧で見せる、複数のデータソースを横断検索する、といった場面で登場します。並列に投げる分速いものの、一番遅い相手に全体が引きずられるため、タイムアウト設計が肝になります。",
          aws: "Step Functionsの並列ステート、SNSでの同報+結果集約",
          references: [
            { title: "スキャッターギャザーパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/scatter-gather.html" }
          ]
        }
      ]
    },
    {
      name: "マイクロサービスと移行",
      patterns: [
        {
          name: "マイクロサービス",
          en: "Microservices",
          desc: "アプリケーションを業務単位の小さな独立したサービスに分割し、それぞれを別々に開発・デプロイ・スケールさせるアーキテクチャスタイルです。チームごとに独立して動ける反面、サービス間の通信・整合性・監視という新しい難しさが生まれます。この名鑑にあるサーガ・サーキットブレーカー・Pub/Subなどの多くは、その難しさを解くために使われるパターンです。",
          aws: "ECS/EKS上のサービス群+API Gateway+EventBridge",
          cases: [19],
          references: [
            { title: "マイクロサービスの概要（AWS公式）", url: "https://aws.amazon.com/jp/microservices/" }
          ]
        },
        {
          name: "APIゲートウェイ",
          en: "API Gateway",
          desc: "すべてのクライアントからの入口を1か所に集め、認証・スロットリング・ルーティングといった共通の仕事を一手に引き受けるパターンです。各サービスが個別に入口を持つと共通処理が重複し、クライアントは接続先だらけになります。AWSのサービス名（Amazon API Gateway）にもなっていますが、元は設計パターンの名前です。",
          aws: "Amazon API Gateway、ALB",
          cases: [14],
          references: [
            { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html" }
          ]
        },
        {
          name: "BFF",
          en: "Backend for Frontend",
          desc: "Web用・モバイル用など、フロントエンドの種類ごとに専用のバックエンドAPIを用意するパターンです。1つの汎用APIで全クライアントの要求に応えようとすると、どのクライアントにも最適でない肥大化したAPIになりがちです。画面に必要な形へデータをまとめ直す役割をBFFが引き受けることで、フロントエンドごとに最適な形のAPIを保てます。",
          aws: "クライアント種別ごとのAPI Gateway+Lambda、AppSync（GraphQL）",
          references: [
            { title: "BFF（Sam Newman・原典）", url: "https://samnewman.io/patterns/architectural/bff/" }
          ]
        },
        {
          name: "ストラングラーフィグ",
          en: "Strangler Fig",
          desc: "巨大な一枚岩（モノリス）のシステムを一気に作り直すのではなく、機能単位で少しずつ新システムへ置き換え、最後に古い方を退役させる移行パターンです。宿主の木に絡みつき、やがて置き換わるイチジク（strangler fig）になぞらえてMartin Fowler氏が名付けました。入口にプロキシを置き、移行済みの機能だけ新システムへ流すのが定番の形です。",
          aws: "API GatewayやALBのパスルーティングで新旧システムを切り替え",
          references: [
            { title: "ストラングラーフィグパターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html" },
            { title: "StranglerFigApplication（Martin Fowler・原典）", url: "https://martinfowler.com/bliki/StranglerFigApplication.html" }
          ]
        },
        {
          name: "腐敗防止層",
          en: "Anti-Corruption Layer（ACL）",
          desc: "新しいシステムと古いシステムの間に「翻訳層」を置き、レガシー側の都合（古いデータ形式や用語）が新システムの設計へ染み込む（腐敗する）のを防ぐパターンです。ドメイン駆動設計（DDD）由来の名前で、ストラングラーフィグでの段階移行とセットで登場することが多いパターンです。",
          aws: "翻訳役のLambdaやアダプタサービスを新旧の間に挟む",
          references: [
            { title: "腐敗防止層パターン（AWS規範ガイダンス）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/cloud-design-patterns/acl.html" }
          ]
        },
        {
          name: "サイドカー",
          en: "Sidecar",
          desc: "アプリ本体のコンテナに、ログ収集・プロキシ・設定取得などの共通機能を担う別のコンテナを「側車」として並走させるパターンです。アプリ本体のコードに手を入れずに機能を足せて、言語が違うサービスにも同じサイドカーを使い回せます。サービスメッシュ（サービス間通信の制御基盤）はこのパターンの応用です。",
          aws: "ECSタスク内のFluent Bit（ログ転送）やEnvoy（プロキシ）のサイドカーコンテナ",
          references: [
            { title: "Sidecarパターン（Microsoftクラウドデザインパターン）", url: "https://learn.microsoft.com/ja-jp/azure/architecture/patterns/sidecar" }
          ]
        }
      ]
    },
    {
      name: "デプロイとリリース",
      patterns: [
        {
          name: "ブルーグリーンデプロイ",
          en: "Blue/Green Deployment",
          desc: "現行環境（ブルー）と新バージョンの環境（グリーン）を丸ごと2面用意し、動作確認の済んだグリーンへ通信の向き先を一括で切り替えるパターンです。切り替えは向き先の変更だけなので一瞬で、問題があれば向き先を戻すだけで即座にロールバックできます。その代わり、切り替えの間は環境が2面分必要になります。",
          aws: "CodeDeploy、ALBのターゲットグループ切り替え、Route 53の加重ルーティング",
          cases: [43],
          references: [
            { title: "AWSでのブルー/グリーンデプロイ（公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/blue-green-deployments/welcome.html" }
          ]
        },
        {
          name: "カナリアリリース",
          en: "Canary Release",
          desc: "新バージョンをまず一部の利用者（たとえば5%）だけに公開し、エラー率などの指標に問題がないことを確かめてから全体へ広げるパターンです。炭鉱で毒ガスをいち早く知らせたカナリアが名前の由来で、問題が起きても被害が一部の利用者に限定されます。ブルーグリーンの「一括切り替え」に対して、こちらは「少しずつ切り替え」です。",
          aws: "CodeDeployのカナリアデプロイ、API Gatewayのカナリアリリース、Lambdaのエイリアス加重",
          cases: [43],
          references: [
            { title: "デプロイ戦略の比較（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/overview-deployment-options/deployment-strategies.html" }
          ]
        },
        {
          name: "ローリングデプロイ",
          en: "Rolling Deployment",
          desc: "サーバー群を数台ずつ順番に新バージョンへ入れ替えていくパターンです。追加のインフラがほぼ要らない堅実な方式ですが、入れ替えの間は新旧バージョンが混在するため、両バージョンが同居しても壊れない作り（DBスキーマの互換性など）が前提になります。ECSのサービス更新など、多くの基盤の標準的なデプロイ方式です。",
          aws: "ECSのローリング更新、EC2 Auto Scalingのインスタンス更新",
          cases: [43],
          references: [
            { title: "デプロイ戦略の比較（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/overview-deployment-options/deployment-strategies.html" }
          ]
        },
        {
          name: "フィーチャーフラグ",
          en: "Feature Flags",
          desc: "機能の有効/無効をコードのデプロイと切り離し、設定の切り替えだけで制御するパターンです。コードは先に本番へ出しておき、公開は設定でオンにした瞬間から、と分けられるため、「リリース＝公開」ではなくなります。特定の利用者だけに先行公開したり、問題があれば設定1つで即座に引っ込めたりできます。",
          aws: "AWS AppConfigのフィーチャーフラグ、CloudWatch Evidently",
          references: [
            { title: "AWS AppConfigとは", url: "https://docs.aws.amazon.com/ja_jp/appconfig/latest/userguide/what-is-appconfig.html" }
          ]
        },
        {
          name: "イミュータブルインフラストラクチャ",
          en: "Immutable Infrastructure",
          desc: "稼働中のサーバーに手を入れて更新するのではなく、新しい設定を焼き込んだサーバーを別に作り、古いものは丸ごと捨てて置き換える考え方です。手作業の積み重ねで本番だけ状態が違う「構成ドリフト」を防ぎ、同じものを何度でも作り直せる再現性を保ちます。IaC（インフラのコード化）やブルーグリーンデプロイと相性のよい、クラウド運用の基本思想です。",
          aws: "AMIやコンテナイメージの作り直し+Auto Scalingでの入れ替え、IaC（CloudFormation/CDK/Terraform）",
          cases: [44],
          references: [
            { title: "デプロイ戦略の比較（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/overview-deployment-options/deployment-strategies.html" }
          ]
        }
      ]
    },
    {
      name: "災害対策（DR）の4段階",
      patterns: [
        {
          name: "バックアップ&リストア",
          en: "Backup and Restore",
          desc: "普段はバックアップだけを別リージョンへ置いておき、被災したら環境をゼロから作り直して復旧する、DR戦略の中で最も低コストな段階です。その分、復旧までの時間（RTO）は最も長くなります。DR戦略はこのパターンから次のマルチサイトまで4段階あり、「どこまで払って、どれだけ速く復旧したいか」で選びます。",
          aws: "AWS Backupでのクロスリージョンコピー+IaCでの環境再構築",
          cases: [48, 49],
          references: [
            { title: "クラウドでの災害対策オプション（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" }
          ]
        },
        {
          name: "パイロットライト",
          en: "Pilot Light",
          desc: "給湯器の種火（パイロットライト）が名前の由来です。データベースの複製など「火種」となる最小限の要素だけを待機側リージョンで常時動かしておき、被災時にサーバー群を起動して本格稼働へ広げます。データは常に最新に保ちつつ、待機費用はサーバーを動かさない分だけ安く抑えられます。",
          aws: "Auroraグローバルデータベース+待機側は起動テンプレートだけ用意",
          cases: [49],
          references: [
            { title: "クラウドでの災害対策オプション（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" }
          ]
        },
        {
          name: "ウォームスタンバイ",
          en: "Warm Standby",
          desc: "本番の縮小版（台数を絞ったフル構成）を待機側リージョンで常時稼働させておき、被災時に本番サイズへ拡大して切り替える段階です。すでに全部品が動いているため、パイロットライトより速く復旧できます。切り替え訓練をしやすいのも利点で、その分待機費用は上がります。",
          aws: "縮小構成のAuto Scaling+Route 53のフェイルオーバールーティング",
          cases: [49],
          references: [
            { title: "クラウドでの災害対策オプション（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" }
          ]
        },
        {
          name: "マルチサイトアクティブ/アクティブ",
          en: "Multi-site Active/Active",
          desc: "複数のリージョンで常時本番トラフィックを処理する、DR戦略の最上位です。どちらかが被災してももう一方が処理を続けるため、復旧時間はほぼゼロになります。その代わり費用は常に複数リージョン分かかり、複数拠点間でのデータ整合性という難問と常に向き合うことになります。金融や社会インフラ級の要件で選ばれる段階です。",
          aws: "DynamoDBグローバルテーブル+Route 53のレイテンシー/加重ルーティング",
          cases: [49],
          references: [
            { title: "クラウドでの災害対策オプション（AWS公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" }
          ]
        }
      ]
    },
    {
      name: "SaaSのテナント分離",
      patterns: [
        {
          name: "サイロ/ブリッジ/プールモデル",
          en: "Silo / Bridge / Pool",
          desc: "SaaSで複数の顧客企業（テナント）をどこまで分離するかを表す3つのモデルです。テナントごとに環境を丸ごと分けるのが<strong>サイロ</strong>（分離は完璧だが費用は人数分）、全テナントで基盤を共用するのが<strong>プール</strong>（コスト効率は最高だが影響分離の設計が必須）、アプリは共用しつつデータベースだけ分けるといった中間が<strong>ブリッジ</strong>です。SaaSの設計会話はほぼこの語彙で始まります。",
          aws: "サイロはアカウント/VPC分離、プールはIAMやRLSでのテナントIDによる論理分離",
          cases: [9],
          references: [
            { title: "サイロ、プール、ブリッジモデル（AWS Well-Architected SaaSレンズ）", url: "https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/saas-lens/silo-pool-and-bridge-models.html" }
          ]
        }
      ]
    }
  ]
});
