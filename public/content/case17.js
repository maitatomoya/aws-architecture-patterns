// ケース17：画像アップロード処理パイプライン
registerCase({
  id: 17,
  category: "サーバーレス・イベント駆動",
  title: "画像アップロード処理パイプライン",
  scenario: "<p>SNS風のWebサービスで、ユーザーがプロフィール画像や投稿画像をアップロードする。スマホで撮った数MBの元画像をそのまま配信すると重いので、サムネイル用・一覧用・詳細用の3サイズへ自動リサイズしたい。あわせて画像の投稿者・サイズ・処理状態といったメタデータ（データを説明するためのデータ）をDBに記録し、アプリから参照できるようにする。アップロード数は平日夜に集中し、昼間はほとんどない。</p>",
  requirements: [
    "アップロードされた画像を自動で複数サイズにリサイズしたい",
    "処理はアップロードの数秒後までに完了すればよい（非同期でよい）",
    "メタデータをアプリから低レイテンシーで参照したい",
    "アクセスの波が大きいので、使った分だけの課金にしたい",
    "サーバーの常時運用・パッチ当てはやりたくない"
  ],
  main: {
    name: "S3イベント + Lambda + DynamoDB",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
        { id: "s3src", icon: "services/s3", label: "S3\n元画像", col: 1, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\nリサイズ処理", col: 2, row: 0 },
        { id: "s3dst", icon: "services/s3", label: "S3\n配信用画像", col: 3, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nメタデータ", col: 2, row: 1 }
      ],
      edges: [
        { from: "users", to: "s3src", label: "アップロード" },
        { from: "s3src", to: "fn", label: "イベント通知" },
        { from: "fn", to: "s3dst", label: "リサイズ保存" },
        { from: "fn", to: "ddb", label: "メタデータ書込" }
      ]
    },
    flow: [
      "ユーザーは署名付きURL（S3へ直接アップロードするための期限付きURL）を使って、元画像を直接S3へアップロードする",
      "S3はオブジェクト作成イベントを検知し、Lambda関数を自動で起動する（サーバーを待機させておく必要がない）",
      "Lambdaが画像を3サイズにリサイズし、配信用のS3バケットへ保存する",
      "同じLambdaが画像のメタデータ（投稿者・サイズ・処理状態）をDynamoDBに書き込み、アプリはこれを参照する"
    ],
    services: [
      { icon: "services/s3", name: "Amazon S3（元画像/配信用）", role: "アップロード先と変換結果の置き場。オブジェクト作成をきっかけにイベントを発火できる" },
      { icon: "services/lambda", name: "AWS Lambda", role: "リサイズ処理の実行環境。イベントが来たときだけ起動し、並列数も自動で増える" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "メタデータの保存先。キー指定の読み書きが数ミリ秒で返るNoSQLデータベース" }
    ],
    points: [
      "アップロードは署名付きURLでS3へ直接行う。自前のAPIサーバーを画像が経由しないため、大きなファイルでもアプリ側の負荷がゼロになる",
      "元画像と変換後の画像はバケット（またはプレフィックス）を分ける。同じ場所に書き戻すと、書き込みが再びイベントを発火して無限ループになる典型的な事故を防げる",
      "Lambdaの失敗に備えてデッドレターキュー（処理に失敗したイベントの退避先）を設定し、リサイズ漏れを検知できるようにする",
      "この図にVPCやゲートウェイが無いのは省略ではない。S3・Lambda・DynamoDBはすべてVPCの外で動くマネージドサービスで、ネットワークの設計や管理そのものが不要になるのがこの構成の価値"
    ],
    pros: [
      "アイドル時のコストがほぼゼロ（イベントが来たときだけ課金）",
      "夜間の集中アップロードにもLambdaの自動並列実行で追従できる",
      "サーバー管理・OSパッチが一切不要",
      "構成要素が少なく、初学者でも全体を把握しやすい"
    ],
    cons: [
      "Lambdaは実行時間最大15分・メモリ最大10GBの制限があり、巨大ファイルや動画には不向き",
      "複数の変換を順序立てて行いたい場合、1つのLambdaに詰め込むとコードが肥大化する",
      "イベントは「少なくとも1回」配信のため、同じ画像を2回処理しても壊れない冪等な実装（何度実行しても結果が同じになる実装）が必要"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（月10万枚・元画像2MB前提。Lambda実行料は無料枠でほぼ吸収され、S3の保存量とDynamoDBの読み書きが中心）。アップロードが無い日はほぼ0円。",
    references: [
      { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html", note: "S3→Lambdaを起動する仕組みの公式解説" },
      { title: "チュートリアル：S3トリガーでLambda関数を呼び出す", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-s3-example.html", note: "この構成そのもののハンズオン" },
      { title: "署名付きURLを使用したオブジェクトの共有", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/PresignedUrls.html", note: "S3へ直接アップロードさせる方法" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
      { title: "Lambdaのクォータ（15分制限など）", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/gettingstarted-limits.html", note: "デメリットで触れた制限の一次情報" }
    ]
  },
  alternatives: [
    {
      name: "Step Functionsで多段変換パイプライン",
      when: "リサイズ以外に不適切画像チェック・透かし入れなど複数工程があり、工程ごとの失敗リトライや進捗管理をしたい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "s3src", icon: "services/s3", label: "S3\n元画像", col: 1, row: 0 },
          { id: "eb", icon: "services/eventbridge", label: "EventBridge", col: 2, row: 0 },
          { id: "sfn", icon: "services/step-functions", label: "Step Functions\nワークフロー", col: 3, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n各変換工程", col: 4, row: 0 },
          { id: "s3dst", icon: "services/s3", label: "S3\n配信用画像", col: 5, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n処理状態", col: 4, row: 1 }
        ],
        edges: [
          { from: "users", to: "s3src", label: "アップロード" },
          { from: "s3src", to: "eb", label: "イベント発行" },
          { from: "eb", to: "sfn", label: "実行開始" },
          { from: "sfn", to: "fn", label: "工程ごとに呼出" },
          { from: "fn", to: "s3dst", label: "変換結果保存" },
          { from: "fn", to: "ddb", label: "状態記録" }
        ]
      },
      flow: [
        "S3へのアップロードイベントをEventBridge（イベントの受け渡しを仲介するサービス）が受け取り、Step Functionsのワークフローを開始する",
        "Step Functionsが「リサイズ→不適切画像チェック→透かし入れ」のような工程を定義通りの順序で実行し、各工程は小さなLambdaが担当する",
        "工程が失敗したら、その工程だけを自動リトライする。何度失敗したか・どこまで進んだかはコンソールで図として確認できる",
        "各工程の結果はS3とDynamoDBに保存され、処理状態をアプリから追跡できる"
      ],
      services: [
        { icon: "services/step-functions", name: "AWS Step Functions", role: "複数のLambdaを順序・分岐・リトライ付きでつなぐワークフローエンジン" },
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "S3イベントを受けてStep Functionsを起動する仲介役。S3の通知はStep Functionsを直接起動できないため必須" },
        { icon: "services/lambda", name: "AWS Lambda", role: "各変換工程の実体。1工程1関数に分けることで個別にテスト・修正できる" },
        { icon: "services/s3", name: "Amazon S3", role: "元画像と変換結果の置き場" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "処理状態・メタデータの記録先" }
      ],
      points: [
        "リトライ・タイムアウト・失敗時の分岐をコードでなくワークフロー定義（JSON）に書ける。エラー処理のコードがLambda本体から消え、各関数が本来の変換処理に集中できる",
        "S3のイベント通知はStep Functionsを直接起動できないため、S3のEventBridge統合を有効化してEventBridge経由で起動するのが公式の定石",
        "実行履歴が視覚化されるため「どの画像がどの工程で失敗したか」の調査が一目で終わる。運用引き継ぎのしやすさは単発Lambda構成より大幅に上",
        "1工程だけ重い処理がある場合、その工程だけメモリ設定を上げるなど工程単位のチューニングができる"
      ],
      pros: [
        "多段処理の順序・分岐・リトライを宣言的に管理できる",
        "失敗箇所が視覚化され、運用調査が楽",
        "工程の追加・差し替えがワークフロー定義の修正だけで済む"
      ],
      cons: [
        "推奨構成より登場人物が増え、初期学習コストが上がる",
        "状態遷移ごとに課金されるため、単純なリサイズだけなら割高",
        "ワークフロー定義（ASL）という新しい記法を覚える必要がある"
      ],
      cost: "<strong>月1,000円〜5,000円程度</strong>（月10万実行・1実行あたり5状態遷移の前提でStep Functions分が約2,000円。これにLambda・S3・DynamoDBの従量分が加わる）。",
      references: [
        { title: "AWS Step Functionsとは", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/welcome.html" },
        { title: "Step Functionsのエラー処理（Retry/Catch）", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/concepts-error-handling.html", note: "工程ごとのリトライ定義の公式解説" },
        { title: "Amazon EventBridgeを使用したS3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventBridge.html", note: "S3→EventBridge統合の有効化方法" }
      ]
    },
    {
      name: "ECS Fargateで重量級処理",
      when: "RAW現像・動画変換など1件数分〜数十分かかる処理や、Lambdaの15分・10GBメモリ制限を超える巨大ファイルを扱う場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [4, 0], to: [4, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n画像バケット", col: 1, row: 0 },
          { id: "eb", icon: "services/eventbridge", label: "EventBridge", col: 2, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 3, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 4, row: 0 },
          { id: "ecs", icon: "services/fargate", label: "ECS Fargate\n変換タスク", col: 4, row: 1 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n処理状態", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "s3", label: "アップロード" },
          { from: "s3", to: "eb", label: "イベント通知" },
          { from: "eb", to: "ecs", label: "タスク起動" },
          { from: "ecs", to: "nat", label: "外向き通信" },
          { from: "nat", to: "igw" },
          { from: "ecs", to: "ddb", label: "状態記録", dashed: true }
        ]
      },
      flow: [
        "S3へのアップロードイベントをEventBridgeが受け、ECS FargateのタスクをRunTask（1件ごとのコンテナ起動）で立ち上げる",
        "タスクはプライベートサブネットで動き、S3から元ファイルを取得して変換し、結果をS3へ書き戻す",
        "プライベートサブネットからS3・DynamoDBへの通信は、NATゲートウェイとインターネットゲートウェイを通って外に出る（VPCエンドポイントで置き換え可能）",
        "処理の開始・完了・失敗はDynamoDBに記録し、アプリから進捗を参照する"
      ],
      services: [
        { icon: "services/fargate", name: "AWS Fargate（ECS）", role: "サーバー管理不要のコンテナ実行環境。実行時間の上限がなく、CPU・メモリも大きく確保できる" },
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "S3イベントを受けてECSタスクを起動する仲介役" },
        { icon: "services/s3", name: "Amazon S3", role: "元ファイルと変換結果の置き場" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "処理状態の記録先。長時間処理では進捗の見える化が特に重要になる" },
        { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットから外への一方向通信の出口" }
      ],
      points: [
        "コンテナなので実行時間15分の壁がなく、ImageMagickやFFmpegなど重いツールもイメージに焼き込める。Lambdaでは厳しい「1件30分の動画変換」も扱える",
        "タスクはプライベートサブネットに置き、外からの直接アクセスを遮断する。図のIGW・NATはこのVPC構成に必須の出入口で、サーバーレス構成（推奨パターン）には登場しなかったものが復活している点に注目",
        "S3・DynamoDBへの通信はゲートウェイ型VPCエンドポイント（無料）に切り替えると、NATゲートウェイの通信料を大きく削減できる",
        "起動に数十秒かかるため「アップロード後すぐ結果が欲しい」用途には不向き。即時性が必要な小物はLambda、重量級はFargateと使い分けるハイブリッドも実務では多い"
      ],
      pros: [
        "実行時間・メモリ・CPUの制限が実質なくなり、巨大ファイルを扱える",
        "コンテナイメージに任意のツールを入れられ、既存の変換プログラムを移植しやすい",
        "処理がないときはタスク数ゼロにでき、常時起動のサーバーは不要"
      ],
      cons: [
        "タスク起動に数十秒かかり、小さい画像の大量処理ではLambdaより遅く割高",
        "VPC・サブネット・NATなどネットワーク設計が必要になり、構成の難易度が上がる",
        "NATゲートウェイは起動しているだけで月約6,500円かかる（VPCエンドポイントで削減可能）"
      ],
      cost: "<strong>月7,000円〜3万円程度</strong>（月1万件・1件5分・0.5vCPUの前提でFargate分が約2,000円。NATゲートウェイの固定費約6,500円が支配的なので、VPCエンドポイント化が効く）。",
      references: [
        { title: "AWS Fargateとは（Amazon ECS）", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html" },
        { title: "Amazon EventBridgeを使用したS3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventBridge.html", note: "S3イベントでECSタスクを起動する入口" },
        { title: "Amazon S3のゲートウェイエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/privatelink/vpc-endpoints-s3.html", note: "NAT料金を削減する工夫の一次情報" }
      ]
    }
  ],
  cost: "<p>推奨構成（S3+Lambda+DynamoDB）は<strong>月数百円〜数千円</strong>で、使わない時間は課金されない。Step Functions案は状態遷移課金が上乗せされて<strong>月1,000円〜5,000円程度</strong>。Fargate案は処理自体の課金は小さくても<strong>NATゲートウェイの固定費約6,500円</strong>が乗り、月7,000円〜となる。処理1件の重さがコスト構造を決める点に注目。</p>",
  summary: "<p>「S3に置かれたら自動で処理」はイベント駆動の入門にして最頻出パターンです。<strong>まずはS3イベント+Lambdaの最小構成で始め、工程が増えたらStep Functions、1件が重くなったらFargate</strong>、という進化の道筋ごと覚えておくと設計判断が速くなります。分岐点は「工程の数」と「1件あたりの処理時間」。また、変換結果を同じバケットに書き戻して無限ループさせる事故は現場で本当に起きるので、入出力の分離は最初から徹底しましょう。</p>"
});
