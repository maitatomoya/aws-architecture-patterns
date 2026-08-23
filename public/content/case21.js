// ケース21：ニアリアルタイム分析基盤
registerCase({
  id: 21,
  category: "データ・分析",
  title: "ニアリアルタイム分析基盤",
  scenario: "<p>スマホアプリとWebサイトのクリック・画面遷移・購入といった行動イベントを集め、「いま何が起きているか」を数分以内に分析へ反映したい。キャンペーン開始直後の反応を見て当日中に打ち手を変えるのが狙い。イベントは平常時で秒間数百件、キャンペーン時は数千件まで跳ねる。集めたデータは日次のレポートや過去比較にも使うため、消さずに蓄積しておきたい。</p>",
  requirements: [
    "発生から数分以内のデータを分析クエリに反映したい（ニアリアルタイム）",
    "秒間数百〜数千件のイベントを取りこぼさず受けたい",
    "生データを長期蓄積し、後からの再分析にも使いたい",
    "急なイベント増でも受け口が詰まらないようにしたい",
    "サーバーの常時運用なしで、規模に応じた課金にしたい"
  ],
  main: {
    name: "Kinesis Data Streams + Firehose + S3 + Athena",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "src", icon: "resources/client", label: "アプリ・Web", col: 0, row: 0 },
        { id: "kds", icon: "services/kinesis-data-streams", label: "Kinesis\nData Streams", col: 1, row: 0 },
        { id: "fh", icon: "services/data-firehose", label: "Data Firehose", col: 2, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\nデータレイク", col: 3, row: 0 },
        { id: "athena", icon: "services/athena", label: "Athena", col: 4, row: 1 },
        { id: "analyst", icon: "resources/user", label: "分析者", col: 5, row: 1 }
      ],
      edges: [
        { from: "src", to: "kds", label: "イベント送信" },
        { from: "kds", to: "fh", label: "ストリーム読取" },
        { from: "fh", to: "s3", label: "まとめて書込" },
        { from: "athena", to: "s3", label: "スキャン" },
        { from: "analyst", to: "athena", label: "SQLクエリ" }
      ]
    },
    flow: [
      "アプリ・Webの行動イベントをKinesis Data Streams（ストリームデータの受け口）へ送信する。急増時もストリームが受け止め、受け口が詰まらない",
      "Data Firehoseがストリームからイベントをまとめて読み取り、60秒〜数分のバッファ単位でS3へ書き込む。Parquet形式への変換もFirehose任せにできる",
      "S3には数分遅れの最新データが溜まり続け、そのまま長期蓄積のデータレイクになる",
      "分析者はAthenaでSQLを実行し、発生数分後のイベントまで含めて集計できる"
    ],
    services: [
      { icon: "services/kinesis-data-streams", name: "Amazon Kinesis Data Streams", role: "秒間数千件級のイベントを受けるストリームの受け口。データを一定期間保持し、複数の読み手が同じデータを使える" },
      { icon: "services/data-firehose", name: "Amazon Data Firehose", role: "ストリームをS3へ自動配信する配達係。バッファリング・形式変換・圧縮をコードなしで行う" },
      { icon: "services/s3", name: "Amazon S3", role: "イベントの長期蓄積先。ニアリアルタイム分析と過去分析の両方の土台になる" },
      { icon: "services/athena", name: "Amazon Athena", role: "S3上のイベントへ直接SQLを実行するクエリエンジン。サーバー不要でスキャン量課金" }
    ],
    points: [
      "「リアルタイム風に見せたい」だけなら自前のストリーム処理は書かず、Firehoseのバッファ配信に任せるのが最小構成。数分遅れが許容できるかどうかが、この構成で足りるか否かの分岐点",
      "FirehoseでParquet変換と日付パーティション出力までやっておくと、Athenaのスキャン費用と応答時間が桁で改善する（データレイクのケースと同じ急所）",
      "Kinesisのシャード（ストリームの処理単位）は秒間1MB/1,000件が上限。流量が読めないうちはオンデマンドモードにして自動拡張に任せ、安定したらプロビジョンドで単価を下げる",
      "この構成はすべてVPC外のマネージドサービスで完結しており、ゲートウェイ類が登場しない。ネットワーク設計なしで秒間数千件を受けられるのがサーバーレスストリームの価値"
    ],
    pros: [
      "受け口からクエリまでフルマネージドで、常時運用するサーバーがない",
      "急増時はシャード追加（またはオンデマンド自動拡張）で受け続けられる",
      "S3蓄積がそのままデータレイクになり、日次レポートにも二次利用できる",
      "ストリーム処理のコードを書かずに数分遅れの分析が手に入る"
    ],
    cons: [
      "反映まで数十秒〜数分の遅延があり、秒単位のリアルタイム表示はできない",
      "Athenaのクエリ応答は数秒〜数十秒で、画面への即時埋め込みには不向き",
      "シャード数・バッファ設定などストリーム固有のチューニング項目を理解する必要がある"
    ],
    cost: "<strong>月3,000円〜1万円程度</strong>（プロビジョンド1シャード約2,200円+Firehose月100GBで約450円+S3保存料+Athenaスキャン分。流量が増えるとシャード数に比例して伸びる）。",
    references: [
      { title: "Amazon Kinesis Data Streamsとは", url: "https://docs.aws.amazon.com/ja_jp/streams/latest/dev/introduction.html" },
      { title: "Amazon Data Firehoseとは", url: "https://docs.aws.amazon.com/ja_jp/firehose/latest/dev/what-is-this-service.html", note: "バッファリングと形式変換の公式解説" },
      { title: "Amazon Athenaとは", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/what-is.html" },
      { title: "AthenaからのAWS Glueの使用", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/glue-athena.html", note: "S3上のイベントをテーブルとして扱う仕組み" }
    ]
  },
  alternatives: [
    {
      name: "Kinesis + Lambda + DynamoDB（即時集計参照）",
      when: "「現在のアクティブユーザー数」「キャンペーンの現在申込数」のような集計値を、画面から秒単位の鮮度で即時参照したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "src", icon: "resources/client", label: "アプリ・Web", col: 0, row: 0 },
          { id: "kds", icon: "services/kinesis-data-streams", label: "Kinesis\nData Streams", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n逐次集計", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n集計値", col: 3, row: 0 },
          { id: "dash", icon: "resources/client", label: "管理画面", col: 4, row: 1 }
        ],
        edges: [
          { from: "src", to: "kds", label: "イベント送信" },
          { from: "kds", to: "fn", label: "ストリーム処理" },
          { from: "fn", to: "ddb", label: "集計値を更新" },
          { from: "dash", to: "ddb", label: "最新値を参照" }
        ]
      },
      flow: [
        "行動イベントをKinesis Data Streamsで受けるところまでは推奨構成と同じ",
        "Lambdaがストリームからイベントを数百件ずつのバッチで受け取り、到着のたびに集計値を計算する",
        "「キャンペーンAの申込数」「5分窓のアクティブユーザー数」のような集計結果をDynamoDBのカウンターとして更新する",
        "管理画面はDynamoDBをキー指定で読むだけなので、数ミリ秒で最新値を表示できる"
      ],
      services: [
        { icon: "services/kinesis-data-streams", name: "Amazon Kinesis Data Streams", role: "イベントの受け口。Lambdaとの組み合わせが標準サポートされている" },
        { icon: "services/lambda", name: "AWS Lambda", role: "ストリームを逐次処理する集計エンジン。シャードごとに並列で動く" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "集計値の置き場。キー参照が数ミリ秒で返るため画面表示に直結できる" }
      ],
      points: [
        "SQLエンジンを経由せず「事前に計算した答えをキーで引く」構造にするのが即時参照の本質。クエリを速くするのではなく、クエリを不要にする発想の転換",
        "集計項目はあらかじめ決めておく必要がある。後から自由な切り口で分析したい要望には応えられないため、推奨構成のS3蓄積と併設する（Firehoseを並走させる）のが実務の定石",
        "Lambdaの失敗時はシャードの同じ位置から再実行されるため、カウンター加算は二重計上されうる。イベントIDでの冪等化か、二重を許容できる設計にしておく",
        "DynamoDBの1項目に書き込みが集中するホットパーティションに注意。時間帯別キーに分散するなどキー設計で回避する"
      ],
      pros: [
        "集計値の参照が数ミリ秒で、ユーザー向け画面にもそのまま使える鮮度と速度",
        "発生から反映まで数秒と、3案の中で最も遅延が小さい",
        "フルマネージド・従量課金でサーバー運用がない"
      ],
      cons: [
        "決めた集計項目しか見られず、アドホック分析はできない",
        "集計ロジックを自分でコードとして実装・保守する必要がある",
        "ウィンドウ集計や順序の扱いなど、ストリーム処理特有の考慮が増える"
      ],
      cost: "<strong>月2,000円〜8,000円程度</strong>（1シャード約2,200円+Lambda・DynamoDBの従量分。S3蓄積を並設する場合は推奨構成の費用が加算される）。",
      references: [
        { title: "LambdaとAmazon Kinesisの連携", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-kinesis.html", note: "ストリームをLambdaで処理する公式解説" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
        { title: "Amazon Kinesis Data Streamsとは", url: "https://docs.aws.amazon.com/ja_jp/streams/latest/dev/introduction.html" }
      ]
    },
    {
      name: "Amazon MSK（Kafka）ストリーム基盤",
      when: "既にKafkaを使った収集・処理資産がある場合や、秒間数万件超・複数チームが同じストリームを共有する大規模基盤の場合",
      diagram: {
        cols: 7, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [6, 1] },
          { type: "vpc", label: "VPC", from: [1, 0], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [2, 0], to: [2, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 1, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 2, row: 0 },
          { id: "prod", icon: "services/ecs", label: "収集アプリ\nECS", col: 3, row: 0 },
          { id: "msk", icon: "services/msk", label: "MSK\nKafkaクラスター", col: 4, row: 0 },
          { id: "cons", icon: "services/ecs", label: "変換処理\nECS", col: 4, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nデータレイク", col: 5, row: 1 },
          { id: "athena", icon: "services/athena", label: "Athena", col: 6, row: 1 }
        ],
        edges: [
          { from: "prod", to: "msk", label: "Produce" },
          { from: "msk", to: "cons", label: "Consume" },
          { from: "cons", to: "s3", label: "整形して保存" },
          { from: "athena", to: "s3", label: "スキャン" },
          { from: "cons", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "各サービスからのイベントは、VPCのプライベートサブネットで動く収集アプリ（ECS）がKafkaのトピックへProduce（発行）する",
        "MSKがKafkaクラスターを運用し、イベントを一定期間保持する。複数チームのコンシューマーが同じストリームを独立に読める",
        "変換処理のECSがConsume（購読）してイベントを整形し、S3のデータレイクへ書き出す。分析はAthenaで行う",
        "S3への書き出しなどプライベートサブネットからの外向き通信は、NATゲートウェイ経由でインターネットゲートウェイから出る（破線。VPCエンドポイントで置き換え可能）"
      ],
      services: [
        { icon: "services/msk", name: "Amazon MSK", role: "Apache Kafkaのマネージドサービス。超高スループットの受け口と長期のストリーム保持を提供" },
        { icon: "services/ecs", name: "Amazon ECS", role: "収集アプリと変換処理の実行基盤。Kafkaクライアントの常駐運用に向く" },
        { icon: "services/s3", name: "Amazon S3", role: "整形後イベントの蓄積先。ここから先は推奨構成と同じ分析の土台" },
        { icon: "services/athena", name: "Amazon Athena", role: "蓄積されたイベントへのSQL分析" },
        { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットからS3等へ出る外向き通信の出口" }
      ],
      points: [
        "Kinesisとの本質的な違いは互換性と保持期間の柔軟さ。Kafkaプロトコル前提のOSS・SaaS資産（Kafka Connect・Streams等）をそのまま接続でき、既存資産があるなら移行コストを大きく節約できる",
        "パーティション単位の順序保証と長期保持により「複数チームが同じイベントを別々の目的で読み直す」大規模データ基盤の背骨に向く",
        "MSKはVPC内サービスのため、サーバーレス構成には無かったVPC・サブネット・ゲートウェイの設計と、ブローカー・パーティションの容量設計が必要になる",
        "S3への書き出しは自前コンシューマーの代わりにMSK Connect（マネージドのKafka Connect）を使うと実装量を減らせる"
      ],
      pros: [
        "秒間数万件超のスループットと順序保証・再読込に対応できる",
        "Kafkaエコシステムと既存資産をそのまま活かせる",
        "保持期間を長く取り、ストリーム自体をデータ基盤の中心に据えられる"
      ],
      cons: [
        "クラスター常時稼働とNATの固定費で、3案の中で最も高価",
        "VPC設計+Kafka運用の学習・運用コストが高く、専任不在だと持て余す",
        "小規模な流量ではオーバースペックで、Kinesisで十分なことが多い"
      ],
      cost: "<strong>月1万円〜10万円超</strong>（検証用kafka.t3.small×2台+NATで約2万円、本番想定のkafka.m5.large×3台では月8万円〜+ストレージ・転送量）。",
      references: [
        { title: "Amazon MSKとは", url: "https://docs.aws.amazon.com/ja_jp/msk/latest/developerguide/what-is-msk.html" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html", note: "外向き通信経路の一次情報" },
        { title: "Amazon Athenaとは", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/what-is.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Kinesis+Firehose+S3+Athena）は<strong>月3,000円〜1万円程度</strong>で数分遅れの分析が手に入る。即時参照が要るならLambda+DynamoDB案を<strong>月2,000円〜8,000円程度</strong>で併設する形が現実的。MSK案は<strong>月1万円〜10万円超</strong>の固定費型で、秒間数万件超またはKafka資産がある場合に初めて採算が合う。遅延要件（数分か数秒か）と流量が費用構造を決める。</p>",
  summary: "<p>ストリーム分析は<strong>「どこまでの遅延を許容できるか」で構成が決まります</strong>。数分でよければKinesis+Firehose+S3+Athenaのコードほぼゼロ構成、秒単位の集計値参照が必要な部分だけLambda+DynamoDBで事前集計、というのが定番の組み合わせです。両者は排他ではなく、同じストリームから並走させられるのがKinesisの強み。Kafka（MSK）は流量と資産の条件がそろったときの選択肢で、最初の一手には重すぎることが多い。<strong>まずストリームで受けてS3に残す</strong>という背骨さえ作れば、分析の即時性は後から段階的に足せます。</p>"
});
