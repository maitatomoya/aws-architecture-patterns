// ケース40：位置情報トラッキング（配送・配車）
registerCase({
  id: 40,
  category: "IoT・リアルタイム",
  title: "位置情報トラッキング（配送・配車）",
  scenario: "<p>配送サービスを運営する企業。ドライバーのスマホアプリから現在地を定期送信し、配車管理者が地図画面で全車両の位置を把握したい。荷主向けには「配達員があと少しで到着」の表示も出したい。車両は約100台、位置更新は30秒間隔。配送先エリアに入ったら通知するジオフェンス（地図上に引いた仮想の境界線）も使いたい。地図サービスの外部契約やライセンス管理は避けたい。</p>",
  requirements: [
    "ドライバーの現在位置を30秒間隔で収集したい",
    "管理画面の地図に全車両の現在位置を表示したい",
    "配送先エリアへの入出を検知して通知したい（ジオフェンス）",
    "位置情報という機微なデータを安全に扱いたい",
    "地図の利用ライセンス・外部契約の管理を自前でやりたくない",
    "車両が増えても構成を変えずにスケールしたい"
  ],
  main: {
    name: "Location Service + API Gateway + Lambda + DynamoDB",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "driver", icon: "resources/mobile-client", label: "ドライバー\nアプリ", col: 0, row: 0 },
        { id: "ops", icon: "resources/user", label: "配車管理者", col: 0, row: 1 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway\nREST API", col: 1, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\n位置処理", col: 2, row: 0 },
        { id: "loc", icon: "services/location-service", label: "Location Service\n地図・追跡", col: 3, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n配送ステータス", col: 2, row: 1 }
      ],
      edges: [
        { from: "driver", to: "apigw", label: "現在地を送信" },
        { from: "ops", to: "apigw", label: "地図で照会" },
        { from: "apigw", to: "lambda", label: "起動" },
        { from: "lambda", to: "loc", label: "位置を記録" },
        { from: "lambda", to: "ddb", label: "状況を更新" }
      ]
    },
    flow: [
      "ドライバーアプリが30秒ごとに現在地をAPI Gateway経由で送信する。数件をまとめて送るバッチ送信にする",
      "Lambdaが位置をLocation Serviceのトラッカー（デバイスの位置を預かる追跡台帳）へ記録する。ジオフェンスコレクションと連動させると、エリア入出のイベントが自動で発火する",
      "あわせて配送ステータス（集荷済み・配達中・完了など）をDynamoDBに更新する",
      "配車管理者の画面はLocation Serviceの地図タイルを表示し、APIで全車両の最新位置を取得して地図に重ねる"
    ],
    services: [
      { icon: "services/location-service", name: "Amazon Location Service", role: "地図タイル・住所検索・トラッカー（位置追跡）・ジオフェンスをまとめて提供する位置情報サービス" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "アプリからの位置送信・照会の入口。認証・スロットリングも担う" },
      { icon: "services/lambda", name: "AWS Lambda", role: "位置の記録と配送ステータス更新のロジック。リクエスト時だけ動く" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "配送案件のステータス管理。車両ID・案件IDでミリ秒参照できる" }
    ],
    points: [
      "地図・追跡・ジオフェンスがAWS内で完結するため、外部地図サービスの契約・APIキー管理・利用規約の心配が不要になる。位置データがAWSの外に出ないのはコンプライアンス面でも利点",
      "位置は1件ずつでなく最大10件のバッチAPIで送ると、API呼び出し課金を最大1/10にできる",
      "トラッカーには位置フィルタリング機能（精度ベース・距離ベース）があり、GPS誤差による細かいジグザグを自動で間引いて費用と見た目を改善できる",
      "ジオフェンス入出イベントはEventBridge経由でSNS通知やLambdaにつなげられる（図では省略）。「到着間近」通知はこの仕組みで作る"
    ],
    pros: [
      "地図ライセンス・利用規約の管理をAWSに任せられ、位置データの扱いもAWS内で完結する",
      "追跡・ジオフェンスが組み込み機能で、実装量が少ない",
      "サーバーレス構成なので車両数の増加にそのまま追従する"
    ],
    cons: [
      "地図の見た目・機能のカスタマイズ性は専業サービス（Google Maps等）より限定的",
      "位置の書き込み・読み取りはAPI従量課金なので、送信頻度を上げると費用が線形に伸びる",
      "秒単位の高頻度更新が必要な用途（配車の激しいリアルタイムマッチング等）には向かない"
    ],
    cost: "<strong>月5,000円〜2万円程度</strong>（車両100台・30秒間隔・営業12時間のみ送信、10件バッチ送信、地図タイル取得数十万回の想定。位置書き込み・タイル取得・ジオフェンス評価の従量課金）。",
    references: [
      { title: "Amazon Location Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/location/latest/developerguide/what-is.html", note: "Location Service公式デベロッパーガイド" },
      { title: "Amazon Location Serviceのトラッカー", url: "https://docs.aws.amazon.com/ja_jp/location/latest/developerguide/trackers.html", note: "トラッカー（位置追跡）の公式解説" },
      { title: "Amazon Location Serviceのジオフェンス", url: "https://docs.aws.amazon.com/ja_jp/location/latest/developerguide/geofences.html", note: "ジオフェンスとトラッカー連動の公式解説" },
      { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "Kinesisで高頻度位置ストリーム処理",
      when: "数秒間隔×数千台のような高頻度・大規模で、急ブレーキ検知などのリアルタイム解析もしたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "device", icon: "resources/mobile-client", label: "車載端末\n数千台", col: 0, row: 0 },
          { id: "kds", icon: "services/kinesis-data-streams", label: "Kinesis Data\nStreams", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\nリアルタイム判定", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n最新位置", col: 3, row: 0 },
          { id: "fh", icon: "services/data-firehose", label: "Data Firehose\n蓄積配送", col: 2, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n走行履歴", col: 3, row: 1 }
        ],
        edges: [
          { from: "device", to: "kds", label: "位置を連続送信" },
          { from: "kds", to: "lambda", label: "リアルタイム消費" },
          { from: "lambda", to: "ddb", label: "最新位置を更新" },
          { from: "kds", to: "fh", label: "並行して読取", dashed: true },
          { from: "fh", to: "s3", label: "全履歴を保存" }
        ]
      },
      flow: [
        "車載端末はKinesis Data Streamsへ位置を直接送信する（Cognito等で認証したSDK経由のHTTPS送信）",
        "Lambdaがストリームをリアルタイムに消費し、急ブレーキ・速度超過などの判定とDynamoDBの最新位置更新を行う",
        "同じストリームをData Firehoseも並行して読み取り、全履歴をS3へ保存して後から走行分析に使う"
      ],
      services: [
        { icon: "services/kinesis-data-streams", name: "Amazon Kinesis Data Streams", role: "高頻度の位置データを受け止めるストリーム。複数の読み手に同じデータを配れる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "ストリームをまとめ読みして判定・最新位置更新を行う" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "車両ごとの最新位置。管理画面はここを読む" },
        { icon: "services/data-firehose", name: "Amazon Data Firehose", role: "ストリームからS3への自動配送。リアルタイム系と蓄積系を分離する" },
        { icon: "services/s3", name: "Amazon S3", role: "走行履歴の長期保存。運行分析・ドライブレコーダー連携の土台" }
      ],
      points: [
        "1本のストリームに複数のコンシューマー（読み手）を付けられるのがKinesisの強み。リアルタイム判定と全量蓄積を1つの入口で両立できる",
        "シャード数＝処理能力。1シャードで秒間1MB・1,000レコードが目安なので、台数×頻度から逆算して増減する",
        "地図表示やジオフェンスが必要なら、推奨構成のLocation Serviceを地図・通知係として併用できる（排他ではない）"
      ],
      pros: [
        "数千台×秒間隔の高頻度でも受け止められる",
        "リアルタイム分析と全履歴の蓄積を1本のパイプで両立でき、データの再処理もできる",
        "位置以外のテレメトリ（速度・燃費など）も同じ経路に載せられる"
      ],
      cons: [
        "地図表示・ジオフェンスは含まれないため別途用意する必要がある",
        "シャードの管理・スケーリングの知識が必要",
        "車両100台・30秒間隔程度の規模には過剰装備で推奨構成より複雑"
      ],
      cost: "<strong>月3,000円〜1万円程度</strong>（1〜2シャード約2,000〜4,000円＋PUT課金＋Lambda・DynamoDB・S3で数千円。台数が増えたらシャード追加で階段状に増える）。",
      references: [
        { title: "Amazon Kinesis Data Streamsとは", url: "https://docs.aws.amazon.com/ja_jp/streams/latest/dev/introduction.html", note: "シャードの概念の公式解説" },
        { title: "Amazon Data Firehoseとは", url: "https://docs.aws.amazon.com/ja_jp/firehose/latest/dev/what-is-this-service.html" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
      ]
    },
    {
      name: "地図タイル自前配信（EC2 + S3 + CloudFront）",
      when: "自社独自の地図・屋内図面・特殊な表現が必要で、Location Serviceの地図では足りない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 }
        ],
        nodes: [
          { id: "user", icon: "resources/mobile-client", label: "アプリ・\n管理画面", col: 0, row: 0 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "ec2", icon: "services/ec2", label: "EC2\nタイルサーバー", col: 3, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n生成済みタイル", col: 2, row: 1 }
        ],
        edges: [
          { from: "user", to: "cf", label: "タイル取得" },
          { from: "cf", to: "s3", label: "静的タイル", dashed: true },
          { from: "cf", to: "igw", label: "動的生成" },
          { from: "igw", to: "ec2" },
          { from: "ec2", to: "s3", label: "生成結果を保存" }
        ]
      },
      flow: [
        "地図タイル（地図画像をズームレベルごとに細かく分割したもの）は事前生成してS3に置き、CloudFront経由でキャッシュ配信する",
        "未生成のズームレベルや動的スタイルの要求は、CloudFrontからVPC内のEC2タイルサーバーへ転送してオンデマンド描画する",
        "EC2が生成したタイルはS3へ保存し、次回以降は静的配信に切り替えてEC2に負荷をかけない",
        "車両位置の収集・照会APIは推奨構成と同じくAPI Gateway＋Lambda＋DynamoDBを併用する（図では省略）"
      ],
      services: [
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "タイルのCDN配信。キャッシュヒットさせてEC2とS3の負荷・費用を抑える" },
        { icon: "services/s3", name: "Amazon S3", role: "生成済みタイルの置き場。静的配信の主役" },
        { icon: "services/ec2", name: "Amazon EC2", role: "オープンソースのタイルサーバー（タイル描画ソフト）を動かす仮想サーバー。OSから自分で管理する" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "VPCの玄関。EC2を使うためVPCと入口が必要になる" }
      ],
      points: [
        "OpenStreetMapデータ＋オープンソースタイルサーバーの構成が定番だが、地図データの定期更新・ライセンス表記・スタイル管理まで全部自前になる",
        "タイルはCloudFrontで長期キャッシュし、EC2を「初回生成専用」に追い込むのが費用と安定性の鍵",
        "ここまでやる価値があるかは要件次第。まずLocation Serviceのスタイル変更で足りないかを確認してからにする"
      ],
      pros: [
        "地図の見た目・データ・レイヤーを完全に制御できる",
        "屋内図面・独自注記など特殊要件に対応できる",
        "配信自体はCDNキャッシュが効くため、閲覧数が増えても費用が伸びにくい"
      ],
      cons: [
        "地図データ更新・タイル生成パイプラインの運用が重い",
        "EC2のOS保守・セキュリティパッチが自分持ちになる",
        "開発工数・必要な専門知識（GIS）が3案の中で最大"
      ],
      cost: "<strong>月1万円〜3万円程度</strong>（t3.medium相当のEC2約5,000円＋S3数十GB＋CloudFront転送量。タイル事前生成のバッチを回す月は一時的にEC2費用が増える）。",
      references: [
        { title: "Amazon CloudFrontとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Introduction.html", note: "CDNキャッシュ配信の公式ガイド" },
        { title: "Amazon EC2とは", url: "https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/concepts.html" },
        { title: "Amazon S3とは", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/Welcome.html" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月5,000円〜2万円程度</strong>（車両100台・30秒間隔・バッチ送信）。位置APIの従量課金が中心なので、送信頻度と台数がそのまま費用に効く。Kinesis案は<strong>月3,000円〜1万円程度</strong>から高頻度・大規模に伸ばせるが地図は別途。自前タイル案は<strong>月1万円〜3万円程度</strong>に加えて運用人件費が実質のコストになる。</p>",
  summary: "<p>位置情報トラッキングは「<strong>地図・追跡・ジオフェンスをどこから調達するか</strong>」が設計の中心です。Location Serviceを使えば外部契約なしにAWS内で完結し、機微な位置データを外に出さずに済みます。頻度と台数が桁で増えるならKinesisのストリーム処理へ、地図表現が特殊ならタイル自前配信へ、という分岐ですが、後者2つは推奨構成との併用もできる点を覚えておくと選択の幅が広がります。</p>"
});
