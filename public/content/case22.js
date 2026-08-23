// ケース22：DWHとBIダッシュボード
registerCase({
  id: 22,
  category: "データ・分析",
  title: "DWHとBIダッシュボード",
  scenario: "<p>複数の事業を持つEC企業。売上は基幹システム、顧客情報はCRM、アクセスログはWebサービスと、データが別々の場所に散らばっている。経営会議のたびに各部署がスプレッドシートを手作業で集計しており、数字の食い違いも起きている。「毎朝更新される全社ダッシュボードを経営層が自分で見られるようにしたい」という要望。分析専任の担当者は2名。</p>",
  requirements: [
    "複数システムのデータを1か所に集約し、横断で分析したい",
    "SQLを書けない経営層・企画職が自分でダッシュボードを見られること",
    "更新は日次で十分（リアルタイム性は不要）",
    "データ量は現在数百GB、数年で数TBに成長する見込み",
    "重い集計クエリが本番サービスのDBに影響しないこと"
  ],
  main: {
    name: "S3+Glue+Redshift+QuickSightのDWH構成",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "src", icon: "resources/documents", label: "業務データ\nCSV/DB抽出", col: 0, row: 1 },
        { id: "s3", icon: "services/s3", label: "S3\nデータレイク", col: 1, row: 1 },
        { id: "glue", icon: "services/glue", label: "Glue\nETLジョブ", col: 2, row: 0 },
        { id: "rs", icon: "services/redshift", label: "Redshift\nDWH", col: 3, row: 1 },
        { id: "qs", icon: "services/quicksight", label: "QuickSight\nBI", col: 4, row: 1 },
        { id: "analyst", icon: "resources/users", label: "経営層・\n分析担当", col: 5, row: 1 }
      ],
      edges: [
        { from: "src", to: "s3", label: "日次で集約" },
        { from: "s3", to: "glue", label: "抽出" },
        { from: "glue", to: "rs", label: "ロード" },
        { from: "qs", to: "rs", label: "SQLクエリ" },
        { from: "analyst", to: "qs", label: "ダッシュボード" }
      ]
    },
    flow: [
      "各業務システムのデータを日次でS3（データレイク＝生データの一元置き場）に集約する",
      "GlueのETLジョブが生データを抽出・変換（クレンジングや結合）し、Redshiftにロードする。ETLとはExtract（抽出）・Transform（変換）・Load（書き込み）の頭文字",
      "Redshift（DWH：分析専用に列指向で最適化されたデータベース）が数億行規模の集計クエリを高速に処理する",
      "QuickSight（BIツール）がRedshiftにクエリを投げ、グラフやダッシュボードとして可視化する",
      "経営層・分析担当はブラウザでダッシュボードを開くだけ。SQLを書く必要がない"
    ],
    services: [
      { icon: "services/s3", name: "Amazon S3", role: "各システムから吸い上げた生データの置き場（データレイク）。変換に失敗してもやり直せる原本置き場" },
      { icon: "services/glue", name: "AWS Glue", role: "サーバーレスのETLサービス。生データの整形・結合とRedshiftへのロードをジョブとして実行する" },
      { icon: "services/redshift", name: "Amazon Redshift", role: "DWH本体。列指向ストレージと並列処理で、行指向の通常DBが苦手な大量データ集計を高速にこなす" },
      { icon: "services/quicksight", name: "Amazon QuickSight", role: "BIツール。ダッシュボード作成・共有と、SPICEというインメモリキャッシュによる高速表示を担当" }
    ],
    points: [
      "本番DBと分析基盤を完全に分けることで、重い集計が本番サービスの性能に影響しない。DWHを立てる一番の理由がこれ",
      "S3に生データを必ず残す。変換ロジックを間違えても原本から再実行できる「元データは消さない」がデータ基盤の鉄則",
      "Redshiftは専有クラスタを常時起動すると高額になりやすい。夜間ロード＋日中参照の使い方なら、使った時間だけ課金されるRedshift Serverlessを第一候補にする",
      "QuickSightのSPICE（インメモリキャッシュ）に集計結果を取り込めば、閲覧のたびにRedshiftへクエリが飛ばず、費用と表示速度の両方が改善する"
    ],
    pros: [
      "数TB級まで見据えてスケールできる王道構成",
      "SQLを書けない人でもダッシュボードで自走できる",
      "本番DBと分離されており、分析がサービスに影響しない",
      "S3に原本が残るため、集計のやり直しや新しい分析軸の追加に強い"
    ],
    cons: [
      "登場するサービスが多く、初期構築と学習のコストが高い",
      "Redshiftの費用は正直高い。専有クラスタ常時起動なら月10万円超も普通",
      "日次バッチの運用（ジョブ失敗時の検知・再実行）が必要になる"
    ],
    cost: "<strong>月4万円〜15万円程度</strong>（Redshift Serverlessを1日数時間の集計に使用＋QuickSight作成者2名・閲覧者10名＋データ数百GBの前提）。費用の大半はRedshiftで、専有クラスタを常時起動すると月10万円を超えることも珍しくない。Serverless化と夜間停止が最大の節約ポイント。",
    references: [
      { title: "Amazon Redshift Serverlessとは", url: "https://docs.aws.amazon.com/ja_jp/redshift/latest/mgmt/serverless-whatis.html", note: "使った時間だけ課金されるRedshift" },
      { title: "AWS Glueとは", url: "https://docs.aws.amazon.com/ja_jp/glue/latest/dg/what-is-glue.html" },
      { title: "Amazon QuickSightとは", url: "https://docs.aws.amazon.com/ja_jp/quicksight/latest/user/welcome.html" },
      { title: "SPICEへのデータのインポート", url: "https://docs.aws.amazon.com/ja_jp/quicksight/latest/user/spice.html", note: "工夫点で触れたインメモリキャッシュ" },
      { title: "Amazon Redshiftマネジメントガイド", url: "https://docs.aws.amazon.com/ja_jp/redshift/latest/mgmt/welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "Athena+QuickSight（スモールスタート）",
      when: "データが数十〜数百GBで閲覧頻度も低く、まず低コストで始めたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "s3", icon: "services/s3", label: "S3\nデータレイク", col: 1, row: 0 },
          { id: "athena", icon: "services/athena", label: "Athena\nSQLエンジン", col: 2, row: 0 },
          { id: "catalog", icon: "services/glue", label: "Glue Data\nCatalog", col: 2, row: 1 },
          { id: "qs", icon: "services/quicksight", label: "QuickSight\nBI", col: 3, row: 0 },
          { id: "analyst", icon: "resources/users", label: "分析担当", col: 4, row: 0 }
        ],
        edges: [
          { from: "athena", to: "s3", label: "直接スキャン" },
          { from: "qs", to: "athena", label: "クエリ実行" },
          { from: "analyst", to: "qs", label: "閲覧" },
          { from: "catalog", to: "athena", label: "テーブル定義", dashed: true, noArrow: true }
        ]
      },
      flow: [
        "データはS3に置いたまま動かさない。DWHへのロードという工程自体をなくす",
        "Athena（S3上のファイルに直接SQLを実行できるサーバーレスのクエリサービス）が、必要なときだけデータをスキャンする",
        "Glue Data CatalogがS3上のファイルの「テーブル定義」（列名や型）を管理し、Athenaはそれを見てSQLを解釈する",
        "QuickSightがAthena経由でクエリし、ダッシュボードとして可視化する"
      ],
      services: [
        { icon: "services/athena", name: "Amazon Athena", role: "S3のファイルへ直接SQLを実行。サーバーを持たず、スキャンしたデータ量だけの課金" },
        { icon: "services/s3", name: "Amazon S3", role: "データの保管場所。この構成では保管と分析対象を兼ねる" },
        { icon: "services/glue", name: "AWS Glue Data Catalog", role: "S3上のデータをSQLの「テーブル」として見せるためのメタデータ管理" },
        { icon: "services/quicksight", name: "Amazon QuickSight", role: "BIツール。接続先がRedshiftからAthenaに変わるだけで使い方は同じ" }
      ],
      points: [
        "常時起動のサーバーが1台もないため、クエリしていない時間の費用はS3の保存料だけになる",
        "Athenaはスキャン量に課金される。Parquet（列指向のファイル形式）への変換と日付パーティション分割で、スキャン量＝費用が1桁下がることが多い",
        "同時アクセスや応答速度はRedshiftに劣る。閲覧者が増えたらSPICE取り込みで吸収し、それでも足りなくなったら推奨構成へ昇格する。S3のデータはそのまま使い回せる"
      ],
      pros: [
        "初期費用・待機費用がほぼゼロで、今日から始められる",
        "S3のデータ構成はそのままに、後からRedshiftへ段階的に昇格できる"
      ],
      cons: [
        "クエリ応答は数秒〜数十秒。対話的な深掘り分析にはストレスがある",
        "スキャン量課金のため、雑な全件クエリを繰り返すと思わぬ課金になる"
      ],
      cost: "<strong>月数百円〜1万円程度</strong>（データ数百GB・スキャン月数TB以内＋QuickSightライセンスの前提）。Athenaはスキャン1TBあたり約5USDの完全従量課金で、使わない月はほぼゼロになるのが最大の強み。",
      references: [
        { title: "Amazon Athenaとは", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/what-is.html" },
        { title: "パーティション射影を使用したスキャン削減", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/partition-projection.html", note: "スキャン量＝費用を下げる定石" },
        { title: "Amazon QuickSightとは", url: "https://docs.aws.amazon.com/ja_jp/quicksight/latest/user/welcome.html" }
      ]
    },
    {
      name: "Auroraリードレプリカ+QuickSight（既存DB流用）",
      when: "分析したいデータが既にAurora/RDSにすべて入っていて、数十GB規模で横断集約も不要な場合",
      diagram: {
        cols: 7, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "サービス\n利用者", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "app", icon: "services/ec2", label: "既存Web\nアプリ", col: 3, row: 0 },
          { id: "primary", icon: "services/aurora", label: "Aurora\nプライマリ", col: 4, row: 0 },
          { id: "replica", icon: "services/aurora", label: "Aurora\nリードレプリカ", col: 4, row: 1 },
          { id: "qs", icon: "services/quicksight", label: "QuickSight\nBI", col: 5, row: 1 },
          { id: "analyst", icon: "resources/users", label: "分析担当", col: 6, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "app" },
          { from: "app", to: "primary", label: "読み書き" },
          { from: "primary", to: "replica", label: "自動レプリケーション" },
          { from: "qs", to: "replica", label: "分析クエリ" },
          { from: "analyst", to: "qs", label: "閲覧" }
        ]
      },
      flow: [
        "既存Webアプリはこれまでどおりプライマリ（書き込み担当のDB本体）に読み書きする",
        "Auroraのリードレプリカ（読み取り専用の複製DB）を追加し、プライマリの内容が自動で同期される",
        "QuickSightはVPC接続を使ってプライベートサブネット内のリードレプリカへ分析クエリを投げる",
        "分析担当はQuickSightのダッシュボードを閲覧する。データはほぼリアルタイム"
      ],
      services: [
        { icon: "services/aurora", name: "Amazon Aurora", role: "既存のアプリDB。リードレプリカを追加するだけで分析用の読み取り口を分離できる" },
        { icon: "services/quicksight", name: "Amazon QuickSight", role: "BIツール。VPC接続でプライベートなDBに安全にアクセスする" },
        { icon: "services/ec2", name: "Amazon EC2", role: "既存のWebアプリサーバー。この構成では変更しない" }
      ],
      points: [
        "重い分析クエリをレプリカに逃がし、本番の読み書きへの影響を断つ。この構成の目的はほぼこれに尽きる",
        "QuickSightからVPC内のDBへは「VPC接続」を設定する。DBをインターネットに公開する必要はない",
        "Auroraは行指向DBなので大規模集計は苦手。データが数百GBを超えたり集計が分単位に遅くなってきたら、推奨構成（DWH）への移行を検討するサイン"
      ],
      pros: [
        "新しいデータ基盤もETLも不要で、最短数日で始められる",
        "レプリカ経由なのでデータがほぼリアルタイム"
      ],
      cons: [
        "行指向DBのため大量データの集計性能はDWHに大きく劣る",
        "複数システムのデータを結合する横断分析はできない（DB内のデータに限られる）",
        "レプリカは常時起動のため、使わない夜間も課金される"
      ],
      cost: "<strong>月1.5万円〜4万円程度</strong>（db.r6g.large相当のリードレプリカ1台を追加＋QuickSightライセンスの前提）。既存DBの流用なのでETL開発費はゼロだが、レプリカの常時起動費は固定でかかる。",
      references: [
        { title: "Amazon Auroraのレプリケーション", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/Aurora.Replication.html", note: "リードレプリカの仕組み" },
        { title: "QuickSightからVPC内のデータに接続する", url: "https://docs.aws.amazon.com/ja_jp/quicksight/latest/user/working-with-aws-vpc.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Redshift）は<strong>月4万円〜15万円程度</strong>で、費用の大半をDWHの稼働費が占める。Athena案は<strong>月数百円〜1万円程度</strong>と圧倒的に安く、待機費用がない。Auroraレプリカ案は<strong>月1.5万円〜4万円程度</strong>でETL開発費が不要。判断の分かれ目は「データ量」「閲覧の頻度と同時人数」「横断分析の要否」の3つで、迷ったらAthenaで始めて成長に合わせてRedshiftへ昇格するのが安全。</p>",
  summary: "<p>BIダッシュボードの裏側は「データをどこに集めて、何で集計するか」の選択です。<strong>王道はS3に集めてRedshiftで集計する構成</strong>ですが、DWHは常時稼働費が高いため、規模が小さいうちはAthenaのスキャン課金モデルが合理的です。重要なのは、どの案でも<strong>S3に生データを残しておけば後から乗り換えられる</strong>こと。最初の設計で決め切るのではなく、成長段階に応じて昇格できる形にしておくのがデータ基盤設計の勘所です。</p>"
});
