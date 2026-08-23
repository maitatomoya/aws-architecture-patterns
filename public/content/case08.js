// ケース8：中規模ECサイト
registerCase({
  id: 8,
  category: "Webアプリ・EC",
  title: "中規模ECサイト",
  scenario: "<p>月商数千万円規模のECサイトを自社で運営したい。商品数は数万点、通常時のアクセスは中程度だが、セール開始直後やテレビ紹介時にはアクセスが数十倍に跳ねる。カート・決済・会員情報を扱うため、セキュリティと可用性（止まらないこと）への要求は高い。エンジニアチームは5名程度で、コンテナでの開発経験がある。</p>",
  requirements: [
    "セール時のスパイクアクセス（急激な負荷増）に自動で耐えたい",
    "カート・決済を扱うため、不正アクセス対策（WAF）とHTTPSは必須",
    "DB障害でサイト全体が止まらないよう、可用性を確保したい",
    "商品画像や静的ファイルは高速に配信したい",
    "注文確認メールなどの送信機能が必要",
    "セッションやカート情報は高速に読み書きしたい"
  ],
  main: {
    name: "CloudFront + WAF + ALB + ECS(Fargate) + Aurora + ElastiCache",
    diagram: {
      cols: 7, rows: 3,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 2] },
        { type: "vpc", label: "VPC", from: [2, 0], to: [5, 2], depth: 1 },
        { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 2], depth: 2 }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "購入者", col: 0, row: 1 },
        { id: "waf", icon: "services/waf", label: "AWS WAF", col: 1, row: 0 },
        { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 1 },
        { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
        { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 0 },
        { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 1 },
        { id: "ecs", icon: "services/ecs", label: "ECS(Fargate)\nECアプリ", col: 4, row: 1 },
        { id: "aurora", icon: "services/aurora", label: "Aurora\n注文・会員DB", col: 5, row: 0 },
        { id: "cache", icon: "services/elasticache", label: "ElastiCache\nセッション", col: 5, row: 2 },
        { id: "ses", icon: "services/ses", label: "SES\nメール送信", col: 6, row: 1 }
      ],
      edges: [
        { from: "users", to: "cf", label: "HTTPS" },
        { from: "waf", to: "cf", noArrow: true, dashed: true },
        { from: "cf", to: "igw", label: "オリジン転送" },
        { from: "igw", to: "alb" },
        { from: "alb", to: "ecs", label: "振り分け" },
        { from: "ecs", to: "aurora", label: "SQL" },
        { from: "ecs", to: "cache", label: "キャッシュ" },
        { from: "ecs", to: "ses", label: "メール送信" },
        { from: "ecs", to: "nat", label: "外向き通信", dashed: true }
      ]
    },
    flow: [
      "購入者のリクエストはまずCloudFrontが受け、商品画像などの静的コンテンツはエッジのキャッシュから即返す。WAF（不正リクエストを検査・遮断する門番）はCloudFrontに適用する",
      "カートや注文などの動的リクエストは、VPCの入口であるインターネットゲートウェイを通ってパブリックサブネットのALBへ転送される",
      "ALBがプライベートサブネットのECS(Fargate)コンテナ群へリクエストを振り分ける。負荷に応じてコンテナ数は自動で増減する",
      "アプリは注文・会員データをAuroraに、セッションやカートなど頻繁に読み書きするデータをElastiCacheに保存する",
      "注文確認メールはSESで送信する。プライベートサブネットからの外向き通信（決済代行APIやSESの呼び出し）はパブリックサブネットのNATゲートウェイを経由する"
    ],
    services: [
      { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。商品画像を世界中のエッジでキャッシュ配信し、表示高速化とオリジン負荷削減を担う" },
      { icon: "services/waf", name: "AWS WAF", role: "SQLインジェクションなどの攻撃パターンやBotを検査・遮断するWebアプリケーションファイアウォール" },
      { icon: "services/elb", name: "Application Load Balancer", role: "リクエストを複数のコンテナへ振り分けるロードバランサー。異常なコンテナを自動で切り離す" },
      { icon: "services/ecs", name: "Amazon ECS（Fargate）", role: "ECアプリのコンテナ実行基盤。Fargateはサーバー管理不要でコンテナだけ動かせる起動タイプ" },
      { icon: "services/aurora", name: "Amazon Aurora", role: "注文・会員・在庫を保存するDB。レプリカを別AZに置き、障害時は自動フェイルオーバーする" },
      { icon: "services/elasticache", name: "Amazon ElastiCache", role: "セッション・カートなどをメモリ上で高速に読み書きするキャッシュ。DBの負荷も下げる" },
      { icon: "services/ses", name: "Amazon SES", role: "注文確認・発送通知などのメール送信サービス" },
      { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットのコンテナが決済代行API等へ外向き通信するための出口。外からの侵入は通さない" }
    ],
    points: [
      "アプリのコンテナとDBはすべてプライベートサブネットに置き、インターネットに直接さらすのはCloudFront/ALBだけにする。攻撃対象面（さらけ出す入口）を最小にするのがECの鉄則",
      "セッションをコンテナ内ではなくElastiCacheに外出しすることで、コンテナを自由に増減・入れ替えできる（どのコンテナに当たっても同じカートが見える）。スパイク対応の前提となる設計",
      "Auroraはライター1台+リーダー（読み取り専用レプリカ）を別AZ（データセンター群）に配置。商品閲覧の読み取りをリーダーへ逃がしつつ、障害時は自動で切り替わる",
      "セール前にはECSのタスク数下限を一時的に引き上げておく「事前スケール」も併用する。オートスケールは万能ではなく、急峻すぎるスパイクには立ち上がりが間に合わないことがあるため"
    ],
    pros: [
      "静的配信はCloudFront、動的処理はECSと役割分担され、スパイクに強い",
      "Fargateによりサーバー(EC2)の管理が不要で、コンテナ数の増減も自動",
      "WAF・プライベートサブネット・HTTPSの多層防御で、決済を扱うサイトに必要な守りを確保",
      "AuroraのマルチAZ構成により、DB障害時も自動フェイルオーバーで復旧できる"
    ],
    cons: [
      "登場するサービスが多く、初期構築とネットワーク設計の難易度は高め",
      "ALB・NAT・Aurora・ElastiCacheなど常時起動の固定費が積み上がる",
      "コンテナ・IaC・監視などチームに求められるスキルの幅が広い"
    ],
    cost: "<strong>月5万円〜15万円程度</strong>（Fargate2〜4タスク、Auroraライター+リーダー各1、ElastiCache小型ノード、ALB・NAT・CloudFront・WAF込み、東京リージョンの中規模トラフィックを想定）。セール時はコンテナ増加ぶんが上乗せされる従量部分もある。",
    references: [
      { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html", note: "ECS公式デベロッパーガイド" },
      { title: "AWS Fargate", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html", note: "サーバーレスなコンテナ実行基盤の公式解説" },
      { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
      { title: "AWS WAFとは", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/what-is-aws-waf.html" },
      { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html", note: "プライベートサブネットからの外向き通信の公式解説" }
    ]
  },
  alternatives: [
    {
      name: "EC2 Auto Scaling構成（コンテナ未導入チーム向け）",
      when: "チームにコンテナ経験がなく、慣れたEC2ベースで負荷分散と自動増減を実現したい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [5, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "購入者", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 1 },
          { id: "asg", icon: "services/ec2-auto-scaling", label: "EC2群\nAuto Scaling", col: 4, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nMySQL", col: 5, row: 0 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "alb" },
          { from: "alb", to: "asg", label: "振り分け" },
          { from: "asg", to: "rds", label: "SQL" },
          { from: "asg", to: "nat", dashed: true }
        ]
      },
      flow: [
        "リクエストはインターネットゲートウェイを通り、パブリックサブネットのALBへ届く",
        "ALBはAuto Scalingグループ（負荷に応じてEC2の台数を自動増減する仕組み）内のEC2群へ振り分ける。図の「EC2群」アイコンは複数台のEC2をまとめて表している",
        "各EC2はプライベートサブネットのRDSに接続する。OSアップデート等の外向き通信はNATゲートウェイを経由する",
        "CloudFront・WAF・ElastiCache・SESの層は推奨構成と同様に前後へ追加できる（図では簡略化のため省略）"
      ],
      services: [
        { icon: "services/ec2-auto-scaling", name: "Amazon EC2 Auto Scaling", role: "CPU使用率などの指標に応じてEC2台数を自動で増減させ、スパイクと夜間の無駄の両方に対応する" },
        { icon: "services/elb", name: "Application Load Balancer", role: "EC2群へのリクエスト振り分けと、異常インスタンスの自動切り離し" },
        { icon: "services/ec2", name: "Amazon EC2", role: "ECアプリが動く仮想サーバー。AMI（サーバーの雛形イメージ）から同じ構成の台を量産する" },
        { icon: "services/rds", name: "Amazon RDS（MySQL）", role: "注文・会員データを保存するマネージドDB。マルチAZ配置で冗長化する" }
      ],
      points: [
        "Auto Scalingの前提は「どのEC2も同じ状態にできる」こと。セッションをサーバー内に持たせず、デプロイはAMI更新か自動化ツールで全台同一にする",
        "台数が増減するので、ログはEC2内に置かずCloudWatch Logs等へ集約する。消えるサーバーに大事なものを残さないのが原則",
        "コンテナ経験ゼロのチームが確実に運べる点が最大の価値。ただしOSパッチ・AMI管理という、Fargateなら不要な仕事が残ることは理解しておく"
      ],
      pros: [
        "既存のEC2運用ノウハウをそのまま活かせ、学習コストが低い",
        "OSレイヤーに手が入るため、特殊なミドルウェアやチューニングにも対応できる",
        "Auto Scalingでスパイク対応と夜間縮小の両立は十分可能"
      ],
      cons: [
        "OSパッチ・AMI更新・構成管理という運用負荷が継続的に残る",
        "スケールの単位がコンテナよりも粗く（EC2一台単位）、起動も数分かかるため即応性で劣る",
        "長期的にはコンテナ化した方が開発環境との差異が減り、モダンな運用へ移行しやすい"
      ],
      cost: "<strong>月4万円〜12万円程度</strong>（t3.medium相当×2〜4台＋RDSマルチAZ＋ALB・NAT、東京リージョン）。Fargate構成と大差ないが、AMI管理やパッチ適用の人件費が別途かかると考えるべき。",
      references: [
        { title: "Amazon EC2 Auto Scalingとは", url: "https://docs.aws.amazon.com/ja_jp/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html", note: "Auto Scaling公式ユーザーガイド" },
        { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
        { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html" }
      ]
    },
    {
      name: "フルサーバーレス構成（API Gateway + Lambda + DynamoDB）",
      when: "トラフィックの波が極端に大きい・アイドル時のコストを限りなくゼロに寄せたい・少人数で運用したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "購入者", col: 0, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n静的ファイル", col: 1, row: 0 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront", col: 1, row: 1 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 2, row: 1 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n注文処理等", col: 3, row: 1 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n商品・注文", col: 4, row: 1 },
          { id: "ses", icon: "services/ses", label: "SES\nメール送信", col: 4, row: 0 }
        ],
        edges: [
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "cf", to: "s3", label: "静的配信" },
          { from: "cf", to: "apigw", label: "API" },
          { from: "apigw", to: "lambda" },
          { from: "lambda", to: "ddb", label: "読み書き" },
          { from: "lambda", to: "ses", label: "メール送信" }
        ]
      },
      flow: [
        "フロントエンド（HTML/JS）はS3に置き、CloudFrontが配信する",
        "カート・注文などのAPIリクエストはCloudFront経由でAPI Gatewayに届き、Lambda関数が起動して処理する",
        "商品・注文データはDynamoDB（サーバー管理不要のNoSQL DB）に保存し、注文確認メールはLambdaからSESで送る",
        "この構成にはVPCもゲートウェイ類も登場しない。すべてAWSが運用する公開エンドポイントを持つマネージドサービスで、守るべき自前のネットワークが存在しないため"
      ],
      services: [
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "APIの受付窓口。認証・流量制限・リクエスト検証を担う" },
        { icon: "services/lambda", name: "AWS Lambda", role: "リクエストが来たときだけ起動する関数実行環境。同時アクセス数に応じて自動で並列実行される" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "ミリ秒応答のNoSQL DB。アクセス量に応じた従量課金（オンデマンド）が選べる" },
        { icon: "services/s3", name: "Amazon S3", role: "フロントエンドの静的ファイル置き場" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "静的・動的の両方の入口となるCDN" },
        { icon: "services/ses", name: "Amazon SES", role: "注文確認メールなどの送信" }
      ],
      points: [
        "課金がリクエスト数連動なので、深夜アクセスほぼゼロのECでは固定費型（ALB+ECS常時起動）より大幅に安くなり得る",
        "DynamoDBはSQLのJOINが使えないため、「どんな画面でどう読むか」を先に決めてテーブルを設計する（アクセスパターン駆動）。RDBの感覚のまま移行すると失敗しやすい、この構成最大の学びどころ",
        "在庫の厳密な整合性や複雑な集計・検索はRDBより苦手。決済・在庫だけAurora、それ以外はDynamoDBという併用も現実的な落とし所",
        "Lambdaにはコールドスタート（しばらく呼ばれていない関数の初回起動が遅くなる現象）があり、決済など体感に効くAPIでは対策（事前ウォームや同時実行数の確保）を検討する"
      ],
      pros: [
        "アイドル時のコストがほぼゼロで、スパイクへの追従はプラットフォーム任せにできる",
        "サーバー・OS・ネットワークの管理が不要で、少人数運用に向く",
        "各機能がLambda関数単位に分かれ、部分的な修正・デプロイがしやすい"
      ],
      cons: [
        "DynamoDBのデータ設計はRDBと発想が大きく異なり、学習コストが高い",
        "複雑な検索・集計・トランザクションはRDBほど素直に書けない",
        "コールドスタートやLambdaの実行時間上限など、プラットフォームの制約に設計が縛られる"
      ],
      cost: "<strong>月1万円〜5万円程度</strong>（リクエスト数百万件/月規模の従量課金。アイドル時はほぼゼロ）。トラフィックが読めないほど波が大きいECほど、固定費型より有利になりやすい。",
      references: [
        { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html", note: "API Gateway公式デベロッパーガイド" },
        { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
        { title: "DynamoDBの読み込み/書き込みキャパシティモード", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html", note: "オンデマンド課金の公式解説" }
      ]
    }
  ],
  cost: "<p>推奨構成（CloudFront+WAF+ALB+Fargate+Aurora+ElastiCache）は<strong>月5万円〜15万円程度</strong>で固定費中心。EC2 Auto Scaling案は<strong>月4万円〜12万円程度</strong>と金額は近いが、OS運用の人件費が上乗せされる。フルサーバーレス案は<strong>月1万円〜5万円程度</strong>の従量課金で、アイドル時間が長いほど差が開く。「常時それなりのアクセスがあるならコンテナ固定費型、波が極端ならサーバーレス」がコスト面の大きな判断軸。</p>",
  summary: "<p>中規模ECは「多層防御」と「状態の外出し」を学ぶ絶好の題材です。<strong>インターネットにさらすのはCloudFront/ALBまで、アプリとDBはプライベートサブネットへ</strong>という境界設計と、<strong>セッションをElastiCacheに逃がしてコンテナを使い捨て可能にする</strong>設計は、ECに限らずWebアプリ全般の定石です。チームがコンテナ未経験ならEC2 Auto Scaling案、トラフィックの波が極端ならサーバーレス案と、技術選定はチームスキルとトラフィック特性という2軸で決まることを覚えておきましょう。</p>"
});
