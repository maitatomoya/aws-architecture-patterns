// ケース25：サイト内検索基盤
registerCase({
  id: 25,
  category: "データ・分析",
  title: "サイト内検索基盤",
  scenario: "<p>数万点の商品を扱うECサイト。商品データはDynamoDBで管理しているが、現状の検索は商品IDやカテゴリの完全一致のみで、「キーワードで探せない」「表記ゆれ（例：Tシャツ/ティーシャツ）で見つからない」という不満が多い。検索結果の関連度順表示や、商品情報更新の即時反映も求められている。セール時のアクセス急増にも耐えたい。</p>",
  requirements: [
    "キーワードの部分一致・表記ゆれを含む全文検索がしたい",
    "検索結果は関連度順に並べ、1秒以内に返したい",
    "商品情報の更新が数秒〜数十秒で検索結果に反映されること",
    "元データ（DynamoDB）と既存アプリの構成は大きく変えたくない",
    "セール時のアクセス急増に耐えること"
  ],
  main: {
    name: "OpenSearch+Lambdaインデクサの検索基盤",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n商品データ", col: 2, row: 0 },
        { id: "lidx", icon: "services/lambda", label: "Lambda\nインデクサ", col: 3, row: 0 },
        { id: "users", icon: "resources/users", label: "サイト\n利用者", col: 0, row: 1 },
        { id: "apigw", icon: "services/api-gateway", label: "API\nGateway", col: 1, row: 1 },
        { id: "lsearch", icon: "services/lambda", label: "Lambda\n検索API", col: 2, row: 1 },
        { id: "os", icon: "services/opensearch", label: "OpenSearch\n検索エンジン", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "apigw", label: "検索リクエスト" },
        { from: "apigw", to: "lsearch" },
        { from: "lsearch", to: "os", label: "全文検索クエリ" },
        { from: "ddb", to: "lidx", label: "Streams通知" },
        { from: "lidx", to: "os", label: "索引を更新" }
      ]
    },
    flow: [
      "商品データの正本（Source of Truth：信頼できる唯一の元データ）はこれまでどおりDynamoDBに置く",
      "DynamoDB Streams（テーブルへの変更履歴を時系列で流す機能）が商品の追加・更新を検知し、Lambdaインデクサを自動起動する",
      "インデクサがOpenSearchの検索インデックスを更新する。商品更新から数秒で検索に反映される",
      "利用者の検索リクエストはAPI Gateway→検索用Lambdaを経由し、OpenSearchへ全文検索クエリとして送られる",
      "OpenSearchが形態素解析（日本語を単語単位に分割する処理）済みのインデックスから、関連度順の結果を高速に返す"
    ],
    services: [
      { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "全文検索エンジン。表記ゆれ対応・関連度順ソート・絞り込みの本体" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "商品データの正本。Streamsで変更をリアルタイムに通知する" },
      { icon: "services/lambda", name: "AWS Lambda", role: "2役。Streamsを受けてインデックスを更新するインデクサと、検索クエリを組み立てる検索API" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "検索APIの公開口。認証やスロットリング（流量制限）も担う" }
    ],
    points: [
      "「正本はDynamoDB、検索はOpenSearch」と役割を分けるのが核。検索インデックスは壊れても正本から再構築できるため、障害復旧の考え方が単純になる",
      "Streams+Lambdaの同期は非同期なので数秒の遅延は必ずある。在庫の最終確認など完全一致で十分な処理はDynamoDBへ直接問い合わせる、と使い分ける",
      "日本語検索の品質はアナライザー（kuromojiなどの形態素解析設定）でほぼ決まる。表記ゆれは同義語辞書で吸収する",
      "OpenSearchには常時起動費がかかる。検索がサービスの主要機能でないなら、まず代替案から始めて成長後に移行する判断も十分あり得る"
    ],
    pros: [
      "表記ゆれ・関連度順・ファセット絞り込みなど本格的な検索体験を提供できる",
      "商品更新が数秒で検索結果に反映される",
      "検索の負荷が正本DB（DynamoDB）に一切影響しない",
      "検索・インデックス更新ともサーバーレス部分は自動スケールする"
    ],
    cons: [
      "OpenSearchドメインの常時起動費と運用（バージョンアップ・監視）が必要",
      "インデックス設計・アナライザー設定の学習コストが高い",
      "正本とインデックスの二重管理になり、不整合時の再構築手順を用意しておく必要がある"
    ],
    cost: "<strong>月1.5万円〜5万円程度</strong>（データノード2〜3台の小型OpenSearchドメイン＋Lambda・API Gatewayの従量課金の前提）。支配的なのはOpenSearchのノード費用で、検索が少ない月でも安くならない固定費である点は正直に見込んでおく。",
    references: [
      { title: "Amazon OpenSearch Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/what-is.html" },
      { title: "DynamoDB Streamsによる変更のキャプチャ", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Streams.html", note: "インデクサ起動の仕組み" },
      { title: "LambdaでDynamoDB Streamsを処理する", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-ddb.html" },
      { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "RDSの全文検索機能（小規模・既存DB流用）",
      when: "既にRDS（PostgreSQL等）を使っていて、商品数が数万件程度・検索要件もシンプルな場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "サイト\n利用者", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "app", icon: "services/ec2", label: "既存アプリ\nサーバー", col: 3, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nPostgreSQL", col: 4, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "検索リクエスト" },
          { from: "igw", to: "app" },
          { from: "app", to: "rds", label: "全文検索SQL" }
        ]
      },
      flow: [
        "検索リクエストは既存のアプリサーバーがそのまま受ける。新しいコンポーネントは増やさない",
        "PostgreSQLの全文検索機能（tsvectorやpg_trgm拡張）で商品テーブルにインデックスを張り、SQLで検索する",
        "データと検索が同じDBに同居するため、同期処理そのものが不要になる"
      ],
      services: [
        { icon: "services/rds", name: "Amazon RDS（PostgreSQL）", role: "商品データと検索インデックスが同居。tsvector/pg_trgmで日本語の部分一致検索に対応" },
        { icon: "services/ec2", name: "Amazon EC2", role: "既存のアプリサーバー。検索SQLを組み立てて投げるだけ" }
      ],
      points: [
        "新しいミドルウェアを増やさないのが最大の利点。データ同期・二重管理・再構築手順といった悩みが最初から存在しない",
        "pg_trgm（文字を3文字ずつの組に分けて類似検索する拡張）を使うと、日本語の部分一致にもインデックスが効く",
        "検索が重くなると商品の読み書きと同じDBを圧迫する。遅くなってきたら、リードレプリカ分離→OpenSearch移行、と段階的に育てるのが現実的な道筋"
      ],
      pros: [
        "追加費用がほぼゼロで、構成が最小",
        "同期遅延や不整合の考慮が一切不要"
      ],
      cons: [
        "関連度順・同義語・ゆらぎ吸収などの検索品質は専用エンジンに明確に劣る",
        "検索負荷とサービス本体の負荷が同じDBに同居する"
      ],
      cost: "<strong>追加費用ほぼゼロ〜月数千円</strong>（既存RDSへのインデックス追加のみ。負荷増でインスタンスを1段上げるとその分の増額）。検索専用の固定費を持たない点が推奨構成との最大の違い。",
      references: [
        { title: "Amazon RDS for PostgreSQL", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html" },
        { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html" }
      ]
    },
    {
      name: "DynamoDBのキー設計で絞り込み",
      when: "「カテゴリで絞る」「新着順で並べる」など検索条件が固定的で、あいまい検索が不要な場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "サイト\n利用者", col: 0, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API\nGateway", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n検索API", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nGSI設計", col: 3, row: 0 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "絞り込み検索" },
          { from: "apigw", to: "fn" },
          { from: "fn", to: "ddb", label: "GSIで検索" }
        ]
      },
      flow: [
        "利用者の絞り込みリクエストをAPI Gateway経由でLambdaが受ける",
        "LambdaはDynamoDBのGSI（グローバルセカンダリインデックス：別のキーで検索できる複製インデックス）に対してQueryを実行する",
        "「カテゴリ×価格帯」「カテゴリ×新着順」など、事前に設計したパターンの絞り込みをミリ秒で返す"
      ],
      services: [
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "正本兼検索役。GSIの設計次第で決まったパターンの絞り込みを高速にこなす" },
        { icon: "services/lambda", name: "AWS Lambda", role: "リクエストをQueryに変換する薄いAPI層" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "検索APIの公開口" }
      ],
      points: [
        "DynamoDBは「どう検索するか」を先に決めてキーを設計するDB。ソートキーやGSIに「カテゴリ#価格」のような複合値を入れて範囲検索する、が定石",
        "部分一致・表記ゆれ・関連度順は原理的にできない。この案でカバーできる要件かどうかを最初に線引きすることが一番重要",
        "検索パターンが増えるたびにGSIを追加すると書き込み費用とストレージが増える。パターンが3〜4を超えて増え続けるなら検索エンジン導入のサイン"
      ],
      pros: [
        "追加ミドルウェアなし・ミリ秒応答・完全な自動スケールで、セール時にも強い",
        "費用が従量制で非常に安い"
      ],
      cons: [
        "全文検索・あいまい検索は原理的に不可",
        "後から検索パターンを増やす変更に弱い（キー設計のやり直しになり得る）"
      ],
      cost: "<strong>月数百円〜数千円</strong>（GSIの追加ストレージと読み書き分のみ。オンデマンド課金ならアクセスがない時間は保存料だけ）。3案の中で最安かつ最もスケールするが、できる検索の幅と引き換え。",
      references: [
        { title: "グローバルセカンダリインデックス（GSI）", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/GSI.html" },
        { title: "DynamoDB設計のベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/best-practices.html", note: "キー設計の考え方" }
      ]
    }
  ],
  cost: "<p>推奨構成（OpenSearch）は<strong>月1.5万円〜5万円程度</strong>で、検索品質と引き換えに常時起動の固定費を払う。RDS全文検索案は<strong>追加ほぼゼロ〜月数千円</strong>、DynamoDBキー設計案は<strong>月数百円〜数千円</strong>。「あいまい検索・関連度順が本当に必要か」が費用を1桁分ける判断点で、必要になった時点でOpenSearchを足す段階的な進め方が現実的。</p>",
  summary: "<p>サイト内検索は「検索要件の複雑さ」と「払う固定費」のトレードオフで構成が決まります。<strong>完全一致や固定パターンの絞り込みならDBのキー設計や全文検索機能で十分</strong>で、表記ゆれ・関連度順といった検索「体験」が売上に効く段階になって初めてOpenSearchの固定費を払う価値が出ます。また、検索エンジンを入れる場合の「正本と検索インデックスを分け、Streamsで同期する」形は、キャッシュや分析基盤にも通じるデータ複製設計の基本形として覚えておく価値があります。</p>"
});
