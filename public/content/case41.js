// ケース41：スマートデバイス制御（スマートホーム）
registerCase({
  id: 41,
  category: "IoT・リアルタイム",
  title: "スマートデバイス制御（スマートホーム）",
  scenario: "<p>スマートホーム機器メーカー。エアコン・照明・給湯器などの自社機器を、利用者のスマホアプリから遠隔操作できるようにしたい。外出先から「帰宅前に冷房を入れる」といった操作が典型例。機器が一時的にオフラインでも操作を受け付け、復帰したら反映されるようにしたい。将来は数万台規模とファームウェア更新（OTA）も見据える。</p>",
  requirements: [
    "スマホから機器の電源・設定を遠隔操作したい",
    "機器がオフラインでも操作を受け付け、復帰時に反映したい",
    "機器の現在状態をアプリに即時反映したい",
    "機器ごとの認証で、なりすまし・乗っ取りを防ぎたい",
    "数万台規模へのスケールとファームウェア更新（OTA）も見据えたい"
  ],
  main: {
    name: "IoT Core（デバイスシャドウ）+ Lambda + DynamoDB",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "phone", icon: "resources/mobile-client", label: "スマホアプリ", col: 0, row: 0 },
        { id: "device", icon: "resources/client", label: "スマート家電", col: 0, row: 1 },
        { id: "iot", icon: "services/iot-core", label: "IoT Core\nデバイスシャドウ", col: 1, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\nイベント処理", col: 2, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n機器管理・履歴", col: 3, row: 0 }
      ],
      edges: [
        { from: "phone", to: "iot", label: "希望状態を送信" },
        { from: "iot", to: "device", label: "差分を配信", dashed: true },
        { from: "iot", to: "lambda", label: "ルールで起動" },
        { from: "lambda", to: "ddb", label: "履歴を保存" }
      ]
    },
    flow: [
      "アプリは機器の「希望状態（desired。例：電源ON・設定温度26度）」をデバイスシャドウに書き込む。シャドウとは、機器の状態を預かるクラウド上の分身のこと",
      "IoT Coreが希望状態と報告状態（reported。機器が最後に報告した実際の状態）の差分を機器へMQTTで配信し、機器は実行後に新しい状態を報告する",
      "機器がオフラインでも希望状態はシャドウに残り続け、再接続した瞬間に差分が届いて自動反映される。アプリ側の再送処理は不要",
      "状態変化はルールエンジンからLambdaに流れ、機器管理情報や操作履歴としてDynamoDBへ保存する。アプリはシャドウを購読して状態変化を即時に受け取る"
    ],
    services: [
      { icon: "services/iot-core", name: "AWS IoT Core", role: "MQTT接続・機器ごとの証明書認証・デバイスシャドウによる状態同期を担うこの構成の中核" },
      { icon: "services/lambda", name: "AWS Lambda", role: "状態変化イベントの処理。通知や連携などの業務ロジックを書く場所" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "機器の登録情報・利用者との紐づけ・操作履歴の保存" }
    ],
    points: [
      "「オフライン中の操作を復帰後に反映する」という難所を、自前の再送キューなしでシャドウのdesired/reported差分同期が解決してくれる。これがこの構成を選ぶ最大の理由",
      "機器1台ごとにX.509証明書を発行し、IoTポリシーで「自分のシャドウ・自分のトピックのみ」に権限を絞る。1台が乗っ取られても他の家の機器には触れない",
      "アプリ側はCognito認証でMQTT over WebSocket接続すると、シャドウの変化を購読してリアルタイムに画面へ反映できる",
      "将来のファームウェア更新はIoT Jobs（機器群への作業指示の仕組み）に乗せられるため、数万台への段階配信もこの構成の延長でできる"
    ],
    pros: [
      "オフライン考慮・再接続・状態同期という難所がマネージドで解決される",
      "数万台規模へのスケールが標準機能で、構成変更が不要",
      "機器単位の証明書認証で、被害の波及を1台に閉じ込められる",
      "完全従量課金で、機器が少ない立ち上げ期の費用が小さい"
    ],
    cons: [
      "シャドウ・トピック・ポリシーなどIoT Core特有の概念の学習が必要",
      "MQTTを話せない既存機器には、話せるゲートウェイ機器などの橋渡しが必要",
      "複雑な業務ロジック（家族間の権限共有など）は結局Lambda＋DynamoDB側で作り込む"
    ],
    cost: "<strong>月5,000円〜1万円程度</strong>（機器1万台が常時接続・シャドウ更新1日20回/台の想定。接続100万分あたり約12円、メッセージ・シャドウ操作は100万件あたり約150〜190円の従量課金）。機器1,000台なら月1,000円未満に収まる。",
    references: [
      { title: "AWS IoTデバイスシャドウサービス", url: "https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/iot-device-shadows.html", note: "desired/reported同期の公式解説" },
      { title: "AWS IoT Coreとは", url: "https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/what-is-aws-iot.html" },
      { title: "AWS IoTのルール", url: "https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/iot-rules.html", note: "Lambda連携の仕組み" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "Amazon MQ（既存MQTTブローカーからの互換移行）",
      when: "既存機器がMosquitto等のMQTTブローカー前提で作られており、機器側を改修せずクラウドへ移行したい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [4, 0], depth: 2 }
        ],
        nodes: [
          { id: "device", icon: "resources/client", label: "既存MQTT機器", col: 0, row: 0 },
          { id: "phone", icon: "resources/mobile-client", label: "スマホアプリ", col: 0, row: 1 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "mq", icon: "services/mq", label: "Amazon MQ\nActiveMQ", col: 3, row: 0 },
          { id: "ecs", icon: "services/ecs", label: "ECS\n制御アプリ", col: 4, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n状態保存", col: 5, row: 0 }
        ],
        edges: [
          { from: "device", to: "igw", label: "MQTT/TLS" },
          { from: "phone", to: "igw" },
          { from: "igw", to: "mq" },
          { from: "mq", to: "ecs", label: "トピック購読" },
          { from: "ecs", to: "ddb", label: "状態を記録" }
        ]
      },
      flow: [
        "機器とアプリは、接続先を既存ブローカーからAmazon MQ（ActiveMQ）のエンドポイントへ変えるだけでMQTT接続する。プロトコル互換なのでファームウェア改修が最小で済む",
        "制御アプリ（ECS）がトピックを購読し、コマンドの仲介・状態管理のロジックを実行する",
        "機器の状態はVPC外のDynamoDBへ保存し、アプリからの照会に応える"
      ],
      services: [
        { icon: "services/mq", name: "Amazon MQ", role: "ActiveMQ/RabbitMQのマネージドブローカー。MQTTを話せるのはActiveMQエンジンを選んだ場合で、RabbitMQエンジンはAMQPが中心" },
        { icon: "services/ecs", name: "Amazon ECS", role: "コマンド仲介・状態管理など、ブローカーの外側のロジックを動かす実行基盤" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "機器状態・履歴の保存。VPC外のマネージドサービス" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "VPCの玄関。MQはVPC内で動くサービスなので外部からの入口が必要" }
      ],
      points: [
        "「機器のファームウェアを変えられない・変えたくない」という制約下での現実解。標準MQTT互換のブローカーへ接続先を変えるだけで移行できる",
        "IoT Coreのデバイスシャドウに相当するオフライン同期機能はないため、必要なら保留コマンドの管理を自前実装することになる",
        "ブローカーはVPC内で常時起動。本番はマルチAZのアクティブ/スタンバイ構成にして障害に備える",
        "機器ごとの証明書発行・失効の管理（IoT Coreなら標準機能）も自前運用になる点は移行判断の重要材料"
      ],
      pros: [
        "機器側の改修なし（接続先変更のみ）で移行できる",
        "MQTT・AMQPなど標準プロトコルをフルサポートし、ブローカー設定を細かく制御できる",
        "オンプレのブローカー保守（パッチ・バックアップ）から解放される"
      ],
      cons: [
        "常時起動の固定費がかかる",
        "シャドウ・機器単位の証明書管理・OTAなどIoT向け機能は全部自前になる",
        "数万台規模の接続はブローカーのスケール設計が難しく、IoT Coreほど素直に伸びない"
      ],
      cost: "<strong>月5,000円〜10万円程度</strong>（検証用mq.t3.micro単一構成なら月5,000円前後。本番のマルチAZ mq.m5.large相当なら月8万円前後＋ECS・転送量）。",
      references: [
        { title: "Amazon MQとは", url: "https://docs.aws.amazon.com/ja_jp/amazon-mq/latest/developer-guide/welcome.html", note: "対応プロトコルの一覧あり" },
        { title: "Amazon MQの基本要素", url: "https://docs.aws.amazon.com/ja_jp/amazon-mq/latest/developer-guide/amazon-mq-basic-elements.html", note: "ブローカー構成（単一/冗長）の解説" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" }
      ]
    },
    {
      name: "API Gateway WebSocketで簡易制御",
      when: "対象機器が少数で、MQTTやシャドウを持ち出すまでもない簡易な遠隔操作を短期間で作りたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "phone", icon: "resources/mobile-client", label: "スマホアプリ", col: 0, row: 0 },
          { id: "device", icon: "resources/client", label: "自社機器", col: 0, row: 1 },
          { id: "ws", icon: "services/api-gateway-websocket", label: "API Gateway\nWebSocket", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n制御ロジック", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n接続ID・状態", col: 3, row: 0 }
        ],
        edges: [
          { from: "phone", to: "ws", label: "操作コマンド" },
          { from: "ws", to: "device", label: "コマンド配信", dashed: true },
          { from: "ws", to: "lambda", label: "ルート起動" },
          { from: "lambda", to: "ddb", label: "接続ID・状態" }
        ]
      },
      flow: [
        "機器とアプリの両方がWebSocket APIへ常時接続し、Lambdaが接続IDをDynamoDBへ保存する",
        "アプリからの操作コマンドをLambdaが受け、対象機器の接続IDへ配信（postToConnection）する",
        "機器は実行結果を同じ接続で返し、Lambdaがアプリへ転送するとともに状態をDynamoDBへ記録する"
      ],
      services: [
        { icon: "services/api-gateway-websocket", name: "API Gateway（WebSocket API）", role: "機器・アプリ双方の常時接続を維持し、双方向メッセージを中継する" },
        { icon: "services/lambda", name: "AWS Lambda", role: "コマンドの宛先解決・転送・状態記録のロジック" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "接続IDの台帳と機器状態の保存" }
      ],
      points: [
        "HTTPとWebSocketのライブラリだけで実装でき、MQTT・証明書・シャドウといったIoT固有の知識が不要なのが最大の利点",
        "機器オフライン時のコマンドは自前で保留管理する（未達コマンドをDynamoDBに積み、再接続時に流すなど）",
        "無通信10分で切断される仕様のため、機器側にハートビート（定期的な小さい通信）と自動再接続の実装が必須",
        "台数・要件が育ってきたら、シャドウとOTAを持つIoT Core（推奨構成）へ移行するのが自然な進化"
      ],
      pros: [
        "学習コストが最小で、Webエンジニアだけで短期間に作れる",
        "完全従量課金で、少数デバイスなら3案の中で最安",
        "専用SDK・専用プロトコルが不要"
      ],
      cons: [
        "シャドウ相当のオフライン同期・機器単位の証明書管理・OTAが全部自前になる",
        "常時接続の維持（再接続・ハートビート）の責任が機器側実装に寄る",
        "数千台を超える規模や機器認証の厳格化には向かない"
      ],
      cost: "<strong>月数十円〜数百円程度</strong>（機器10台＋アプリが常時接続の想定。接続時間100万分あたり約40円＋メッセージ課金。無料枠内に収まることも多い）。",
      references: [
        { title: "WebSocket APIについて", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-websocket-api.html", note: "API Gateway公式デベロッパーガイド" },
        { title: "バックエンドサービスからの応答（postToConnection）", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html", note: "機器へのコマンド配信に使う管理API" },
        { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5,000円〜1万円程度</strong>（機器1万台・常時接続）で、台数が少ないうちはほぼゼロから始められる従量課金。Amazon MQ案は検証なら<strong>月5,000円前後</strong>だが本番冗長構成で<strong>月8万円前後〜</strong>の固定費になる。WebSocket簡易案は<strong>月数十円〜数百円程度</strong>と最安ながら、スケールと機器認証の作り込みに限界がある。</p>",
  summary: "<p>スマートデバイス制御の核心は「<strong>機器はいつでもオフラインになる</strong>」という前提にどう向き合うかです。IoT Coreのデバイスシャドウは、希望状態と実状態を分けて持つことでこの問題を仕組みで解決します。既存機器を改修できないならAmazon MQへの互換移行、ごく少数の簡易制御ならWebSocket自前という分岐ですが、証明書管理・OTA・数万台スケールまで見据えるなら早い段階でIoT Coreに乗るのが結局の近道です。</p>",
  quiz: [
    {
      q: "「機器がオフラインでも操作を受け付け、復帰したら反映する」という要件を、デバイスシャドウはどうやって解決しているのでしょうか。",
      a: "機器の状態を希望状態（desired）と報告状態（reported）に分けて、クラウド側に預かっているためです。アプリは希望状態を書くだけでよく、機器がオフラインでもその値はシャドウに残り、再接続した瞬間に差分が配信されて自動で反映されます。自前でコマンドの保留キューと再送を作らずに済むのがこの構成を選ぶ最大の理由で、代替案を選ぶとこの部分がそのまま自作の宿題になります。"
    },
    {
      q: "機器1台ごとにX.509証明書を発行し、IoTポリシーで自分のトピック・自分のシャドウだけに権限を絞るのはなぜでしょうか。",
      a: "1台が乗っ取られたときの被害を、その1台に閉じ込めるためです。全機器で同じ認証情報を共有していると、1台を解析されただけで他の家庭の機器まで操作されてしまいます。機器ごとに証明書を持たせ、権限も自分自身のトピックに限定しておけば、なりすましの範囲が広がりません。数万台規模では証明書の発行・失効を運用に乗せられるかも重要で、これはIoT Coreの標準機能として用意されています。"
    },
    {
      q: "既存機器のファームウェアは改修できない、しかしMQTTブローカーには接続できる、という制約が出てきたらどうしますか。",
      a: "代替1のAmazon MQへの互換移行が現実解です。標準MQTT互換のブローカーなので機器側は接続先を変えるだけで移行でき、ファームウェア改修という最大のコストを避けられるためです。ただしシャドウ相当のオフライン同期・機器単位の証明書管理・OTAはすべて自前になり、ブローカー常時起動の固定費もかかります。数万台規模とOTAまで見据えるなら、改修コストを払ってでもIoT Coreへ寄せる判断もあり得る、という比較になります。"
    }
  ]
});
