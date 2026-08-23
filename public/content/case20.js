// ケース20：データレイク構築
registerCase({
  id: 20,
  category: "データ・分析",
  title: "データレイク構築",
  scenario: "<p>ECサイトの注文履歴・アクセスログ・広告データなどが、RDSやCSVファイル、各SaaSにバラバラに散らばっている。分析のたびに担当者が手元にダウンロードして集計しており、集計条件も人によって違う。まずは全データを1か所に集約し、SQLで横断分析できる基盤（データレイク：形式を問わず生データをそのまま溜める置き場）を作りたい。分析は週次のレポートと不定期のアドホック分析が中心で、専任のデータエンジニアはいない。</p>",
  requirements: [
    "散らばったデータを1か所に集約したい",
    "SQLで横断的にアドホック分析したい",
    "データ量が増えても保存コストを低く保ちたい（数TB規模を想定）",
    "分析しない時間帯には費用がかからないようにしたい",
    "将来のBI・機械学習の土台としても使えるようにしたい"
  ],
  main: {
    name: "S3 + Glue + Athena（サーバーレスデータレイク）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "src", icon: "resources/documents", label: "業務データ\n(DB/ログ/CSV)", col: 0, row: 0 },
        { id: "s3raw", icon: "services/s3", label: "S3\n生データ層", col: 1, row: 0 },
        { id: "glue", icon: "services/glue", label: "Glue\nETLジョブ", col: 2, row: 0 },
        { id: "s3clean", icon: "services/s3", label: "S3\n加工済み層", col: 3, row: 0 },
        { id: "athena", icon: "services/athena", label: "Athena", col: 4, row: 0 },
        { id: "catalog", icon: "services/glue", label: "Glue\nデータカタログ", col: 3, row: 1 },
        { id: "analyst", icon: "resources/user", label: "分析者", col: 5, row: 0 }
      ],
      edges: [
        { from: "src", to: "s3raw", label: "データ集約" },
        { from: "s3raw", to: "glue", label: "読み込み" },
        { from: "glue", to: "s3clean", label: "変換して保存" },
        { from: "glue", to: "catalog", label: "スキーマ登録", dashed: true },
        { from: "athena", to: "catalog", label: "定義参照", dashed: true },
        { from: "athena", to: "s3clean", label: "スキャン" },
        { from: "analyst", to: "athena", label: "SQLクエリ" }
      ]
    },
    flow: [
      "各システムのデータをS3の生データ層へそのままの形式で集約する（DBからのエクスポート・ログ転送・CSV置き場など入口は問わない）",
      "Glue（サーバーレスのETLサービス）のジョブが生データを列指向のParquet形式へ変換し、加工済み層へ保存する。クローラーが表の構造（スキーマ）を自動判別してデータカタログに登録する",
      "分析者はAthenaにSQLを投げる。AthenaはデータカタログでS3上のファイル群を「テーブル」として解釈し、直接スキャンして結果を返す",
      "DBサーバーは存在せず、保存はS3・計算はクエリ実行時だけ、という完全従量の構成になる"
    ],
    services: [
      { icon: "services/s3", name: "Amazon S3（生データ層/加工済み層）", role: "データレイクの本体。形式を問わず安価に溜められ、耐久性も高い" },
      { icon: "services/glue", name: "AWS Glue（ETL）", role: "サーバーレスのデータ変換サービス。生データを分析向きの形式へ加工する" },
      { icon: "services/glue", name: "Glueデータカタログ", role: "S3上のファイル群を「どこに・どんな列の表があるか」として管理する目次。AthenaやRedshiftなど複数サービスが共有する" },
      { icon: "services/athena", name: "Amazon Athena", role: "S3のファイルへ直接SQLを実行するクエリエンジン。サーバー不要でスキャン量課金" }
    ],
    points: [
      "生データ層と加工済み層を分けるのがデータレイクの基本形。生データを残しておけば、加工ロジックのミスや要件変更があっても何度でも作り直せる",
      "加工済み層はParquet（列指向の圧縮形式）＋日付パーティション（date=2026-08-23のようなフォルダ分割）にする。Athenaはスキャンしたバイト数で課金されるため、この2つでクエリ費用が桁で変わる",
      "データカタログという「目次」を最初に整備しておくと、後からRedshiftやSageMakerを足しても同じテーブル定義を使い回せる。将来の拡張の要はカタログにある",
      "アクセス頻度が下がった生データはS3のライフサイクルルールで低頻度アクセス層や Glacierへ自動移行し、保存コストを抑える"
    ],
    pros: [
      "常時稼働するサーバーがなく、分析しない日はストレージ費用だけ",
      "数TB〜PB級までS3がそのままスケールする",
      "スキーマは後から定義すればよく、とりあえず溜め始められる",
      "カタログを土台にBI・ML・DWHへ段階的に拡張できる"
    ],
    cons: [
      "クエリのたびにS3をスキャンするため、応答は数秒〜数十秒。ダッシュボードの高速表示には不向き",
      "Athenaは同時実行数に上限があり、大人数での同時利用には向かない",
      "パーティションや形式の設計を怠ると、スキャン課金が想定外に膨らむ"
    ],
    cost: "<strong>月3,000円〜1万円程度</strong>（保存1TB約3,700円+日次Glueジョブ約2,000円+Athenaスキャン月1TBで約750円の前提。分析が増えるとスキャン分が伸びる）。",
    references: [
      { title: "AWS Glueとは", url: "https://docs.aws.amazon.com/ja_jp/glue/latest/dg/what-is-glue.html" },
      { title: "Amazon Athenaとは", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/what-is.html" },
      { title: "Glueデータカタログとクローラー", url: "https://docs.aws.amazon.com/ja_jp/glue/latest/dg/catalog-and-crawler.html", note: "目次づくりの公式解説" },
      { title: "AthenaからのAWS Glueの使用", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/glue-athena.html", note: "カタログをAthenaが参照する仕組み" }
    ]
  },
  alternatives: [
    {
      name: "Redshift直行（DWH中心）",
      when: "決まったダッシュボードを大勢が毎日見る・秒以下の応答が必要など、分析が定型・高頻度でDWH（分析専用DB）を常用する場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "src", icon: "resources/documents", label: "業務データ\n(DB/ログ/CSV)", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\nステージング", col: 1, row: 0 },
          { id: "rs", icon: "services/redshift", label: "Redshift\nDWH", col: 2, row: 0 },
          { id: "qs", icon: "services/quicksight", label: "QuickSight\nBIダッシュボード", col: 3, row: 0 },
          { id: "analyst", icon: "resources/user", label: "分析者・事業部", col: 4, row: 0 }
        ],
        edges: [
          { from: "src", to: "s3", label: "データ集約" },
          { from: "s3", to: "rs", label: "COPYロード" },
          { from: "rs", to: "qs", label: "クエリ" },
          { from: "analyst", to: "qs", label: "閲覧" }
        ]
      },
      flow: [
        "各システムのデータをいったんS3へ集約する（ステージング＝ロード前の待機場所）",
        "RedshiftのCOPYコマンドでS3から一括ロードする。データはRedshift内部の列指向ストレージに最適化された形で保持される",
        "QuickSight（マネージドBIツール）のダッシュボードがRedshiftへクエリし、集計済みの指標を高速に表示する",
        "分析者・事業部メンバーはブラウザからダッシュボードを閲覧する"
      ],
      services: [
        { icon: "services/redshift", name: "Amazon Redshift", role: "分析専用のデータウェアハウス。大量データの集計クエリを秒以下〜数秒で返す" },
        { icon: "services/s3", name: "Amazon S3", role: "ロード前のステージング置き場。Redshiftへの取り込みはS3経由が定石" },
        { icon: "services/quicksight", name: "Amazon QuickSight", role: "マネージドBIサービス。ダッシュボード作成と共有をブラウザだけで完結できる" }
      ],
      points: [
        "クエリのたびにファイルを読むAthenaと違い、Redshiftは取り込み済みデータに対して統計情報・圧縮・分散を最適化するため、同じSQLでも応答速度が桁で速い",
        "COPYはファイルを並列に読み込むため、細かいINSERTの繰り返しより圧倒的に速い。ロードはCOPY一択と覚えてよい",
        "Redshift Serverlessを選べば使った時間だけの課金になり、夜間・休日のアイドル費用を抑えられる。常時稼働ならプロビジョンド型で予約割引を効かせる",
        "推奨構成のデータレイクと排他ではない。実務では「レイクに全部溜め、よく使う部分だけRedshiftへロードする」二段構えが最終形になることが多い"
      ],
      pros: [
        "定型ダッシュボードの応答が速く、大人数の同時アクセスに強い",
        "SQLの互換性・BIツール連携などDWHとしての完成度が高い",
        "Serverless型なら利用時間ベースの課金にできる"
      ],
      cons: [
        "クラスター（またはRPU）稼働分の費用がAthena比で高くつきやすい",
        "取り込み（ロード）という工程が増え、鮮度はロード頻度に依存する",
        "スキーマ設計・分散キー設計などDWH固有の設計知識が必要"
      ],
      cost: "<strong>月1万円〜15万円程度</strong>（Redshift Serverlessで1日2時間程度の利用なら約1.5万円、常時稼働のra3クラスターは月10万円超+QuickSight1ユーザー約1,300円〜）。",
      references: [
        { title: "Amazon Redshiftとは", url: "https://docs.aws.amazon.com/ja_jp/redshift/latest/mgmt/welcome.html" },
        { title: "COPYコマンド", url: "https://docs.aws.amazon.com/ja_jp/redshift/latest/dg/r_COPY.html", note: "S3からの一括ロードの一次情報" },
        { title: "Amazon QuickSightとは", url: "https://docs.aws.amazon.com/ja_jp/quicksight/latest/user/welcome.html" }
      ]
    },
    {
      name: "OpenSearch（ログ検索・可視化中心）",
      when: "分析対象がほぼログで、SQL集計より「キーワード検索・直近データの絞り込み・リアルタイムダッシュボード」が主目的の場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 }
        ],
        nodes: [
          { id: "logs", icon: "resources/documents", label: "各種ログ", col: 0, row: 0 },
          { id: "fh", icon: "services/data-firehose", label: "Data Firehose", col: 1, row: 0 },
          { id: "os", icon: "services/opensearch", label: "OpenSearch\n検索クラスター", col: 4, row: 0 },
          { id: "s3bk", icon: "services/s3", label: "S3\n生ログ保管", col: 2, row: 1 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 3, row: 1 },
          { id: "analyst", icon: "resources/user", label: "分析者", col: 5, row: 1 }
        ],
        edges: [
          { from: "logs", to: "fh", label: "ログ送信" },
          { from: "fh", to: "os", label: "検索用に配信" },
          { from: "fh", to: "s3bk", label: "生データ保存" },
          { from: "analyst", to: "igw", label: "ダッシュボード" },
          { from: "igw", to: "os", dashed: true }
        ]
      },
      flow: [
        "アプリ・サーバーの各種ログをData Firehose（ストリーム配信サービス）へ送る",
        "FirehoseはログをVPC内のOpenSearchクラスターへ検索用に配信し、同時に生データをS3へも保存する（全量バックアップ）",
        "OpenSearchは全文検索インデックスを作り、キーワード検索や直近ログの絞り込みを数百ミリ秒で返す",
        "分析者はOpenSearch Dashboardsでグラフ・検索画面を使う。VPC内のため実務ではVPN・踏み台・プロキシ経由で接続する（図の経路は簡略化）"
      ],
      services: [
        { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "全文検索・ログ分析エンジンのマネージドサービス。可視化ツールのDashboardsも内蔵" },
        { icon: "services/data-firehose", name: "Amazon Data Firehose", role: "ログをOpenSearchとS3へ自動配信するストリーム配信サービス。バッファリングと形式変換も担う" },
        { icon: "services/s3", name: "Amazon S3", role: "生ログの長期保管先。OpenSearchには直近だけを残し、古い分はS3側で持つ" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "VPCの入口。クラスターを外部公開しないため、利用者アクセスはVPN等を併用する" }
      ],
      points: [
        "OpenSearchは「エラーメッセージの部分一致」「特定ユーザーの直近行動」のような検索型の問いに強い。SQL集計型のAthena/Redshiftとは得意分野が根本的に違う",
        "クラスターのストレージは高価なので、インデックスは直近30日などに限定し、それより古いログはFirehoseがS3へ残した生データをAthenaで読む二段構えにする",
        "OpenSearchはVPC内に置くのが定石で、ここでもVPC・ゲートウェイの設計が登場する。FirehoseからVPC内への配信はAWSが面倒を見るため、NATは不要",
        "検索負荷が高い時間帯に備えてノードは複数台・マルチAZ構成にするのが本番の推奨。1台構成は検証用と割り切る"
      ],
      pros: [
        "全文検索・絞り込み・リアルタイム可視化が高速",
        "障害調査（直近ログの検索）という開発現場の日常業務に直結する",
        "Dashboardsが内蔵されており、可視化ツールを別途用意しなくてよい"
      ],
      cons: [
        "クラスター常時稼働の固定費がかかり、ストレージ単価もS3より高い",
        "SQLでの複雑な結合・集計分析は不得意で、データレイクの代替にはならない",
        "インデックス設計・ノードサイジングなど運用ノウハウが必要"
      ],
      cost: "<strong>月5,000円〜数万円</strong>（検証用t3.small.search 1台+ストレージで約5,000円、本番のマルチAZ 3台構成では月3万円〜+Firehose転送量）。",
      references: [
        { title: "Amazon OpenSearch Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/what-is.html" },
        { title: "VPC内でのOpenSearch Serviceドメインの起動", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/vpc.html", note: "VPC配置とアクセス経路の一次情報" },
        { title: "Amazon Data Firehoseとは", url: "https://docs.aws.amazon.com/ja_jp/firehose/latest/dev/what-is-this-service.html", note: "OpenSearch/S3への同時配信" }
      ]
    }
  ],
  cost: "<p>推奨構成（S3+Glue+Athena）は<strong>月3,000円〜1万円程度</strong>で、分析しない日は保存料だけ。Redshift案は<strong>月1万円〜15万円程度</strong>で、定型・高頻度分析が多いほど1クエリあたりの単価で有利になる。OpenSearch案は<strong>月5,000円〜数万円</strong>の常時稼働型で、用途がログ検索なら最も効果的。まず全データをS3に集約しておけば、後からどの案へも広げられる。</p>",
  summary: "<p>データ基盤の第一歩は<strong>「とにかく全部S3へ集め、カタログで目次を付ける」</strong>ことです。S3+Glue+Athenaのサーバーレスデータレイクは初期費用ほぼゼロで始められ、しかもここで作ったS3とカタログはRedshiftにもOpenSearchにもそのまま接続できる「将来の共通土台」になります。選び分けの軸は問いの形で、アドホックなSQLならAthena、定型・高頻度のダッシュボードならRedshift、キーワード検索ならOpenSearch。<strong>ツール選びより先にParquet化とパーティション設計</strong>、これがコストを桁で左右する実務の急所です。</p>"
});
