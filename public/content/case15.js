// ケース15：非同期ジョブ・キュー処理
registerCase({
  id: 15,
  category: "サーバーレス・イベント駆動",
  title: "非同期ジョブ・キュー処理",
  scenario: "<p>WebサービスでPDF帳票の生成・画像の変換・外部APIへのデータ連携といった「数秒〜数分かかる処理」が増えてきた。今はリクエストの中で同期実行しているため、画面の応答が遅くタイムアウトも頻発している。処理を裏側（非同期）に逃がし、ユーザーには即座に「受け付けました」と返したい。処理の取りこぼしは許されず、失敗したジョブには気づいて再実行できる仕組みが必要。ジョブ量は営業時間中に集中し、夜間はほぼゼロ。</p>",
  requirements: [
    "時間のかかる処理をリクエストから切り離し、画面応答を速くしたい",
    "ジョブを絶対に取りこぼさない（サーバー再起動や障害でも消えない）",
    "失敗したジョブに確実に気づき、原因調査と再実行ができること",
    "ジョブの集中時は並列処理で自動的にさばきたい",
    "アイドル時間帯のコストを最小にしたい"
  ],
  main: {
    name: "SQS + Lambda + デッドレターキュー（サーバーレスキュー処理）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "app", icon: "resources/client", label: "アプリケーション\n(ジョブ発行元)", col: 0, row: 0 },
        { id: "sqs", icon: "services/sqs", label: "SQS\nジョブキュー", col: 1, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\nワーカー", col: 2, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n処理結果", col: 3, row: 0 },
        { id: "dlq", icon: "services/sqs", label: "SQS\nデッドレターキュー", col: 1, row: 1 },
        { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nアラーム", col: 2, row: 1 },
        { id: "sns", icon: "services/sns", label: "SNS\n通知", col: 3, row: 1 },
        { id: "email", icon: "resources/email", label: "開発者へ\nメール", col: 4, row: 1 }
      ],
      edges: [
        { from: "app", to: "sqs", label: "ジョブ投入" },
        { from: "sqs", to: "fn", label: "ポーリング起動" },
        { from: "fn", to: "ddb", label: "結果保存" },
        { from: "sqs", to: "dlq", label: "規定回数失敗で移動", dashed: true },
        { from: "dlq", to: "cw", label: "滞留数を監視", dashed: true },
        { from: "cw", to: "sns", label: "アラーム発報" },
        { from: "sns", to: "email", label: "失敗通知" }
      ]
    },
    flow: [
      "アプリはジョブの内容（何をどう処理するか）をメッセージとしてSQS（メッセージキュー＝処理待ちの行列）に投入し、ユーザーには即座に「受付完了」を返す",
      "LambdaがSQSをポーリング（AWS側が自動で監視）し、メッセージが届くと起動してジョブを実行、結果をDynamoDBに保存する",
      "処理に失敗するとメッセージはキューに自動で戻り、他のワーカーが再試行する。規定回数（例：3回）失敗したメッセージだけがデッドレターキュー（DLQ＝失敗専用の退避キュー）へ移される",
      "CloudWatchアラームがDLQの滞留数を監視し、1件でも入るとSNS経由で開発者にメール通知が飛ぶ",
      "開発者はDLQ内のメッセージで原因を調査し、修正後にキューへ戻して再実行する（リドライブ機能）"
    ],
    services: [
      { icon: "services/sqs", name: "Amazon SQS", role: "ジョブの受付と保管。受信側が落ちていてもメッセージを保持し続ける「取りこぼし防止」の要" },
      { icon: "services/lambda", name: "AWS Lambda", role: "ジョブを実行するワーカー。キューの深さに応じて自動で並列数が増減する" },
      { icon: "services/sqs", name: "SQS デッドレターキュー", role: "規定回数失敗したメッセージの退避先。失敗ジョブを消さずに調査・再実行可能にする" },
      { icon: "services/sns", name: "Amazon SNS", role: "失敗の通知配信。メールのほかSlack連携（Lambda経由）などにも広げられる" },
      { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "DLQの滞留数やLambdaのエラー率を監視し、しきい値超過でアラームを発報する" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "ジョブの実行結果・ステータスの保存先。画面から進捗を確認できるようにする" }
    ],
    points: [
      "DLQを最初から必ず用意する。DLQなしだと失敗メッセージが無限に再試行され続け、料金と障害の温床になる。「maxReceiveCount=3〜5回でDLQ行き」が定番設定",
      "同じメッセージが稀に2回配信される仕様（少なくとも1回配信）に備え、ワーカーは冪等（同じジョブを2回実行しても結果が変わらない作り）にする。処理済みジョブIDをDynamoDBに記録して二重実行を弾くのが典型",
      "SQSの可視性タイムアウト（処理中のメッセージを他ワーカーから隠す時間）はジョブの最大処理時間より長く設定する。短いと処理中に別ワーカーへ二重配信される",
      "「キューに入れて即応答」に変えることで、フロントの体感速度改善とバックエンドの負荷平準化が同時に手に入る。これが非同期化の最大の狙い"
    ],
    pros: [
      "ジョブがキューに永続化されるため、ワーカー障害でも取りこぼさない",
      "急なジョブ集中はLambdaの自動並列化が吸収し、夜間ゼロ件ならコストもほぼゼロ",
      "失敗の検知（DLQ+アラーム）と再実行（リドライブ）の仕組みが標準機能で揃う",
      "発行側と処理側が疎結合になり、それぞれ独立に変更・スケールできる"
    ],
    cons: [
      "Lambdaの15分制限を超える重いジョブは実行できない（代替パターン参照）",
      "「少なくとも1回配信」のため冪等性の設計が必須で、初学者が見落としやすい",
      "処理順序は保証されない（順序が必要ならFIFOキューを使うがスループット上限がある）"
    ],
    cost: "<strong>月0円〜数百円</strong>（SQSは月100万リクエスト無料、以降100万件あたり約60円。Lambda・DynamoDBも無料枠が大きく、月数十万ジョブ規模でも数百円程度）。",
    references: [
      { title: "Amazon SQSとは", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html", note: "SQS公式開発者ガイド" },
      { title: "SQSのデッドレターキュー", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html", note: "DLQとリドライブの公式解説" },
      { title: "LambdaとSQSの連携", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-sqs.html", note: "イベントソースマッピングの公式ガイド" },
      { title: "Amazon SNSとは", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "AWS Batch（重量級・長時間の計算ジョブ）",
      when: "1ジョブが15分を超える、大容量メモリ・多コア・GPUが必要な科学計算・動画処理・機械学習前処理などの場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 1], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [4, 0], depth: 2 }
        ],
        nodes: [
          { id: "app", icon: "resources/client", label: "アプリケーション", col: 0, row: 0 },
          { id: "batch", icon: "services/batch", label: "AWS Batch\nジョブキュー", col: 1, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
          { id: "task1", icon: "services/fargate", label: "Fargate\nジョブ実行", col: 3, row: 0 },
          { id: "task2", icon: "services/fargate", label: "Fargate\n並列実行", col: 4, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n結果保存", col: 5, row: 0 }
        ],
        edges: [
          { from: "app", to: "batch", label: "ジョブ投入" },
          { from: "batch", to: "task1", label: "ジョブ数に応じ起動" },
          { from: "task1", to: "task2", label: "並列スケール", dashed: true, noArrow: true },
          { from: "task2", to: "s3", label: "結果保存" },
          { from: "task1", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "アプリがAWS Batch（バッチジョブ専用のキューとスケジューラ）にジョブを投入する",
        "Batchがキューの深さを見て、VPCのプライベートサブネットに計算用コンテナ（Fargateまたは EC2）を必要数だけ起動する",
        "各コンテナは数時間かかる計算でも完走でき、結果をS3に保存して終了する。終了したぶんの課金は止まる",
        "コンテナイメージ取得などの外向き通信はNATゲートウェイ→インターネットゲートウェイ経由で行う（インターネットからの入口は無い構成）"
      ],
      services: [
        { icon: "services/batch", name: "AWS Batch", role: "ジョブのキュー管理・優先度制御・計算リソースの起動停止を自動化。Batch自体は無料" },
        { icon: "services/fargate", name: "AWS Fargate", role: "ジョブを実行するサーバーレスコンテナ。ジョブがない時間は完全に0台になる" },
        { icon: "services/s3", name: "Amazon S3", role: "入出力データ・計算結果の置き場。大容量ファイルの受け渡しに向く" }
      ],
      points: [
        "Lambdaの15分・メモリ10GBの制限を超えるジョブの受け皿。vCPU数百・メモリ数百GB・GPUといった指定もジョブ定義に書くだけでよい",
        "スポットインスタンス（余剰リソースを最大9割引で使う仕組み）との相性が抜群。中断されてもBatchが自動で再実行するため、時間に融通が利く計算ジョブなら大幅にコストを削れる",
        "計算ノードはプライベートサブネットに置き、外部から直接届かない構成にする。NATゲートウェイの固定費を避けたい場合はS3・ECRへのVPCエンドポイントで代替できる",
        "SQS+Lambdaと排他ではなく、「軽いジョブはLambda、重いジョブはBatch」に振り分ける併用が実務では多い"
      ],
      pros: [
        "実行時間・リソース制限が実質なくなり、GPUジョブにも対応",
        "ジョブがない時間は計算リソースが0台になり、Batch自体は無料",
        "スポット活用・優先度付きキュー・自動リトライなどバッチ運用機能が揃っている"
      ],
      cons: [
        "コンテナ化とジョブ定義の整備が必要で、Lambdaよりも初期構築が重い",
        "起動に数十秒〜数分かかるため、秒単位の応答が必要なジョブには不向き",
        "VPC・サブネットのネットワーク設計が必要になる"
      ],
      cost: "<strong>実行時間に比例して月数百円〜数千円</strong>（例：4vCPU/8GBのFargateを毎日1時間で約900円/月。スポットなら更に安い。NATゲートウェイを置く場合は固定費約5,000円/月が加算）。",
      references: [
        { title: "AWS Batchとは", url: "https://docs.aws.amazon.com/ja_jp/batch/latest/userguide/what-is-batch.html", note: "Batch公式ユーザーガイド" },
        { title: "AWS Fargateとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html", note: "外向き通信経路の公式解説" }
      ]
    },
    {
      name: "Amazon MQ（既存のMQTT/AMQP資産を活かす）",
      when: "オンプレでActiveMQ・RabbitMQを使う既存システムがあり、アプリのプロトコル（AMQP/MQTT等）を変えずにキュー基盤だけAWSへ移したい場合",
      diagram: {
        cols: 6, rows: 1,
        groups: [
          { type: "onpremise", label: "オンプレミス", from: [0, 0], to: [0, 0] },
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 0] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 }
        ],
        nodes: [
          { id: "legacy", icon: "resources/office", label: "既存アプリ\n(AMQP)", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "mq", icon: "services/mq", label: "Amazon MQ\nブローカー", col: 3, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\nコンシューマー", col: 4, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n処理結果", col: 5, row: 0 }
        ],
        edges: [
          { from: "legacy", to: "igw", label: "AMQP/TLS" },
          { from: "igw", to: "mq" },
          { from: "mq", to: "fn", label: "メッセージ取得" },
          { from: "fn", to: "ddb", label: "結果保存" }
        ]
      },
      flow: [
        "オンプレの既存アプリは、接続先をAmazon MQのエンドポイントに変えるだけで、これまで通りAMQP等の標準プロトコルでメッセージを送る",
        "Amazon MQ（ActiveMQ/RabbitMQのマネージド版）はVPC内のブローカーとして動き、図ではインターネットゲートウェイ経由の公開エンドポイントで受けている",
        "LambdaのイベントソースマッピングがMQのキューを監視し、メッセージ到着で処理を起動、結果をDynamoDBへ保存する",
        "既存のコンシューマーアプリをそのまま使い続けることもでき、段階的な移行がしやすい"
      ],
      services: [
        { icon: "services/mq", name: "Amazon MQ", role: "ActiveMQ/RabbitMQ互換のマネージドブローカー。パッチ適用・冗長化をAWSに任せられる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "MQのキューを監視して起動するコンシューマー。既存アプリを残したまま新処理を追加できる" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "処理結果の保存先" }
      ],
      points: [
        "選定基準は「プロトコル互換が必要か」の一点。JMSやAMQPに依存した既存コードを書き換えずに移行できるのがSQSにない価値",
        "図は学習用に公開エンドポイント（インターネットゲートウェイ経由）で描いているが、実運用はVPNやDirect Connectで閉域接続し、インターネットに露出させないのが定石",
        "ブローカーは常時起動のインスタンスであり、SQSのような完全従量課金にはならない。可用性が必要なら複数AZのアクティブ/スタンバイ構成を選ぶ",
        "新規開発でプロトコル互換の縛りがないなら、運用が軽く安いSQS/SNSを選ぶべき、と公式も案内している"
      ],
      pros: [
        "既存アプリのコード・プロトコルをほぼ変えずにキュー基盤をクラウド化できる",
        "ブローカーのOS管理・パッチ・冗長化をAWSに任せられる",
        "メッセージの順序保証や優先度など、ミドルウェア固有の高度な機能を使い続けられる"
      ],
      cons: [
        "ブローカーが常時起動のため、アイドル時も固定費がかかる",
        "スループットの上限はブローカーのインスタンスサイズに縛られ、SQSほど無限にはスケールしない",
        "VPC・接続経路（VPN等）の設計が必要で、SQSより運用の手間が多い"
      ],
      cost: "<strong>月4,000円〜</strong>（mq.t3.micro単一構成で約4,000円＋ストレージ。複数AZの冗長構成にすると約2倍以上。SQSと違いアイドル時も課金が続く）。",
      references: [
        { title: "Amazon MQとは", url: "https://docs.aws.amazon.com/ja_jp/amazon-mq/latest/developer-guide/welcome.html", note: "Amazon MQ公式開発者ガイド。SQS/SNSとの使い分けの記載あり" },
        { title: "LambdaとAmazon MQの連携", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-mq.html", note: "イベントソースマッピングの公式ガイド" }
      ]
    }
  ],
  cost: "<p>推奨構成（SQS+Lambda）は<strong>月0円〜数百円</strong>でジョブ量に完全比例。Batch案はジョブ実行時間ぶんだけの課金で<strong>月数百円〜数千円</strong>（NAT利用時は固定費約5,000円が加算）。Amazon MQ案はブローカー常時起動のため<strong>月4,000円〜</strong>の固定費がかかる。</p>",
  summary: "<p>「重い処理はキューに逃がして即応答」は、Webサービスの体感速度と信頼性を同時に上げる<strong>バックエンド設計の基本技</strong>です。このケースの本質は3点。(1)キューがあることで発行側と処理側が疎結合になり、障害と負荷を吸収できる。(2)<strong>DLQと冪等性はキュー処理の必須セット</strong>で、後付けではなく最初から設計に入れる。(3)ワーカーの選択は処理の重さで決まる（15分以内ならLambda、超えるならBatch、プロトコル互換が要るならAmazon MQ）。この考え方は次の定期バッチやイベント駆動ケースにもそのままつながります。</p>"
});
