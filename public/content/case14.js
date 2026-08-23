// ケース14：サーバーレスREST API
registerCase({
  id: 14,
  category: "サーバーレス・イベント駆動",
  title: "サーバーレスREST API",
  scenario: "<p>モバイルアプリとWebフロントエンドの両方から使うREST APIを新規に作る。エンドポイントは30本ほどで、処理はどれも数百ミリ秒で終わるCRUD（登録・取得・更新・削除）が中心。利用者数はリリース時点では読めず、ゼロに近い日もあれば紹介記事で急増する日もあるかもしれない。バックエンド担当は2名で、インフラ専任はいない。認証はメールアドレス＋パスワードのログインが必要。</p>",
  requirements: [
    "REST APIを素早く構築し、変更を高頻度にデプロイしたい",
    "利用者ゼロの期間のコストを最小化しつつ、急増にも自動で耐えたい",
    "サーバーのOS・ミドルウェア管理をしたくない",
    "ログイン認証（サインアップ・サインイン）を自前実装せず安全に済ませたい",
    "APIの実行ログとエラーを確実に記録したい"
  ],
  main: {
    name: "API Gateway + Lambda + DynamoDB（サーバーレスの王道）",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "client", icon: "resources/client", label: "モバイル/Web\nクライアント", col: 0, row: 0 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway\nREST API", col: 1, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\nビジネスロジック", col: 2, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nデータ保存", col: 3, row: 0 },
        { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 1 },
        { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nログ・監視", col: 2, row: 1 }
      ],
      edges: [
        { from: "client", to: "apigw", label: "HTTPS(REST)" },
        { from: "apigw", to: "fn" },
        { from: "fn", to: "ddb", label: "読み書き" },
        { from: "apigw", to: "cognito", label: "トークン検証", dashed: true },
        { from: "fn", to: "cw", label: "ログ・メトリクス", dashed: true }
      ]
    },
    flow: [
      "クライアントはまずCognito（認証のマネージドサービス）でログインし、アクセストークン（JWT）を受け取る",
      "APIリクエストはトークンを付けてAPI Gatewayへ送られ、API Gatewayがオーソライザー機能でトークンの正当性を検証する（不正ならLambdaに届く前に拒否）",
      "検証を通ったリクエストだけがLambdaを起動し、ビジネスロジックを実行してDynamoDBを読み書きする",
      "実行ログ・エラー・処理時間は自動的にCloudWatchに記録され、しきい値超過でアラームを飛ばせる"
    ],
    services: [
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "REST APIの入口。ルーティング・認証連携・スロットリング（リクエスト数制限）を担う" },
      { icon: "services/lambda", name: "AWS Lambda", role: "エンドポイントごとの処理を実行。リクエスト数に応じて自動で並列実行される" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "データ保存。オンデマンドモードならアクセス量に応じた完全従量課金になる" },
      { icon: "services/cognito", name: "Amazon Cognito", role: "サインアップ・サインイン・トークン発行。パスワード管理を自前実装せずに済む" },
      { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "ログ収集とメトリクス監視。エラー率や実行時間のアラーム設定もここで行う" }
    ],
    points: [
      "認証チェックはLambdaの中ではなくAPI Gatewayのオーソライザーで行う。不正リクエストがLambdaの実行料金を発生させる前に弾け、各エンドポイントの実装から認証コードが消えて見通しも良くなる",
      "DynamoDBはオンデマンドモードで始める。利用が読めない新規サービスでは、キャパシティ予約より「使った分だけ」が事故がない",
      "Lambdaは同時リクエスト数だけ自動で並列起動するため、スパイク対策の設定が実質不要。逆に下流のDBを守るには同時実行数の上限設定を使う",
      "この構成にVPCもゲートウェイ類も無いのは省略ではない。全サービスがVPC外のマネージドサービスで、ネットワーク設計なしでHTTPSのAPIが公開できるのがサーバーレスの利点そのもの"
    ],
    pros: [
      "利用ゼロならコストほぼゼロ、急増すれば自動スケールという理想的な従量課金",
      "OS・ミドルウェアの保守が一切不要で、2名でも開発に集中できる",
      "認証・ログ・監視までマネージドで揃い、セキュリティ事故の典型（パスワード自前管理）を避けられる",
      "エンドポイント単位でデプロイ・ロールバックでき、変更の影響範囲が小さい"
    ],
    cons: [
      "1リクエスト29秒（API Gatewayの上限）・Lambda15分の実行時間制限があり、長時間処理には不向き",
      "コールドスタート（初回起動の数百ミリ秒の遅延）が稀に発生する",
      "エンドポイントが増えるとLambda関数の管理が煩雑になり、IaC（コードでのインフラ管理）がほぼ必須になる",
      "DynamoDBのキー設計はRDBと発想が異なり、慣れるまで設計ミスをしやすい"
    ],
    cost: "<strong>月0円〜数千円</strong>（月100万リクエストでAPI Gateway約520円＋Lambda約100円＋DynamoDBオンデマンド少量。無料枠内なら実質0円で、完全にリクエスト数比例）。",
    references: [
      { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html", note: "API Gateway公式開発者ガイド" },
      { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
      { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html" },
      { title: "Lambdaのクォータ（15分制限など）", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/gettingstarted-limits.html", note: "デメリットで触れた実行時間制限の一次情報" }
    ]
  },
  alternatives: [
    {
      name: "ALB + ECS Fargate（コンテナで常駐API）",
      when: "1リクエストが数十秒〜数分かかる処理がある、WebSocketの常時接続が要る、既存のコンテナ資産・フレームワークをそのまま動かしたい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "client", icon: "resources/client", label: "クライアント", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "alb", icon: "services/elb", label: "ALB\nロードバランサ", col: 3, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 1 },
          { id: "ecs", icon: "services/ecs", label: "ECS(Fargate)\nAPIコンテナ", col: 4, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB", col: 5, row: 0 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ置き場", col: 1, row: 1 }
        ],
        edges: [
          { from: "client", to: "igw", label: "HTTPS" },
          { from: "igw", to: "alb" },
          { from: "alb", to: "ecs", label: "負荷分散" },
          { from: "ecs", to: "ddb", label: "読み書き" },
          { from: "ecs", to: "ecr", label: "イメージ取得", dashed: true },
          { from: "ecs", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "リクエストはインターネットゲートウェイ（VPCの玄関）からパブリックサブネットのALB（L7ロードバランサ）へ入る",
        "ALBがプライベートサブネットで常駐するECS Fargateのコンテナ群へ負荷分散する。Fargateなのでコンテナの土台となるサーバー管理は不要",
        "コンテナはDynamoDB（またはRDS）を読み書きしてレスポンスを返す。常駐プロセスなので長い処理やWebSocketも扱える",
        "起動時のコンテナイメージ取得などVPC外への外向き通信は、パブリックサブネットのNATゲートウェイを経由する"
      ],
      services: [
        { icon: "services/elb", name: "Application Load Balancer", role: "L7（HTTP）の負荷分散とヘルスチェック。異常なコンテナを自動で切り離す" },
        { icon: "services/ecs", name: "Amazon ECS + AWS Fargate", role: "APIコンテナの常駐実行。サーバーレスコンテナなのでEC2の管理が不要" },
        { icon: "services/ecr", name: "Amazon ECR", role: "コンテナイメージの保管庫。デプロイはイメージのpushとサービス更新で行う" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "データ保存。コンテナからはNATゲートウェイまたはVPCエンドポイント経由でアクセスする" }
      ],
      points: [
        "常駐プロセスなのでコールドスタートがなく、実行時間制限もない。Lambdaの制約（29秒/15分）に引っかかる要件が出たらこちらに寄せる",
        "コンテナはプライベートサブネットに置き、入口をALBに一本化する。APIコンテナに直接インターネットから届かせないのがセキュリティの基本形",
        "NATゲートウェイは約5,000円/月の固定費と転送課金がかかる。DynamoDBやS3へのアクセスが主ならVPCエンドポイントに置き換えると安く安全になる",
        "ExpressやSpring Bootなど手元で動くフレームワークをほぼそのままデプロイでき、ローカル開発と本番の差が小さい"
      ],
      pros: [
        "実行時間制限なし・コールドスタートなしで、重い処理や常時接続にも対応",
        "既存フレームワーク・コンテナ資産をそのまま使えて移植コストが低い",
        "CPU・メモリをタスク単位で細かく指定でき、性能の予測が立てやすい"
      ],
      cons: [
        "最低1コンテナ＋ALB＋NATの常駐固定費がかかり、利用ゼロでも月1万円前後かかる",
        "VPC・サブネット・セキュリティグループの設計と管理が必要",
        "スケールはオートスケーリング設定次第で、Lambdaほど瞬間的な追従はしない"
      ],
      cost: "<strong>月1万円〜2万円程度</strong>（ALB約2,500円＋Fargate 0.25vCPU×2タスク常駐約6,000円＋NATゲートウェイ約5,000円＋転送量。アクセスゼロでもこの固定費が発生する）。",
      references: [
        { title: "AWS Fargateとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html", note: "ECS公式開発者ガイド" },
        { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html", note: "外向き通信の要。固定費の把握にも" }
      ]
    },
    {
      name: "App Runner（コンテナを最速で公開）",
      when: "コンテナで作りたいがVPCやALBの設計はしたくない、とにかく最小の手数でHTTPSのAPIを公開したい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "利用者", col: 0, row: 0 },
          { id: "apprunner", icon: "services/app-runner", label: "App Runner\nAPIコンテナ", col: 1, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB", col: 2, row: 0 },
          { id: "dev", icon: "resources/client", label: "開発者", col: 0, row: 1 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ置き場", col: 1, row: 1 }
        ],
        edges: [
          { from: "users", to: "apprunner", label: "HTTPS" },
          { from: "apprunner", to: "ddb", label: "読み書き" },
          { from: "dev", to: "ecr", label: "イメージpush" },
          { from: "ecr", to: "apprunner", label: "自動デプロイ", dashed: true }
        ]
      },
      flow: [
        "開発者がコンテナイメージをECRへpushすると、App Runnerが検知して自動デプロイする（GitHub連携でソースから直接ビルドも可能）",
        "App RunnerがHTTPSエンドポイント・負荷分散・オートスケールをまとめて面倒を見る。ALBやVPCの設定は一切不要",
        "APIコンテナはDynamoDBを読み書きしてレスポンスを返す",
        "リクエストが来ない間はコンテナのCPUが割り当て停止になり、費用が下がる（完全ゼロにはならない）"
      ],
      services: [
        { icon: "services/app-runner", name: "AWS App Runner", role: "コンテナWebアプリのフルマネージド実行環境。HTTPS・スケール・負荷分散を内蔵" },
        { icon: "services/ecr", name: "Amazon ECR", role: "コンテナイメージの保管庫。pushをトリガーに自動デプロイできる" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "データ保存。従量課金でApp Runnerと相性が良い" }
      ],
      points: [
        "「ALB+ECSの構成図がまるごと1つの箱になったもの」と捉えると分かりやすい。VPC・サブネット・ロードバランサの設計を学ぶ前でもコンテナAPIを公開できる",
        "アイドル時はメモリ分のみ課金される仕組みで、常駐コンテナ（Fargate）より小規模時のコストが下がる",
        "細かいネットワーク制御・サイドカー・複数コンテナ構成など凝った要件が出たら、ECS Fargateへの移行を検討する。ECRにイメージがある限り移行は比較的スムーズ",
        "図にゲートウェイ類が無いのは、App RunnerがAWS管理のネットワークで動き、利用者のVPCを使わないため（VPC内リソースへの接続が必要な場合のみVPCコネクタを追加する）"
      ],
      pros: [
        "コンテナAPIを最小の設定で公開でき、学習コストが最も低い",
        "HTTPS証明書・スケーリング・デプロイパイプラインが標準装備",
        "アイドル時はコストが下がる（Fargate常駐より小規模向き）"
      ],
      cons: [
        "カスタマイズの自由度が低い（WebSocket不可・細かいネットワーク制御不可など）",
        "アイドル時もメモリ課金が続くため、完全ゼロにはならない（Lambdaとの違い）",
        "大規模・複雑化したときはECS/EKSへの移行が前提になる"
      ],
      cost: "<strong>月1,500円〜1万円程度</strong>（1vCPU/2GBの1インスタンスで、アイドル中心なら約1,500円、常時アクティブで約8,500円。リクエスト量に応じてこの間を推移する）。",
      references: [
        { title: "AWS App Runnerとは", url: "https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/what-is-apprunner.html", note: "App Runner公式開発者ガイド" },
        { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（サーバーレス）は<strong>月0円〜数千円</strong>で完全リクエスト比例。ALB+Fargate案は利用ゼロでも<strong>月1万円〜2万円程度</strong>の固定費がかかる代わりに実行時間制限がない。App Runner案はその中間で<strong>月1,500円〜1万円程度</strong>。「アイドル時にいくら払うか」が3案を分ける軸になる。</p>",
  summary: "<p>API Gateway + Lambda + DynamoDBは<strong>サーバーレスの最重要パターン</strong>で、以降のイベント駆動系ケースすべての土台になります。選定の分岐は明確で、処理が短時間・トラフィックが読めない・運用人員が少ないならサーバーレス一択。逆に<strong>「29秒/15分の制限」「コールドスタート」「常時接続」のどれかに引っかかった瞬間がコンテナ（ECS Fargate）を検討する合図</strong>です。その中間としてApp Runnerという「コンテナの手軽さ枠」があることも覚えておくと、チームのスキルセットに合わせた現実的な提案ができます。</p>"
});
