// ケース13：オンラインゲームのバックエンド
registerCase({
  id: 13,
  category: "Webアプリ・EC",
  title: "オンラインゲームのバックエンド",
  scenario: "<p>スマホ・PC向けのマルチプレイ対戦ゲームを開発している。プレイヤー同士をマッチングして専用のゲームサーバーに接続させ、対戦中は低遅延で通信したい。プレイヤーの戦績・所持アイテムは永続保存し、ランキングはリアルタイムに更新して表示する。リリース直後やイベント時はプレイヤー数が数十倍に跳ね、深夜は大きく減る。ゲームサーバーのインフラ運用に人手は割きたくない。</p>",
  requirements: [
    "対戦セッション用のゲームサーバーを自動で確保・スケールさせたい",
    "対戦中の通信は低遅延（リアルタイム性）が最優先",
    "プレイヤーデータ（戦績・アイテム）は高速かつ確実に永続化したい",
    "ランキングをリアルタイムに集計・表示したい",
    "時間帯・イベントによる急激な同時接続数の増減に耐えたい"
  ],
  main: {
    name: "Amazon GameLift + DynamoDB + ElastiCache",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
        { type: "vpc", label: "VPC", from: [3, 1], to: [4, 1], depth: 1 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
      ],
      nodes: [
        { id: "client", icon: "resources/mobile-client", label: "ゲーム\nクライアント", col: 0, row: 1 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway\nバックエンドAPI", col: 1, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\nマッチメイキング", col: 2, row: 0 },
        { id: "gamelift", icon: "services/gamelift", label: "GameLift\nゲームサーバー群", col: 2, row: 1 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n戦績・アイテム", col: 4, row: 0 },
        { id: "cache", icon: "services/elasticache", label: "ElastiCache\nランキング", col: 4, row: 1 }
      ],
      edges: [
        { from: "client", to: "apigw", label: "マッチング要求" },
        { from: "apigw", to: "fn" },
        { from: "fn", to: "gamelift", label: "セッション割当" },
        { from: "client", to: "gamelift", label: "ゲーム通信(UDP)" },
        { from: "gamelift", to: "ddb", label: "プレイヤーデータ" },
        { from: "gamelift", to: "cache", label: "スコア更新" }
      ]
    },
    flow: [
      "クライアントがAPI Gateway経由のバックエンドAPIに「対戦したい」とリクエストし、LambdaがGameLiftのマッチメイキング機能（FlexMatch）に問い合わせる",
      "GameLiftが実力の近いプレイヤーを組み合わせ、空いているゲームサーバー（ゲームセッション）を割り当ててIPアドレスとポートを返す",
      "クライアントは以降そのゲームサーバーへ直接UDPで接続し、対戦中の位置・操作情報を低遅延でやり取りする（HTTPを経由しないのがポイント）",
      "対戦結果が出ると、ゲームサーバーがDynamoDBへ戦績・アイテムを永続保存する",
      "同時にElastiCacheのソート済みセット（スコア順に並ぶデータ構造）を更新し、ランキングを常に最新の状態に保つ"
    ],
    services: [
      { icon: "services/gamelift", name: "Amazon GameLift", role: "対戦用ゲームサーバーのホスティング専用サービス。サーバーの起動・配置・スケールとマッチメイキングを担う" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "戦績・所持アイテムの永続保存。1桁ミリ秒の応答で、プレイヤー数が跳ねても自動スケールする" },
      { icon: "services/elasticache", name: "Amazon ElastiCache", role: "インメモリ（メモリ上で動く超高速データストア）のランキング集計。ソート済みセットで上位表示が一瞬で取れる" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "マッチング要求・戦績取得などゲーム外のAPIの入口" },
      { icon: "services/lambda", name: "AWS Lambda", role: "マッチング要求の受付やログイン処理などのバックエンドロジック" }
    ],
    points: [
      "対戦中の通信をHTTPのAPIに通さず、割り当てられたゲームサーバーへ直接UDP接続させるのが低遅延の要。APIは「対戦の前後」だけを担当する役割分担にする",
      "ランキングは「書き込みが激しく、常にスコア順で読む」データなのでDynamoDBよりElastiCacheが適任。永続データはDynamoDB、瞬間的な集計はElastiCacheという使い分けが定石",
      "GameLiftのゲームサーバー群はAWS管理のVPCで動くため、自分のVPCに描くのはElastiCacheだけでよい。接続はVPCピアリング（VPC同士を私設接続する仕組み）などで確保する。インターネットゲートウェイが無いのは、プレイヤーからの通信がGameLiftの公開エンドポイントに直接届き、自前VPCへのインターネット入口が不要なため",
      "イベント時のスパイクにはGameLiftのフリート（サーバー群）の自動スケーリングで対応し、待機サーバー数を需要予測に合わせて調整してコストを絞る"
    ],
    pros: [
      "ゲームサーバーの配置・スケール・マッチメイキングという難所を専用サービスに任せられる",
      "スポットインスタンス活用（GameLiftの機能）でサーバー費用を大きく削減できる",
      "永続化とランキングを適材適所のデータストアに分けており、プレイヤー急増にも耐えやすい"
    ],
    cons: [
      "GameLiftのSDKをゲームサーバーに組み込む実装が必要で、学習コストがある",
      "ゲームサーバーは常時ある程度待機させるため、完全な従量課金にはならない",
      "ElastiCacheはVPC内のサービスであり、ネットワーク設計（ピアリング等）の知識が必要になる"
    ],
    cost: "<strong>月1.5万円〜数十万円</strong>（最小フリート1台＋ElastiCache最小ノード＋DynamoDB少量で月1.5万円前後。同時接続数に比例してゲームサーバー台数分が増える。スポット利用で圧縮可能）。",
    references: [
      { title: "Amazon GameLiftとは", url: "https://docs.aws.amazon.com/ja_jp/gamelift/latest/developerguide/gamelift-intro.html", note: "GameLift公式開発者ガイド" },
      { title: "GameLift FlexMatchとは", url: "https://docs.aws.amazon.com/ja_jp/gamelift/latest/flexmatchguide/match-intro.html", note: "マッチメイキング機能の公式ガイド" },
      { title: "Amazon ElastiCacheとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonElastiCache/latest/dg/WhatIs.html" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "API Gateway WebSocket + Lambda（ターン制・カジュアル向け）",
      when: "将棋・カードゲームなどターン制で、ミリ秒単位の低遅延よりもサーバーレスの手軽さ・低コストを優先する場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "p1", icon: "resources/mobile-client", label: "プレイヤー1", col: 0, row: 0 },
          { id: "ws", icon: "services/api-gateway-websocket", label: "API Gateway\nWebSocket", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\nゲームロジック", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n接続ID・盤面", col: 3, row: 0 },
          { id: "p2", icon: "resources/mobile-client", label: "プレイヤー2", col: 0, row: 1 }
        ],
        edges: [
          { from: "p1", to: "ws", label: "WebSocket接続" },
          { from: "ws", to: "fn", label: "メッセージ毎に起動" },
          { from: "fn", to: "ddb", label: "対戦状態を保存" },
          { from: "ws", to: "p2", label: "手番をプッシュ配信", dashed: true }
        ]
      },
      flow: [
        "両プレイヤーがAPI GatewayのWebSocket API（サーバーからも送信できる常時接続）につなぎ、接続IDがDynamoDBに保存される",
        "プレイヤー1が手を打つと、そのメッセージごとにLambdaが起動してルール判定を行い、盤面の状態をDynamoDBに保存する",
        "Lambdaが対戦相手の接続IDを引き、API Gatewayの管理APIを通じてプレイヤー2へ手番をプッシュ配信する",
        "常駐するゲームサーバーは存在せず、メッセージが飛んだ瞬間だけ課金される"
      ],
      services: [
        { icon: "services/api-gateway-websocket", name: "API Gateway WebSocket API", role: "常時接続の維持とサーバー側からのプッシュ送信を担う。接続管理をマネージドに任せられる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "1メッセージ＝1起動でルール判定・状態更新を行うゲームロジック" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "WebSocketの接続IDと対戦の状態（盤面・手番）を保存。サーバーが状態を持たない構成の要" }
      ],
      points: [
        "Lambdaは起動のたびに記憶が消える（ステートレス）ため、盤面や手番の状態はすべてDynamoDBに置く。「状態はDBへ、計算はLambdaへ」がこの構成の合言葉",
        "WebSocketの$connect/$disconnect/$defaultという3種のルートに処理を割り当てるだけで、接続管理の面倒な部分をAWSに任せられる",
        "1秒間に何十回も位置情報を交換するアクション対戦には向かない。ターン制・チャット・通知など「イベントがたまに飛ぶ」通信に絞って採用する",
        "サーバーレス構成のためVPCもゲートウェイ類も登場せず、インフラ運用がほぼゼロになる"
      ],
      pros: [
        "プレイヤーゼロの時間帯はコストもほぼゼロ（フル従量課金）",
        "ゲームサーバーの実装・運用が不要で、小規模チームでも作り切れる",
        "接続数の急増もマネージド側が自動で吸収する"
      ],
      cons: [
        "リアルタイムアクション級の低遅延・高頻度通信には不向き",
        "UDPは使えない（WebSocketはTCPベース）",
        "1接続2時間でWebSocketが切断される等の制限があり、再接続処理の実装が必要"
      ],
      cost: "<strong>月数百円〜数千円</strong>（100万メッセージあたり約150円＋接続時間課金＋Lambda/DynamoDB少量。小規模タイトルなら無料枠内も現実的）。",
      references: [
        { title: "API GatewayのWebSocket API", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-websocket-api.html", note: "WebSocket APIの公式ガイド" },
        { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
      ]
    },
    {
      name: "EKS + ElastiCacheで自前リアルタイムサーバー",
      when: "独自プロトコルや特殊なサーバー構成が必要で、コンテナ運用の専門チームを持てる場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [5, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "client", icon: "resources/mobile-client", label: "ゲーム\nクライアント", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "nlb", icon: "services/elb", label: "NLB\n(L4ロードバランサ)", col: 3, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 1 },
          { id: "eks", icon: "services/eks", label: "EKS\nゲームサーバー", col: 4, row: 0 },
          { id: "cache", icon: "services/elasticache", label: "ElastiCache\n対戦状態", col: 5, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n戦績・アイテム", col: 1, row: 1 }
        ],
        edges: [
          { from: "client", to: "igw", label: "ゲーム通信" },
          { from: "igw", to: "nlb" },
          { from: "nlb", to: "eks", label: "低遅延で転送" },
          { from: "eks", to: "cache", label: "対戦状態を共有" },
          { from: "eks", to: "ddb", label: "戦績を永続保存" },
          { from: "eks", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "クライアントの通信はインターネットゲートウェイ（VPCの玄関）を通り、NLB（L4=トランスポート層で振り分ける低遅延ロードバランサ）へ届く",
        "NLBがプライベートサブネットのEKS上で動くゲームサーバーコンテナ（Pod）へ接続を転送する",
        "各ゲームサーバーは対戦のセッション状態をElastiCacheで共有し、サーバー障害時も別Podが引き継げるようにする",
        "対戦結果はVPC外のDynamoDBへ永続保存する",
        "コンテナイメージ取得などの外向き通信は、パブリックサブネットのNATゲートウェイ経由で行う"
      ],
      services: [
        { icon: "services/eks", name: "Amazon EKS", role: "Kubernetesのマネージドサービス。ゲームサーバーコンテナの配置・自動復旧・スケールを担う" },
        { icon: "services/elb", name: "Network Load Balancer", role: "L4（TCP/UDP）で振り分ける低遅延ロードバランサ。UDP対応がゲーム用途の決め手" },
        { icon: "services/elasticache", name: "Amazon ElastiCache", role: "対戦セッション状態の共有とランキング。複数サーバー間の共有メモリの役割" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "戦績・アイテムの永続保存。VPC外のマネージドサービス" }
      ],
      points: [
        "ALBではなくNLBを選ぶのは、ゲームで多用するUDPを振り分けられてレイテンシも小さいから。L7機能（パスルーティング等）が不要ならL4で十分",
        "Kubernetesのゲームサーバー運用にはAgonesなどのオープンソース基盤を載せるのが実務の定番。GameLiftが担う「セッション管理」を自前で作ることになる",
        "ゲームサーバーPodはプライベートサブネットに置き、外からの入口はNLB経由に限定する。イメージ取得などの外向き通信はNATゲートウェイに集約する",
        "EKSはコントロールプレーン費用が常にかかるため、小規模タイトルではオーバースペックになりやすい。専任の運用体制が持てるかで判断する"
      ],
      pros: [
        "プロトコル・サーバー構成・スケール戦略まで完全に自由に設計できる",
        "GameLift非対応の特殊要件（独自マッチング・専用ハードウェア相当の構成など）にも対応できる",
        "Kubernetesの資産（監視・デプロイの仕組み）を他システムと共通化できる"
      ],
      cons: [
        "セッション管理・スケール・障害復旧をすべて自前で設計する必要があり、難易度が高い",
        "EKSコントロールプレーン＋ノード＋NLB＋NATと固定費の部品が多い",
        "Kubernetesの運用スキルを持つメンバーが必須"
      ],
      cost: "<strong>月3万円〜</strong>（EKSコントロールプレーン約1.1万円＋最小ノード群＋NLB＋NATゲートウェイ約5,000円＋ElastiCache。規模に応じてノード数分が増える）。",
      references: [
        { title: "Amazon EKSとは", url: "https://docs.aws.amazon.com/ja_jp/eks/latest/userguide/what-is-eks.html", note: "EKS公式ユーザーガイド" },
        { title: "Network Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/network/introduction.html", note: "NLB公式ガイド" },
        { title: "Amazon ElastiCacheとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonElastiCache/latest/dg/WhatIs.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（GameLift）は<strong>月1.5万円〜</strong>で同時接続数に比例して増加（スポット利用で圧縮可）。WebSocket+Lambda案はターン制に限られる代わりに<strong>月数百円〜数千円</strong>と桁違いに安い。EKS自前運用案は<strong>月3万円〜</strong>の固定費に加えて運用人件費が実質最大のコストになる。</p>",
  summary: "<p>ゲームバックエンドの設計は<strong>「対戦中のリアルタイム通信」と「対戦前後のAPI」を分離する</strong>のが出発点です。前者は低遅延が命なのでゲームサーバーへの直接接続（UDP）、後者は普通のサーバーレスAPIで十分。リアルタイム性の要求水準がそのまま構成選定になり、アクション級ならGameLift、ターン制ならWebSocket+Lambda、特殊要件と運用体制があるならEKS自前、と分かれます。またデータ層では<strong>永続データはDynamoDB・瞬間的な共有状態やランキングはElastiCache</strong>という使い分けが、ゲームに限らず高トラフィックシステム全般で使える定石です。</p>"
});
