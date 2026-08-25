// ケース38：IoTセンサーデータ収集
registerCase({
  id: 38,
  category: "IoT・リアルタイム",
  title: "IoTセンサーデータ収集",
  scenario: "<p>製造業の工場に温度・振動センサーを数百〜数千台設置し、設備の稼働データを1分間隔で収集したい。集めたデータは日次で分析して設備故障の予兆検知に活かす。将来はリアルタイムの異常検知にも広げたい。センサーはMQTT（IoT向けの軽量通信プロトコル）で送信できるものを採用予定。分析はSQLが書けるデータ担当者が行う。</p>",
  requirements: [
    "数千台規模のセンサーからMQTTでデータを受信したい",
    "受信データを取りこぼしなく蓄積し、後から再処理もできるようにしたい",
    "蓄積したデータをSQLで分析したい（BIツール連携も見据える）",
    "デバイスの証明書認証でなりすましを防ぎたい",
    "サーバーの管理はしたくない",
    "将来リアルタイム異常検知を後付けしたい"
  ],
  main: {
    name: "IoT Core + Kinesis + Firehose + S3 + Athena（データレイク収集）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "sensor", icon: "resources/client", label: "センサー群\n数百〜数千台", col: 0, row: 0 },
        { id: "iot", icon: "services/iot-core", label: "IoT Core\nMQTT受信", col: 1, row: 0 },
        { id: "kds", icon: "services/kinesis-data-streams", label: "Kinesis Data\nStreams", col: 2, row: 0 },
        { id: "fh", icon: "services/data-firehose", label: "Data Firehose\n変換・バッファ", col: 3, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\nデータレイク", col: 4, row: 0 },
        { id: "athena", icon: "services/athena", label: "Athena\nSQL分析", col: 4, row: 1 },
        { id: "analyst", icon: "resources/user", label: "データ担当者", col: 0, row: 1 }
      ],
      edges: [
        { from: "sensor", to: "iot", label: "MQTT/TLS" },
        { from: "iot", to: "kds", label: "ルールで転送" },
        { from: "kds", to: "fh", label: "ストリーム読取" },
        { from: "fh", to: "s3", label: "まとめて保存" },
        { from: "athena", to: "s3", label: "直接クエリ", dashed: true },
        { from: "analyst", to: "athena", label: "SQL分析" }
      ]
    },
    flow: [
      "センサーはX.509クライアント証明書でIoT CoreにMQTT接続し、測定値をトピック（宛先チャンネル）に発行する",
      "IoT Coreのルールエンジンが受信メッセージをKinesis Data Streamsへ流す。ここが瞬間的な大量受信を受け止めるバッファになる",
      "Data FirehoseがStreamsからデータを読み取り、圧縮・列指向形式（Parquet）への変換・日付フォルダ分けをした上でS3へまとめて書き込む",
      "データ担当者はAthenaでS3上のファイルを直接SQL分析する。DBサーバーへのロード作業は不要"
    ],
    services: [
      { icon: "services/iot-core", name: "AWS IoT Core", role: "MQTTの受け口。デバイス証明書の認証・トピック単位の権限制御・ルールエンジンによる振り分けを担う" },
      { icon: "services/kinesis-data-streams", name: "Amazon Kinesis Data Streams", role: "受信データを一時的に貯めるストリーム。複数の読み手（蓄積用・リアルタイム分析用）へ同じデータを配れる" },
      { icon: "services/data-firehose", name: "Amazon Data Firehose", role: "ストリームからS3への配送係。一定時間・一定量でまとめて書き込み、形式変換もこなす" },
      { icon: "services/s3", name: "Amazon S3", role: "生データの蓄積先（データレイク）。安価に無制限へ近くスケールする" },
      { icon: "services/athena", name: "Amazon Athena", role: "S3上のファイルをそのままSQLで分析するクエリサービス。スキャンした量だけの課金" }
    ],
    points: [
      "IoT Coreから直接S3に書かずKinesisを挟むのは、瞬間的な受信ピークの吸収と「同じデータを複数の処理に分岐できる」ため。将来のリアルタイム異常検知はこのストリームにコンシューマーを追加するだけでよい",
      "Firehoseのバッファリング（数MBまたは60秒単位でまとめ書き）で、S3に小さいファイルが大量にできる「スモールファイル問題」を回避する",
      "Parquet変換と日付パーティションでAthenaのスキャン量を絞ると、分析コストが桁で変わる",
      "デバイスごとに証明書とIoTポリシーを発行し、発行できるトピックを自分のIDに限定する。1台が乗っ取られても他デバイスへのなりすましはできない"
    ],
    pros: [
      "全マネージドでサーバー管理ゼロ。デバイス数の増加にほぼ線形にスケールする",
      "生データがS3に残るため、後から別の切り口で分析をやり直せる",
      "リアルタイム処理を後付けしやすい（Kinesisにコンシューマー追加）",
      "Athenaは使った分だけの課金で、分析しない月は費用がかからない"
    ],
    cons: [
      "登場サービスが多く、初学者には全体像の把握とデバッグが大変",
      "「今この瞬間の値」を見る用途には向かない（S3到着まで1分程度の遅延がある）",
      "Kinesisのシャード数やFirehoseのバッファ設定など、チューニング項目がある"
    ],
    cost: "<strong>月1万円〜2万円程度</strong>（センサー1,000台・1分間隔送信＝月約4,300万メッセージの想定。IoT Coreのメッセージ課金約6,500円＋Kinesis1〜2シャード約2,000〜4,000円＋Firehose・S3・Athenaで数千円）。デバイス100台規模なら月数千円に収まる。",
    references: [
      { title: "AWS IoT Coreとは", url: "https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/what-is-aws-iot.html", note: "IoT Core公式デベロッパーガイド" },
      { title: "AWS IoTのルール", url: "https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/iot-rules.html", note: "ルールエンジンでKinesis等へ振り分ける仕組み" },
      { title: "Amazon Kinesis Data Streamsとは", url: "https://docs.aws.amazon.com/ja_jp/streams/latest/dev/introduction.html" },
      { title: "Amazon Data Firehoseとは", url: "https://docs.aws.amazon.com/ja_jp/firehose/latest/dev/what-is-this-service.html", note: "バッファリングと形式変換の解説" },
      { title: "Amazon Athenaとは", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/what-is.html" }
    ]
  },
  alternatives: [
    {
      name: "IoT Core + Lambda + DynamoDB（少数デバイス・即時参照）",
      when: "デバイスが数十台規模で、蓄積分析よりも「今の値をすぐ見たい」が主目的の場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "sensor", icon: "resources/client", label: "センサー\n数十台", col: 0, row: 0 },
          { id: "iot", icon: "services/iot-core", label: "IoT Core\nMQTT受信", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n受信処理", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n最新値・履歴", col: 3, row: 0 }
        ],
        edges: [
          { from: "sensor", to: "iot", label: "MQTT/TLS" },
          { from: "iot", to: "lambda", label: "ルールで起動" },
          { from: "lambda", to: "ddb", label: "最新値を保存" }
        ]
      },
      flow: [
        "センサーがIoT CoreへMQTTで測定値を送る（認証は推奨構成と同じ証明書方式）",
        "IoT CoreのルールがメッセージごとにLambdaを起動し、閾値チェックなどの軽い処理を行う",
        "LambdaがDynamoDBへ最新値と履歴を書き込む。閲覧アプリはAPI Gateway＋Lambda経由でこのテーブルを読む（図では省略）"
      ],
      services: [
        { icon: "services/iot-core", name: "AWS IoT Core", role: "MQTTの受け口と証明書認証。推奨構成と同じ役割" },
        { icon: "services/lambda", name: "AWS Lambda", role: "受信メッセージ単位の処理。閾値超過の通知などもここに書ける" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "最新値の即時参照に強いNoSQL DB。ミリ秒で読める" }
      ],
      points: [
        "DynamoDBは「デバイスID＋タイムスタンプ」を主キーにすると、最新値の取得も期間指定の履歴取得も1つのテーブルで効率よく引ける",
        "古いデータはTTL（有効期限）で自動削除し、長期保存が必要になったらS3エクスポートを併用する",
        "メッセージ量が増えるとLambda起動回数がそのまま費用になる。1台あたり秒単位の送信頻度になったら推奨構成（ストリーム経由）への切り替えを検討する"
      ],
      pros: [
        "構成が小さく理解しやすい。受信から参照までのタイムラグが秒未満",
        "小規模なら月数百円で運用できる",
        "閾値アラートなどの即時処理を書きやすい"
      ],
      cons: [
        "生データ全量の長期蓄積やSQL分析には不向き",
        "一度処理したデータの再処理（もう一度流し直す）ができない",
        "大量メッセージではLambda起動が割高になる"
      ],
      cost: "<strong>月数百円〜3,000円程度</strong>（デバイス50台・1分間隔＝月約220万メッセージの想定。IoT Core約330円＋Lambdaはほぼ無料枠内＋DynamoDBオンデマンドで数百円）。",
      references: [
        { title: "AWS IoTルールアクション", url: "https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/iot-rule-actions.html", note: "Lambda連携を含むアクション一覧" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
        { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" }
      ]
    },
    {
      name: "Amazon MSK（既存Kafka資産・大規模ストリーム）",
      when: "既にKafkaで動く収集基盤・消費アプリがあり、それを活かしつつ大規模ストリームを扱いたい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "producer", icon: "resources/client", label: "既存Kafka\nプロデューサー", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "msk", icon: "services/msk", label: "MSK\nKafkaクラスター", col: 3, row: 0 },
          { id: "ecs", icon: "services/ecs", label: "ECS\n既存消費アプリ", col: 4, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n長期保存", col: 5, row: 1 }
        ],
        edges: [
          { from: "producer", to: "igw", label: "Kafka/TLS" },
          { from: "igw", to: "msk" },
          { from: "msk", to: "ecs", label: "ストリーム消費" },
          { from: "ecs", to: "s3", label: "加工して保存" }
        ]
      },
      flow: [
        "工場側の既存Kafkaプロデューサーは、接続先をMSK（マネージドKafka）に変えてデータを送信する。インターネット経由の場合はTLS＋認証を有効化した公開アクセスを使う",
        "MSKはVPC内のプライベートサブネットでブローカーを稼働させる。既存のトピック設計・パーティション設計をそのまま持ち込める",
        "既存のコンシューマーアプリをECSで動かし、ストリームを消費して加工後のデータをS3へ保存する"
      ],
      services: [
        { icon: "services/msk", name: "Amazon MSK", role: "Apache Kafkaのマネージドサービス。ブローカーの構築・パッチをAWSに任せられる" },
        { icon: "services/ecs", name: "Amazon ECS", role: "既存のKafkaコンシューマーアプリをコンテナで動かす実行基盤" },
        { icon: "services/s3", name: "Amazon S3", role: "加工済みデータの長期保存先。ここから先は推奨構成と同じくAthena分析につなげられる" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "VPCの玄関。MSKはVPC内で動くサービスなので、外部からの入口が必要になる" }
      ],
      points: [
        "MSKはVPC内で動くサービスなので、推奨構成（全てVPC外のマネージドサービス）と違いVPC・サブネット設計が必要になる。工場と閉域でつなぐならVPNやDirect Connect接続も選べる",
        "最大の価値は既存のKafkaプロデューサー・コンシューマーのコードをほぼ無改修で移行できること。Kafka Connectなどのエコシステムもそのまま使える",
        "ブローカーは常時起動の固定費。小規模・変動が大きい場合はMSK Serverlessという従量課金の選択肢もある",
        "Kafka資産がないなら、運用がより軽いKinesis（推奨構成）を選ぶのがAWSでの定石"
      ],
      pros: [
        "既存Kafka資産（コード・運用ノウハウ・Connect連携）を最大限活かせる",
        "非常に大きいスループットまでスケールし、データの読み直し（リプレイ）の自由度が高い",
        "オンプレKafkaの運用（ブローカー保守・パッチ）から解放される"
      ],
      cons: [
        "ブローカー常時起動の固定費が高く、小規模には割に合わない",
        "VPC・スケーリング・パーティション設計などKafka自体の専門知識は引き続き必要",
        "推奨構成と比べて構成要素の運用責任（コンシューマーアプリ等）が残る"
      ],
      cost: "<strong>月5万円〜15万円程度</strong>（kafka.m5.large相当×2〜3ブローカー＋ストレージの常時起動＋ECSタスクの想定。同じ流量ならKinesis案の数倍になりやすい）。",
      references: [
        { title: "Amazon MSKとは", url: "https://docs.aws.amazon.com/ja_jp/msk/latest/developerguide/what-is-msk.html", note: "MSK公式デベロッパーガイド" },
        { title: "Apache KafkaクラスターのAmazon MSKへの移行", url: "https://docs.aws.amazon.com/ja_jp/msk/latest/developerguide/migration.html", note: "既存Kafkaからの移行ガイド" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1万円〜2万円程度</strong>（センサー1,000台・1分間隔）。Lambda＋DynamoDB案は<strong>月数百円〜3,000円程度</strong>と最安だが、蓄積分析と再処理を諦めることになる。MSK案は<strong>月5万円〜15万円程度</strong>の固定費で、既存Kafka資産を持つ組織以外には過剰投資になりやすい。デバイス数と「蓄積して分析したいか」で三択が分かれる。</p>",
  summary: "<p>IoTデータ収集の定石は「<strong>受信（IoT Core）→バッファ（Kinesis）→蓄積（S3）→分析（Athena）を分業させる</strong>」ことです。途中にストリームを挟むことで、ピークの吸収・再処理・リアルタイム処理の後付けが全部できるようになります。逆にデバイスが少なく即時参照が主目的ならLambda＋DynamoDBの直結が最短、既存Kafka資産があるならMSKという分岐で、「規模」と「既存資産」が選定の軸になります。</p>",
  quiz: [
    {
      q: "IoT Coreから直接S3へ書き込まず、あいだにKinesis Data Streamsを挟んでいるのはなぜでしょうか。",
      a: "瞬間的な受信ピークを吸収することと、同じデータを複数の処理へ分岐できるようにするためです。ストリームがバッファになるので数千台が一斉に送っても取りこぼしが起きず、蓄積用のFirehoseとは別に、将来のリアルタイム異常検知のコンシューマーを後から足すだけで拡張できます。直結にしてしまうと、処理を増やしたくなったときにデータの流れ自体を作り直すことになります。"
    },
    {
      q: "デバイスが50台で、目的も「今の値をすぐ見たい」だけだったとしたら、あなたならこの構成をどう変えるでしょうか。",
      a: "代替1のIoT Core＋Lambda＋DynamoDBの直結に寄せます。ストリームや列指向形式への変換は蓄積分析のための仕掛けなので、即時参照が主目的なら過剰装備で、デバイスIDとタイムスタンプを主キーにDynamoDBへ書くほうが構成が小さく遅延も秒未満になるためです。ただし全量の長期蓄積や再処理はできなくなるので、送信頻度が秒単位に上がったりSQL分析の要件が出てきたら推奨構成へ移す判断が必要です。"
    },
    {
      q: "FirehoseでParquet形式へ変換し、日付でフォルダ分けしているのは分析にどう効いてくるのでしょうか。",
      a: "Athenaはスキャンしたデータ量に応じた課金なので、読む量を減らすことが速度と費用に直結するためです。列指向のParquetにすると必要な列だけを読めるようになり、日付でパーティションを切ると期間指定のクエリが該当フォルダしか見なくなります。あわせて一定時間・一定量でまとめ書きすることで、S3に小さなファイルが大量にできて検索効率が落ちるスモールファイル問題も避けられます。"
    }
  ]
});
