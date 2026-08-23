// ケース39：リアルタイムチャット
registerCase({
  id: 39,
  category: "IoT・リアルタイム",
  title: "リアルタイムチャット",
  scenario: "<p>自社のWebサービスに1対1チャットとグループチャットを追加したい。メッセージは相手に即時プッシュ配信し、履歴も保存して後から読めるようにする。同時接続はサービス成長にあわせて数百〜数千を想定。モバイルとWebの両方に対応する。開発エンジニアは2名でインフラ専任はおらず、常時接続サーバーの運用は避けたい。</p>",
  requirements: [
    "メッセージを1秒以内に相手へプッシュ配信したい",
    "同時接続数百〜数千のWebSocket（常時接続）を支えたい",
    "メッセージ履歴を保存し、後から取得できるようにしたい",
    "接続断からの再接続を前提とした設計にしたい",
    "常時接続サーバーの運用・スケーリング管理を避けたい"
  ],
  main: {
    name: "API Gateway WebSocket + Lambda + DynamoDB",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "userA", icon: "resources/mobile-client", label: "利用者A", col: 0, row: 0 },
        { id: "userB", icon: "resources/mobile-client", label: "利用者B", col: 0, row: 1 },
        { id: "ws", icon: "services/api-gateway-websocket", label: "API Gateway\nWebSocket", col: 1, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\nメッセージ処理", col: 2, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n接続ID・履歴", col: 3, row: 0 }
      ],
      edges: [
        { from: "userA", to: "ws", label: "WebSocket接続" },
        { from: "userB", to: "ws" },
        { from: "ws", to: "lambda", label: "ルート起動" },
        { from: "lambda", to: "ddb", label: "保存・宛先取得" },
        { from: "lambda", to: "userB", label: "相手へ配信", dashed: true }
      ]
    },
    flow: [
      "利用者はWebSocket APIに接続する。接続時（$connectルート）にLambdaが接続ID（配信先を示す宛先番号のようなもの）をDynamoDBへ保存する",
      "メッセージ送信（sendmessageルート）でLambdaが起動し、本文を履歴テーブルへ保存する",
      "Lambdaは宛先利用者の接続IDをDynamoDBから引き、API Gatewayの管理API（postToConnection）を通じて相手の接続へプッシュ配信する",
      "切断時（$disconnectルート）にLambdaが接続IDを削除する。クライアントは切断されたら自動再接続する実装にする"
    ],
    services: [
      { icon: "services/api-gateway-websocket", name: "API Gateway（WebSocket API）", role: "数千本の常時接続の維持をAWSが肩代わりする。接続・切断・メッセージをルートとしてLambdaに渡す" },
      { icon: "services/lambda", name: "AWS Lambda", role: "メッセージの保存・宛先解決・配信を行う処理部。イベントが来たときだけ動く" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "接続IDの台帳とメッセージ履歴の保存。ミリ秒応答でチャットの読み書きに向く" }
    ],
    points: [
      "WebSocketの難所である「サーバー側で常時接続を維持し続ける」部分をAPI Gatewayに任せ、自分のコード（Lambda）はイベント時だけ動く。これがサーバーレスチャットの核心",
      "履歴テーブルは「ルームID＋タイムスタンプ」を主キーにすると、ルーム単位の時系列取得が1クエリで済む",
      "切断検知は完全ではないため、配信失敗（410 Gone）を受けたら接続IDを削除する掃除処理を入れるのが定石",
      "全員向けお知らせのような大規模ファンアウト（一斉配信）は接続IDぶんのループ送信になるので、必要ならSNSや配信専用Lambdaに切り出す"
    ],
    pros: [
      "常時起動サーバーなしで数千接続を支えられ、スケーリング設計が不要",
      "接続数・メッセージ数がゼロの時間帯は費用もほぼゼロ",
      "認証（Cognito等）・ログ・スロットリングなどAPI Gatewayの機能をそのまま使える"
    ],
    cons: [
      "接続は最大2時間・無通信10分で切断される仕様のため、再接続とハートビートの実装が必須",
      "在席表示（プレゼンス）や既読管理などは全部自作になる",
      "1メッセージごとにLambdaが起動するため、超高頻度メッセージではレイテンシと費用のオーバーヘッドがある"
    ],
    cost: "<strong>月数百円〜3,000円程度</strong>（同時接続1,000・月100万メッセージの想定。WebSocket接続時間は100万分あたり約40円、メッセージ100万件あたり約150円、Lambda・DynamoDBは小規模なら無料枠〜数百円）。",
    references: [
      { title: "WebSocket APIについて", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-websocket-api.html", note: "API Gateway公式デベロッパーガイド" },
      { title: "チュートリアル：WebSocket APIでチャットアプリを作成する", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/websocket-api-chat-app.html", note: "この構成そのもののハンズオン" },
      { title: "バックエンドサービスからの応答（postToConnection）", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html", note: "プッシュ配信の仕組み" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "AppSync（GraphQLサブスクリプション）",
      when: "アプリ全体のAPIをGraphQLで統一しており、チャットもその一部として統合したい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "userA", icon: "resources/mobile-client", label: "利用者A", col: 0, row: 0 },
          { id: "userB", icon: "resources/mobile-client", label: "利用者B", col: 0, row: 1 },
          { id: "appsync", icon: "services/appsync", label: "AppSync\nGraphQL API", col: 1, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nメッセージ保存", col: 2, row: 0 },
          { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 2, row: 1 }
        ],
        edges: [
          { from: "userA", to: "appsync", label: "mutation送信" },
          { from: "appsync", to: "userB", label: "リアルタイム配信", dashed: true },
          { from: "appsync", to: "ddb", label: "リゾルバーで保存" },
          { from: "cognito", to: "appsync", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "アプリはAppSyncのGraphQL APIへmutation（書き込み操作）としてメッセージを送る。認証はCognitoのトークンで行う",
        "AppSyncのリゾルバー（データ取得・保存の変換層）がDynamoDBへ直接書き込む。単純な保存ならLambdaすら不要",
        "同じルームをsubscription（購読）している相手のアプリへ、AppSyncが変更をリアルタイム配信する。接続管理・再接続・配信はAppSyncが面倒を見る"
      ],
      services: [
        { icon: "services/appsync", name: "AWS AppSync", role: "マネージドGraphQL API。クエリ・書き込み・リアルタイム配信（サブスクリプション）を1つのAPIで提供" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "メッセージと会話の保存先。リゾルバーから直接読み書きされる" },
        { icon: "services/cognito", name: "Amazon Cognito", role: "利用者のサインイン・トークン発行。AppSyncの認可と自然に統合できる" }
      ],
      points: [
        "main案で自作していた接続IDテーブルの管理・宛先解決・配信ループが丸ごと不要になる。リアルタイム部分の実装量は最少",
        "Amplifyのクライアントライブラリを使うとsubscription購読が数行で書け、オフライン時の再同期もサポートされる",
        "チャット以外の画面データ取得もGraphQLに寄せられるなら価値が最大化する。逆にREST中心のチームにはGraphQLの学習コストが最大の障壁"
      ],
      pros: [
        "リアルタイム配信・再接続処理の実装量が最も少ない",
        "チャット以外も含むアプリ全体のAPI基盤として使える",
        "Cognitoとの認証統合や細かい認可制御（誰がどの会話を購読できるか）が組み込みでできる"
      ],
      cons: [
        "GraphQL前提の設計となり、チームの学習コストがかかる",
        "WebSocketの生の制御（独自プロトコル等）はできない",
        "リゾルバーのデバッグやログ調査には慣れが必要"
      ],
      cost: "<strong>月数百円〜3,000円程度</strong>（月100万リクエスト＋リアルタイム配信100万件＋接続時間課金の想定。main案と同水準で、どちらも小規模なら月数百円に収まる）。",
      references: [
        { title: "AWS AppSyncとは", url: "https://docs.aws.amazon.com/ja_jp/appsync/latest/devguide/what-is-appsync.html", note: "AppSync公式デベロッパーガイド" },
        { title: "リアルタイムデータ（サブスクリプション）", url: "https://docs.aws.amazon.com/ja_jp/appsync/latest/devguide/aws-appsync-real-time-data.html", note: "リアルタイム配信の仕組み" },
        { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html" }
      ]
    },
    {
      name: "ECS + ElastiCacheでSocket.IOを自前運用",
      when: "既存のSocket.IO資産がある・独自プロトコルや細かい接続制御が必要な場合",
      diagram: {
        cols: 6, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 0] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [5, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "user", icon: "resources/mobile-client", label: "利用者", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "alb", icon: "services/elb", label: "ALB", col: 3, row: 0 },
          { id: "ecs", icon: "services/ecs", label: "ECS\nSocket.IO", col: 4, row: 0 },
          { id: "redis", icon: "services/elasticache", label: "ElastiCache\nRedis Pub/Sub", col: 5, row: 0 }
        ],
        edges: [
          { from: "user", to: "igw", label: "WSS常時接続" },
          { from: "igw", to: "alb" },
          { from: "alb", to: "ecs", label: "振り分け" },
          { from: "ecs", to: "redis", label: "タスク間同期" }
        ]
      },
      flow: [
        "利用者のWebSocket接続はインターネットゲートウェイを通ってALBへ届く。ALBはWebSocketをそのまま通せる",
        "ALBが複数のECSタスク（Socket.IOサーバー）へ接続を振り分ける。同じ利用者を同じタスクへ寄せるスティッキーセッションを有効にする",
        "宛先の利用者が別タスクに接続している場合に届けるため、ElastiCache（Redis）のPub/Subで全タスク間にメッセージを同期する",
        "履歴の保存はDynamoDBやRDSへ別途書き込む（図では省略）"
      ],
      services: [
        { icon: "services/ecs", name: "Amazon ECS", role: "Socket.IOサーバーをコンテナで動かす実行基盤。接続数に応じてタスク数を増やす" },
        { icon: "services/elasticache", name: "Amazon ElastiCache（Redis）", role: "複数サーバー間のメッセージ同期（Pub/Sub）。Socket.IOのRedisアダプターの接続先" },
        { icon: "services/elb", name: "Application Load Balancer", role: "WebSocket対応のロードバランサー。接続をタスク群へ分散する" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "VPCの玄関。自前サーバー構成なのでVPCと入口が必要になる" }
      ],
      points: [
        "複数サーバーでSocket.IOを動かすときはRedisアダプター（Pub/Sub同期）が定番。これがないと別サーバーの相手にメッセージが届かない",
        "スティッキーセッションを有効にしないとSocket.IOのハンドシェイクが失敗しやすい、という実運用の罠がある",
        "接続数の増減に対するタスクのオートスケーリングと、スケールイン時の接続の逃がし方まで設計する必要がある",
        "main案・AppSync案と比べて「ここまで自前で組む理由があるか」を先に問うべき構成"
      ],
      pros: [
        "プロトコル・接続管理・タイムアウトを完全に制御でき、API Gatewayの2時間切断のような制約がない",
        "既存のSocket.IOコード資産・ノウハウをそのまま活かせる",
        "名前空間・ルーム機能などSocket.IOの豊富な機能を使える"
      ],
      cons: [
        "常時起動の固定費がかかり、接続ゼロでも費用が発生する",
        "スケーリング・障害対応・パッチの運用が全部自分持ち",
        "実装量・学習量が3案の中で最大"
      ],
      cost: "<strong>月1万円〜3万円程度</strong>（ALB約2,500円＋Fargate2タスク約5,000円＋ElastiCache最小ノード約2,000円〜＋転送量。接続数が増えるとタスク・ノード追加で階段状に増える）。",
      references: [
        { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html", note: "WebSocketサポートの記載あり" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
        { title: "Amazon ElastiCacheとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonElastiCache/latest/dg/WhatIs.html" }
      ]
    }
  ],
  cost: "<p>推奨構成とAppSync案はどちらも<strong>月数百円〜3,000円程度</strong>（同時接続1,000・月100万メッセージ）で、完全従量課金のため利用が少ない月はほぼゼロになる。自前Socket.IO案は<strong>月1万円〜3万円程度</strong>の固定費が接続ゼロでもかかる。費用よりも「実装量と制御の自由度」のトレードオフで選ぶのが実態に近い。</p>",
  summary: "<p>リアルタイムチャットの難所は<strong>常時接続の維持とプッシュ配信</strong>で、これをどこまでAWSに任せるかで3案が分かれます。API Gateway WebSocketは「接続維持だけ任せて配信ロジックは自作」、AppSyncは「配信まで全部任せる」、ECS自前は「全部自分で制御する」という並びです。迷ったら実装量が少なく従量課金のマネージド案（main・alt1）から始め、プロトコル制御の要件が出てから自前案を検討する順番が安全です。</p>"
});
