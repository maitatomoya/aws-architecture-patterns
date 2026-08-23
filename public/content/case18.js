// ケース18：Webhook受信基盤
registerCase({
  id: 18,
  category: "サーバーレス・イベント駆動",
  title: "Webhook受信基盤",
  scenario: "<p>決済サービスやチャットツールなど複数の外部SaaSから、Webhook（外部サービスがイベント発生時にこちらのURLへHTTPで通知してくる仕組み）を受け取る基盤を作りたい。決済完了イベントは1件も取りこぼせない。キャンペーン時には通知が普段の数十倍に急増するが、外部サービスは数秒で応答しないと失敗と見なして再送してくる。受けた通知は在庫更新やメール送信など後続処理へつなげる。</p>",
  requirements: [
    "通知の急増時にも取りこぼしなく受信したい",
    "外部サービスへは数秒以内に応答を返したい（受信と処理を分離）",
    "処理に失敗した通知を後から調査・再処理できるようにしたい",
    "同じ通知が2回届いても二重処理しないようにしたい",
    "常時起動サーバーなしで低コストに運用したい"
  ],
  main: {
    name: "API Gateway + SQS + Lambda（バッファリング）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "saas", icon: "resources/internet", label: "外部SaaS", col: 0, row: 0 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 1, row: 0 },
        { id: "sqs", icon: "services/sqs", label: "SQS\nキュー", col: 2, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\n本処理", col: 3, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n処理記録", col: 4, row: 0 },
        { id: "dlq", icon: "services/sqs", label: "SQS\nDLQ", col: 2, row: 1 }
      ],
      edges: [
        { from: "saas", to: "apigw", label: "Webhook送信" },
        { from: "apigw", to: "sqs", label: "直接キュー投入" },
        { from: "sqs", to: "fn", label: "ポーリング取得" },
        { from: "fn", to: "ddb", label: "結果保存" },
        { from: "sqs", to: "dlq", label: "規定回数失敗", dashed: true }
      ]
    },
    flow: [
      "外部SaaSがWebhookをAPI GatewayのURLへ送信する",
      "API GatewayはLambdaを介さずSQS（メッセージを一時的に溜めるキューサービス）へ直接メッセージを投入し、即座に200応答を返す。受信と処理が分離され、急増時も受信側は落ちない",
      "Lambdaがキューからメッセージを取り出し、署名検証と在庫更新などの本処理を自分のペースで実行する",
      "処理結果と受信済みイベントIDをDynamoDBに記録する。規定回数失敗したメッセージはDLQ（デッドレターキュー：失敗分の隔離場所）へ自動退避される"
    ],
    services: [
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "Webhookを受けるHTTPSの受付口。認証・スロットリング（流量制限）も担当" },
      { icon: "services/sqs", name: "Amazon SQS", role: "受信と処理の間のバッファ。急増分をキューに溜めて後続を守る、この構成の主役" },
      { icon: "services/lambda", name: "AWS Lambda", role: "キューからメッセージを取り出して本処理を行う。処理量に応じて並列数が自動調整される" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "処理済みイベントIDと結果の記録先。二重処理の防止（冪等性チェック）にも使う" },
      { icon: "services/sqs", name: "SQSデッドレターキュー", role: "何度リトライしても失敗したメッセージの隔離場所。調査と再処理の起点になる" }
    ],
    points: [
      "API GatewayのAWSサービス統合でSQSへ直接書き込むのが肝。間にLambdaを挟まないため、受信側の同時実行数制限や起動遅延の影響を受けずに応答できる",
      "Webhookは「少なくとも1回」届く前提で設計する。イベントIDをDynamoDBに条件付き書き込みし、既に存在したらスキップする冪等化（同じ入力を何度処理しても結果が同じになる工夫）が必須",
      "DLQには必ずCloudWatchアラームを付け、失敗が溜まったら気づける状態にしておく。「気づいたら決済通知が3日分失われていた」を防ぐ最後の砦",
      "署名検証（通知が本物のSaaSからかをHMACで確認する処理）はLambda側で行う。受付では受け取りに徹し、検証失敗もDLQ相当の場所へ記録して調査可能にする"
    ],
    pros: [
      "急増時はキューが伸びるだけで受信は落ちず、取りこぼしに強い",
      "後続処理の障害中も受信を継続でき、復旧後にキューから再開できる",
      "アイドル時のコストがほぼゼロ",
      "DLQにより失敗の調査・再処理の道筋が標準で手に入る"
    ],
    cons: [
      "処理はキューを介した非同期になるため、通知内容に応じた動的な応答は返せない",
      "API GatewayとSQSの統合設定（マッピングテンプレート等）がやや玄人向け",
      "冪等化の実装を怠ると二重処理事故が起きる（仕組みが自動で防いでくれるわけではない）"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（月100万リクエスト前提。API Gateway約500円+SQS・Lambda・DynamoDBの従量分。無料枠内に収まる規模も多い）。",
    references: [
      { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html" },
      { title: "チュートリアル：API GatewayとAWSサービス統合", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/getting-started-aws-proxy.html", note: "Lambdaを挟まずAWSサービスを直接呼ぶ方法" },
      { title: "LambdaとAmazon SQSの連携", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-sqs.html", note: "キューからの自動ポーリングの公式解説" },
      { title: "SQSデッドレターキュー", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html", note: "失敗メッセージの退避の一次情報" }
    ]
  },
  alternatives: [
    {
      name: "EventBridgeパートナーイベント連携",
      when: "送信元がEventBridge対応SaaS（Stripe・Datadog等のパートナー）で、受け口の実装自体をなくしたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "saas", icon: "resources/internet", label: "対応SaaS\n(パートナー)", col: 0, row: 0 },
          { id: "eb", icon: "services/eventbridge", label: "EventBridge\nイベントバス", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n本処理", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n処理記録", col: 3, row: 0 },
          { id: "sqs", icon: "services/sqs", label: "SQS\n別系統処理", col: 2, row: 1 }
        ],
        edges: [
          { from: "saas", to: "eb", label: "イベント発行" },
          { from: "eb", to: "fn", label: "ルールで振分" },
          { from: "fn", to: "ddb", label: "結果保存" },
          { from: "eb", to: "sqs", label: "別系統へ配信", dashed: true }
        ]
      },
      flow: [
        "対応SaaSがイベントを自社側からEventBridgeのパートナーイベントバスへ直接発行する。こちら側にHTTPの受け口が不要になる",
        "EventBridgeのルール（イベント内容に応じた振り分け条件）が一致したイベントをLambdaへ渡す",
        "決済系はLambda、分析系はSQSへ、といった具合に同じイベントを複数の宛先へ振り分けられる",
        "処理結果はDynamoDBに記録する"
      ],
      services: [
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "SaaSからのイベントを受けるイベントバス。受信・認証・ルーティングをまとめて肩代わりする" },
        { icon: "services/lambda", name: "AWS Lambda", role: "イベントの本処理" },
        { icon: "services/sqs", name: "Amazon SQS", role: "重い処理や別チーム向けにイベントをバッファするターゲットの一例" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "処理結果の記録先" }
      ],
      points: [
        "API Gateway・署名検証・エンドポイント管理が丸ごと不要になる。SaaS側とAWS側で連携を承認するだけで安全な経路ができるのが最大の利点",
        "ルールはイベントのJSON内容でフィルタできるため「金額が1万円以上の決済だけ通知処理へ」のような振り分けをコードなしで実現できる",
        "対応していないSaaSからのWebhookは受けられない。その場合は推奨構成（API Gateway+SQS）と併用するハイブリッドになる",
        "配信失敗に備えてターゲットごとにDLQを設定できる。EventBridge側の再試行と合わせて取りこぼし対策を二重にする"
      ],
      pros: [
        "受け口の実装・運用・署名検証が不要になり、構成が最小になる",
        "イベント内容ベースの柔軟なルーティングを設定だけで実現できる",
        "同じイベントを複数システムへ同時配信できる"
      ],
      cons: [
        "EventBridgeパートナー対応のSaaSでしか使えない",
        "イベント到達の遅延がWebhook直受けよりやや大きくなることがある",
        "イベントバス・ルールの概念に慣れるまで動作の追跡がしにくい"
      ],
      cost: "<strong>月数百円程度</strong>（月100万イベント前提でEventBridge約150円+Lambda・DynamoDBの従量分。API Gateway分がなくなる分だけ推奨構成より安くなりやすい）。",
      references: [
        { title: "EventBridgeでのSaaSパートナーからのイベント受信", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-saas.html", note: "パートナーイベントソースの公式解説" },
        { title: "Amazon EventBridgeとは", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-what-is.html" }
      ]
    },
    {
      name: "ALB + ECS Fargate常駐受信",
      when: "署名検証や同期的な応答生成が重くLambdaの起動遅延が許されない場合や、秒間数千件級の通知を常時受ける場合",
      diagram: {
        cols: 6, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 2] },
          { type: "vpc", label: "VPC", from: [1, 1], to: [3, 2], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [2, 1], to: [2, 2], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 1], to: [3, 1], depth: 2 }
        ],
        nodes: [
          { id: "saas", icon: "resources/internet", label: "外部SaaS", col: 0, row: 1 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 1, row: 1 },
          { id: "alb", icon: "services/elb", label: "ALB", col: 2, row: 1 },
          { id: "ecs", icon: "services/fargate", label: "ECS Fargate\n受信サービス", col: 3, row: 1 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 2, row: 2 },
          { id: "sqs", icon: "services/sqs", label: "SQS\nキュー", col: 4, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n後段処理", col: 5, row: 0 }
        ],
        edges: [
          { from: "saas", to: "igw", label: "Webhook送信" },
          { from: "igw", to: "alb" },
          { from: "alb", to: "ecs", label: "転送" },
          { from: "ecs", to: "sqs", label: "検証済み投入" },
          { from: "sqs", to: "fn", label: "非同期処理" },
          { from: "ecs", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "WebhookはインターネットゲートウェイからパブリックサブネットのALB（L7ロードバランサー）に届く",
        "ALBがプライベートサブネットで常駐するECS Fargateのコンテナへ転送し、コンテナが署名検証と即時応答を数ミリ秒で返す",
        "検証済みメッセージはSQSへ投入し、後段のLambdaが非同期で本処理する（バッファリングの考え方は推奨構成と同じ）",
        "プライベートサブネットからSQS等への外向き通信は、NATゲートウェイ経由でインターネットゲートウェイから出る（破線）"
      ],
      services: [
        { icon: "services/elb", name: "Application Load Balancer", role: "HTTPSの受付口。複数コンテナへの負荷分散とヘルスチェックを担う" },
        { icon: "services/fargate", name: "AWS Fargate（ECS）", role: "常駐の受信サービス。プロセスが起動済みのため応答が速く、重い署名検証も安定してこなせる" },
        { icon: "services/sqs", name: "Amazon SQS", role: "受信と本処理を分離するバッファ" },
        { icon: "services/lambda", name: "AWS Lambda", role: "キューを消化する後段処理" },
        { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットからの外向き通信の出口" }
      ],
      points: [
        "コールドスタート（Lambdaの初回起動遅延）が構造的に存在しないため、応答時間の要件が厳しいWebhook（数百ミリ秒以内に応答必須など）に強い",
        "受信コンテナは検証とキュー投入だけの薄い実装に保つ。重い処理を持たせると、せっかくの受信と処理の分離が崩れる",
        "ECSはVPC内で動くため、この案で初めてVPC・IGW・NATのネットワーク設計が登場する。サーバーレス2案との対比で「どこからネットワーク管理責任が生まれるか」を押さえる",
        "SQSへの通信はVPCエンドポイントに切り替えるとNAT通信料を削減でき、経路もAWS内に閉じる"
      ],
      pros: [
        "常駐プロセスのため応答が速く安定し、レイテンシー要件に強い",
        "秒間数千件級の常時高トラフィックでは、リクエスト課金のAPI Gatewayより割安になることがある",
        "実装言語・ライブラリの自由度が高く、特殊な署名方式にも対応しやすい"
      ],
      cons: [
        "ALB・Fargate・NATの固定費が常にかかり、通知が少ない時間帯も課金される",
        "VPC設計・コンテナのデプロイ運用・スケーリング設定など運用負担が最も重い",
        "急増対応はオートスケーリングの設定次第で、サーバーレスほど自動ではない"
      ],
      cost: "<strong>月1.5万円〜4万円程度</strong>（ALB約3,000円+Fargate 2タスク常駐約3,500円+NATゲートウェイ約6,500円+通信量。トラフィックが少ないなら明確に割高）。",
      references: [
        { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
        { title: "Amazon SQSとは", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html", note: "後段バッファの一次情報" }
      ]
    }
  ],
  cost: "<p>推奨構成（API Gateway+SQS+Lambda）は<strong>月数百円〜数千円</strong>の従量課金で、通知ゼロの日はほぼ0円。EventBridgeパートナー案は受け口が消える分さらに安く<strong>月数百円程度</strong>。ALB+Fargate案は<strong>月1.5万円〜4万円程度</strong>の固定費型で、常時高トラフィックか厳しい応答要件がある場合にのみ採算が合う。</p>",
  summary: "<p>Webhook受信の鉄則は<strong>「受けるだけ受けてすぐ応答し、処理はキューの向こうで行う」</strong>という受信と処理の分離です。外部サービスの再送仕様に振り回されないための構造であり、SQSはその分離を最も安く実現します。送信元がEventBridge対応SaaSなら受け口ごと消せる、応答要件が厳しければ常駐コンテナに寄せる、という判断軸に加えて、どの案でも<strong>冪等化とDLQ監視だけは省略できない</strong>ことを覚えておきましょう。</p>"
});
