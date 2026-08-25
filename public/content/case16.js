// ケース16：定期バッチ処理
registerCase({
  id: 16,
  category: "サーバーレス・イベント駆動",
  title: "定期バッチ処理",
  scenario: "<p>毎日深夜2時に前日の売上データを集計してレポートを作る、毎時0分に外部システムからデータを取り込む、といった定期実行の処理を整備したい。今は1台のEC2にcronを仕込んでいるが、そのサーバーが単一障害点になっており、失敗しても誰も気づかず翌朝発覚する事故が起きた。処理時間は数十秒〜10分程度が中心だが、月次の集計だけは1時間近くかかる。バッチのためだけにサーバーを常時起動しておくのはやめたい。</p>",
  requirements: [
    "cron相当のスケジュール実行をサーバーなしで実現したい",
    "失敗したら即座に通知を受け取り、翌朝発覚をなくしたい",
    "実行履歴・ログを一元的に確認できるようにしたい",
    "処理がない時間帯のコストをゼロに近づけたい",
    "15分を超える重いバッチや、順序依存のあるジョブ群にも将来対応したい"
  ],
  main: {
    name: "EventBridge Scheduler + Lambda + CloudWatch + SNS（サーバーレスcron）",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [2, 1] }
      ],
      nodes: [
        { id: "scheduler", icon: "services/eventbridge", label: "EventBridge\nScheduler", col: 0, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\n集計バッチ", col: 1, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\nレポート保存", col: 2, row: 0 },
        { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nログ・アラーム", col: 1, row: 1 },
        { id: "sns", icon: "services/sns", label: "SNS\n失敗通知", col: 2, row: 1 },
        { id: "email", icon: "resources/email", label: "担当者へ\nメール", col: 3, row: 1 }
      ],
      edges: [
        { from: "scheduler", to: "fn", label: "cron(毎日2時)起動" },
        { from: "fn", to: "s3", label: "集計結果を保存" },
        { from: "fn", to: "cw", label: "ログ・メトリクス", dashed: true },
        { from: "cw", to: "sns", label: "失敗アラーム" },
        { from: "sns", to: "email", label: "メール通知" }
      ]
    },
    flow: [
      "EventBridge Schedulerにcron式（例：cron(0 2 * * ? *)＝毎日2時）でスケジュールを登録しておく",
      "指定時刻になるとSchedulerがLambdaを起動し、集計処理を実行して結果レポートをS3へ保存する",
      "実行ログと成功・失敗のメトリクスは自動でCloudWatchに記録される",
      "CloudWatchアラームがLambdaのエラー数を監視し、失敗するとSNS経由で担当者へ即時メール通知する",
      "Scheduler側の起動失敗にも自動リトライとDLQ（失敗イベントの退避先）を設定でき、「実行されなかったことに気づかない」を防げる"
    ],
    services: [
      { icon: "services/eventbridge", name: "Amazon EventBridge Scheduler", role: "サーバーレスのcron。タイムゾーン指定・自動リトライ・柔軟な時間幅の起動に対応する" },
      { icon: "services/lambda", name: "AWS Lambda", role: "バッチ本体の実行環境。実行した秒数だけの課金で、待機コストがない" },
      { icon: "services/s3", name: "Amazon S3", role: "集計レポート・中間データの保存先" },
      { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "ログの一元管理と失敗の監視。「エラー1件以上でアラーム」が基本設定" },
      { icon: "services/sns", name: "Amazon SNS", role: "アラームの通知配信。メール・チャット連携への振り分け役" }
    ],
    points: [
      "EC2のcronからの移行で一番大きいのは単一障害点の解消。Schedulerはマネージドサービスなので「cronサーバーが落ちていて実行されなかった」が起きない",
      "失敗検知は「バッチが自分で通知メールを送る」実装にしない。バッチ自体が異常終了したら送れないからで、外側のCloudWatchアラームに監視させるのが正解",
      "cron式のタイムゾーンを明示できるのがSchedulerの利点（旧EventBridgeルールはUTCのみ）。「毎日2時」をJSTで書けて時差バグを防げる",
      "この構成にVPCやゲートウェイ類が無いのは省略ではない。全部品がVPC外のマネージドサービスで、バッチのためのネットワーク設計が不要になっている"
    ],
    pros: [
      "バッチが動いていない時間のコストが完全にゼロ",
      "cronサーバーの保守・監視・冗長化から解放される",
      "失敗の即時通知と実行履歴の一元管理が標準機能で揃う",
      "スケジュールの追加・変更がAPI/IaCで管理でき、属人化しない"
    ],
    cons: [
      "Lambdaの実行時間上限15分を超えるバッチは実行できない（代替パターン参照）",
      "同時刻に多数のバッチを集中させると下流のDB負荷が跳ねるため、時刻の分散設計は自分で行う必要がある",
      "ジョブ間の依存関係（AのあとB）を表現する機能はなく、必要ならStep FunctionsやBatchを組み合わせる"
    ],
    cost: "<strong>月0円〜数百円</strong>（Schedulerは月1,400万回まで無料、Lambdaも無料枠が大きい。毎日数本のバッチ程度なら実質無料に近い）。",
    references: [
      { title: "Amazon EventBridge Schedulerとは", url: "https://docs.aws.amazon.com/ja_jp/scheduler/latest/UserGuide/what-is-scheduler.html", note: "Scheduler公式ユーザーガイド" },
      { title: "Schedulerのスケジュールタイプ（cron式）", url: "https://docs.aws.amazon.com/ja_jp/scheduler/latest/UserGuide/schedule-types.html", note: "cron式・レート式・ワンタイムの書き方" },
      { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
      { title: "CloudWatchアラームでメール通知する", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html", note: "失敗通知の構成手順" }
    ]
  },
  alternatives: [
    {
      name: "ECS Fargateのスケジュールタスク（15分超・コンテナ）",
      when: "1回のバッチが15分を超える、メモリを大量に使う、既存バッチをコンテナのまま動かしたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [1, 0], to: [3, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [2, 1], to: [2, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [2, 0], to: [2, 0], depth: 2 }
        ],
        nodes: [
          { id: "scheduler", icon: "services/eventbridge", label: "EventBridge\nScheduler", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 1, row: 1 },
          { id: "task", icon: "services/fargate", label: "Fargate\nバッチコンテナ", col: 2, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 2, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n結果保存", col: 4, row: 0 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ置き場", col: 4, row: 1 }
        ],
        edges: [
          { from: "scheduler", to: "task", label: "スケジュール起動" },
          { from: "task", to: "s3", label: "結果保存" },
          { from: "task", to: "ecr", label: "イメージ取得", dashed: true },
          { from: "task", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "EventBridge Schedulerが指定時刻にECSのRunTask（タスクを1回起動する操作）を呼び出す",
        "VPCのプライベートサブネットにFargateのバッチコンテナが起動し、時間無制限で処理を実行する",
        "起動時のコンテナイメージ取得や外部APIアクセスは、NATゲートウェイ→インターネットゲートウェイ経由の外向き通信で行う（外からの入口は無い）",
        "処理結果をS3へ保存してコンテナは終了し、課金も止まる"
      ],
      services: [
        { icon: "services/eventbridge", name: "Amazon EventBridge Scheduler", role: "推奨構成と同じスケジューラ。起動先をLambdaからECSタスクに変えるだけでよい" },
        { icon: "services/fargate", name: "AWS Fargate", role: "バッチコンテナの実行環境。実行中だけ課金され、時間制限がない" },
        { icon: "services/ecr", name: "Amazon ECR", role: "バッチのコンテナイメージ保管庫" },
        { icon: "services/s3", name: "Amazon S3", role: "結果レポートの保存先" }
      ],
      points: [
        "Schedulerはそのままに実行部分だけを差し替えるのがポイント。「15分を超えたらLambdaをFargateタスクに変える」は定番の移行パターン",
        "バッチコンテナはプライベートサブネットに置き、インターネットからの入口を作らない。図のインターネットゲートウェイは外向き通信（NAT経由）の出口として描かれている",
        "NATゲートウェイは月約45USD（約6,800円）の固定費がかかる。通信先がS3・ECRだけならVPCエンドポイントに置き換えるとNATなしで安く安全にできる",
        "タスク起動に1〜2分かかるため、深夜バッチでは問題にならないが、分単位の高頻度実行には向かない"
      ],
      pros: [
        "実行時間・メモリの制限が実質なくなる（1時間の月次集計も完走できる）",
        "既存バッチをコンテナ化すればコードの大改修なしに移行できる",
        "実行中だけの課金で、常駐サーバーは不要のまま"
      ],
      cons: [
        "VPC・サブネットの設計が必要になり、推奨構成より部品が増える",
        "NATゲートウェイを使う場合は固定費が発生する",
        "コンテナイメージのビルド・管理という運用が増える"
      ],
      cost: "<strong>実行時間分のみで月数十円〜数百円</strong>（1vCPU/2GBを毎日30分で約110円/月。NATゲートウェイを置く場合は月約45USD（約6,800円）が加算されるため、VPCエンドポイント代替を検討）。",
      references: [
        { title: "ECSのスケジュールされたタスク", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/scheduled_tasks.html", note: "SchedulerからECSタスクを定期起動する公式手順" },
        { title: "AWS Fargateとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html", note: "固定費と代替（VPCエンドポイント）検討の一次情報" }
      ]
    },
    {
      name: "AWS Batch（依存関係のあるジョブ群）",
      when: "「取込→変換→集計→出力」のようにジョブ同士に順序依存があり、失敗時は途中から再開したい・大量ジョブを並列にさばきたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 1], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [3, 0], depth: 2 }
        ],
        nodes: [
          { id: "scheduler", icon: "services/eventbridge", label: "EventBridge\nScheduler", col: 0, row: 0 },
          { id: "batch", icon: "services/batch", label: "AWS Batch\nジョブキュー", col: 1, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
          { id: "task", icon: "services/fargate", label: "Fargate\nジョブ実行", col: 3, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n結果保存", col: 4, row: 0 }
        ],
        edges: [
          { from: "scheduler", to: "batch", label: "定時にジョブ群を投入" },
          { from: "batch", to: "task", label: "依存順に実行" },
          { from: "task", to: "s3", label: "結果保存" },
          { from: "task", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "EventBridge Schedulerが定時にAWS Batchへジョブ群（取込→変換→集計）を依存関係付きで投入する",
        "Batchは依存関係（dependsOn指定）を解決し、前段ジョブの成功を待って次のジョブを起動する",
        "各ジョブはVPCのプライベートサブネットでFargateコンテナとして実行され、結果をS3へ保存する",
        "外向き通信はNATゲートウェイ→インターネットゲートウェイ経由。ジョブ失敗時は指定回数まで自動リトライされる"
      ],
      services: [
        { icon: "services/batch", name: "AWS Batch", role: "ジョブの依存関係・並列度・リトライを管理するバッチ専用のキューとスケジューラ。本体は無料" },
        { icon: "services/eventbridge", name: "Amazon EventBridge Scheduler", role: "ジョブ群を定時投入する起点。ここも推奨構成と共通" },
        { icon: "services/fargate", name: "AWS Fargate", role: "各ジョブの実行環境。ジョブ数に応じて自動で並列起動する" },
        { icon: "services/s3", name: "Amazon S3", role: "ジョブ間のデータ受け渡しと最終結果の保存" }
      ],
      points: [
        "ジョブの依存関係はBatchのdependsOn指定で宣言でき、「前段が失敗したら後段は動かさない」を自前実装せずに済む",
        "配列ジョブ（同じ処理を1,000ファイルに並列適用する等）が1つの定義で書け、大量データの夜間処理に強い",
        "分岐・待ち合わせ・人の承認を挟むような複雑なフローになったら、Step FunctionsでBatchジョブをつなぐ構成に発展させるのが定石",
        "計算リソースはスポットインスタンス優先の設定にでき、夜間バッチのように時間に融通が利く処理ならコストを大幅に削れる"
      ],
      pros: [
        "依存関係・並列実行・リトライというバッチ運用の難所をマネージドに任せられる",
        "ジョブがない時間はリソースゼロ、Batch自体も無料",
        "スポット活用で重い処理ほどコスト削減効果が大きい"
      ],
      cons: [
        "毎日1本の単純バッチにはオーバースペックで、推奨構成より構築が重い",
        "コンテナ化・ジョブ定義・VPC設計が前提になる",
        "起動オーバーヘッドがあるため、数秒で終わる軽い処理の定期実行には不向き"
      ],
      cost: "<strong>実行時間分のみで月数百円〜数千円</strong>（例：4vCPU/8GBで毎晩30分のジョブ群なら約450円/月、スポットなら更に安い。NATゲートウェイ利用時は月約45USD（約6,800円）が加算）。",
      references: [
        { title: "AWS Batchとは", url: "https://docs.aws.amazon.com/ja_jp/batch/latest/userguide/what-is-batch.html", note: "Batch公式ユーザーガイド" },
        { title: "Batchのジョブの依存関係", url: "https://docs.aws.amazon.com/ja_jp/batch/latest/userguide/job_dependencies.html", note: "dependsOnによる順序制御の公式解説" },
        { title: "Amazon EventBridge Schedulerとは", url: "https://docs.aws.amazon.com/ja_jp/scheduler/latest/UserGuide/what-is-scheduler.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Scheduler+Lambda）は<strong>月0円〜数百円</strong>でほぼ無料。Fargateスケジュールタスク案は実行時間分のみで<strong>月数十円〜数百円</strong>、Batch案も<strong>月数百円〜数千円</strong>と安いが、どちらもNATゲートウェイを置くと<strong>月約45USD（約6,800円）</strong>の固定費が乗る点に注意（VPCエンドポイントで回避可能）。</p>",
  summary: "<p>定期バッチは「EC2にcron」から卒業する題材として最適です。核になる考え方は2つ。1つ目は<strong>スケジューラと実行環境の分離</strong>。起点は常にEventBridge Schedulerに置き、実行側だけを処理の重さで選ぶ（15分以内ならLambda、超えるならFargateタスク、依存ジョブ群ならBatch）。2つ目は<strong>失敗検知を処理の外側に置く</strong>こと。バッチ自身に通知させるのではなく、CloudWatchアラーム+SNSで監視する構図は、どの実行環境でも変わらない共通パターンです。この2つを押さえると、バッチ基盤の構成は要件から機械的に導けるようになります。</p>"
});
