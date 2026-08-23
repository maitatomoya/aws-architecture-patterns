// ケース24：ETLデータパイプライン
registerCase({
  id: 24,
  category: "データ・分析",
  title: "ETLデータパイプライン",
  scenario: "<p>小売企業のデータ部門。毎晩、基幹システムから出力される売上・在庫データを取り込み、クレンジング・集計してデータレイクの加工済み層に反映する夜間バッチを作りたい。処理は「取り込み→変換→集計→出力」の複数ステップから成り、途中で失敗したら翌朝のレポートに間に合わないため、失敗に即気づいて途中から再実行できる仕組みが必須。現在のデータ量は1晩数GBだが、対象店舗の拡大で数百GBまで増える見込み。</p>",
  requirements: [
    "複数ステップの処理を決まった順序で毎晩自動実行したい",
    "どのステップで失敗したか一目で分かり、通知を受け取りたい",
    "失敗時は最初からやり直さず、安全に再実行したい",
    "データ量の増加（数GB→数百GB）に耐えられること",
    "夜間しか動かないのでサーバーの常時稼働はしたくない"
  ],
  main: {
    name: "Step Functions+Glueのジョブオーケストレーション",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "ops", icon: "resources/email", label: "運用者へ\nメール", col: 0, row: 1 },
        { id: "eb", icon: "services/eventbridge", label: "EventBridge\nスケジュール", col: 1, row: 0 },
        { id: "sfn", icon: "services/step-functions", label: "Step Functions\nワークフロー", col: 2, row: 0 },
        { id: "glue", icon: "services/glue", label: "Glue\nETLジョブ", col: 3, row: 0 },
        { id: "s3raw", icon: "services/s3", label: "S3\n取り込み層", col: 4, row: 0 },
        { id: "s3out", icon: "services/s3", label: "S3\n加工済み層", col: 4, row: 1 },
        { id: "sns", icon: "services/sns", label: "SNS\n失敗通知", col: 2, row: 1 }
      ],
      edges: [
        { from: "eb", to: "sfn", label: "定時起動" },
        { from: "sfn", to: "glue", label: "ジョブ実行" },
        { from: "s3raw", to: "glue", label: "読み込み" },
        { from: "glue", to: "s3out", label: "変換して保存" },
        { from: "sfn", to: "sns", label: "失敗時に通知" },
        { from: "sns", to: "ops", label: "メール送信" }
      ]
    },
    flow: [
      "EventBridgeのスケジュール機能が毎晩決まった時刻にStep Functionsのワークフローを起動する",
      "Step Functions（複数の処理の順序・分岐・リトライを管理するサービス）がGlueジョブを順番に呼び出し、成否を監視する",
      "GlueジョブがS3の取り込み層（raw）から元データを読み、変換・集計して加工済み層（processed）へ書き込む",
      "どこかのステップが失敗するとStep FunctionsがSNSへ通知を発行し、運用者にメールが届く",
      "実行履歴は視覚的なフロー図として残るため、どのステップで止まったか一目で分かる"
    ],
    services: [
      { icon: "services/step-functions", name: "AWS Step Functions", role: "パイプラインの指揮者。実行順序・分岐・リトライ・失敗検知を定義（コードでなく設定）で管理する" },
      { icon: "services/glue", name: "AWS Glue", role: "変換処理の実行役。Sparkベースの分散処理で、数百GBに増えてもスケールする" },
      { icon: "services/s3", name: "Amazon S3", role: "取り込み層と加工済み層の2層に分けたデータ置き場。再実行の安全性の土台" },
      { icon: "services/sns", name: "Amazon SNS", role: "失敗通知の配送役。メールやチャットツールへ横展開できる" },
      { icon: "services/eventbridge", name: "Amazon EventBridge", role: "毎晩の定時起動を担うスケジューラ" }
    ],
    points: [
      "「処理そのもの（Glue）」と「順序・失敗の管理（Step Functions）」を分離するのがこの構成の核。リトライや分岐をアプリコードに埋め込まず、宣言的に定義できる",
      "Step FunctionsのRetry/Catch機能で「一時エラーは3回まで自動再試行、それでもだめなら通知して停止」といった制御を定義だけで実現できる",
      "S3を取り込み層と加工済み層に分けておくと、失敗しても元データが無傷なので何度でも再実行できる。同じ入力なら同じ結果になる（冪等性）ようにジョブを書くのが鉄則",
      "通知は「失敗したときだけ」に絞る。毎日の成功通知は数日で誰も読まなくなり、本当の障害を見逃す原因になる"
    ],
    pros: [
      "失敗箇所の特定と途中からの再実行が容易",
      "サーバーレスで夜間の実行時間だけ課金される",
      "ステップの追加・並列化がワークフロー定義の変更だけでできる",
      "Glueの分散処理により数百GBへの成長にそのまま耐える"
    ],
    cons: [
      "Step FunctionsとGlueの2つ分の学習コストがかかる",
      "Glueはジョブ起動に数十秒〜数分のオーバーヘッドがあり、数MB程度の軽い処理には割高",
      "ワークフロー定義（ASL）の独自記法に慣れが必要"
    ],
    cost: "<strong>月数千円〜2万円程度</strong>（毎晩1時間・10DPU規模のGlueジョブの前提。Glueは1DPU時あたり約0.44USDの実行時間課金で、Step Functions・SNS・EventBridgeはほぼ誤差）。夜間しか動かないため、常時起動のバッチサーバーを持つより大幅に安い。",
    references: [
      { title: "AWS Step Functionsとは", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/welcome.html" },
      { title: "Step FunctionsからGlueジョブを実行する", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/connect-glue.html", note: "この構成の中心となる連携" },
      { title: "AWS Glueとは", url: "https://docs.aws.amazon.com/ja_jp/glue/latest/dg/what-is-glue.html" },
      { title: "Amazon SNSとは", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/welcome.html" },
      { title: "Amazon EventBridge Schedulerとは", url: "https://docs.aws.amazon.com/ja_jp/scheduler/latest/UserGuide/what-is-scheduler.html" }
    ]
  },
  alternatives: [
    {
      name: "Lambdaベースの軽量パイプライン",
      when: "データが数百MB以内で変換も軽く、処理が15分以内に確実に終わる場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "eb", icon: "services/eventbridge", label: "EventBridge\nスケジュール", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n変換処理", col: 2, row: 0 },
          { id: "s3in", icon: "services/s3", label: "S3\n元データ", col: 3, row: 0 },
          { id: "s3out", icon: "services/s3", label: "S3\n変換結果", col: 3, row: 1 },
          { id: "sns", icon: "services/sns", label: "SNS\n失敗通知", col: 1, row: 1 }
        ],
        edges: [
          { from: "eb", to: "fn", label: "定時起動" },
          { from: "s3in", to: "fn", label: "読み込み" },
          { from: "fn", to: "s3out", label: "保存" },
          { from: "fn", to: "sns", label: "失敗時に通知", dashed: true }
        ]
      },
      flow: [
        "EventBridgeが定時にLambda関数を起動する",
        "LambdaがS3から元データを読み込み、変換して結果をS3へ書き戻す",
        "失敗時はLambdaの非同期呼び出しの失敗送信先からSNSへ流し、運用者へ通知する"
      ],
      services: [
        { icon: "services/lambda", name: "AWS Lambda", role: "変換処理の実行役。起動が速く、小さなデータの加工に最適" },
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "定時起動のスケジューラ" },
        { icon: "services/s3", name: "Amazon S3", role: "元データと変換結果の置き場" },
        { icon: "services/sns", name: "Amazon SNS", role: "失敗時の通知先" }
      ],
      points: [
        "Lambdaの実行時間上限は15分。データ成長で超える見込みが少しでもあるなら、最初からGlueやBatchを選ぶほうが作り直しを防げる",
        "失敗通知はLambdaの非同期呼び出しに備わる「失敗時の送信先」設定を使うと、通知コードの自前実装が不要になる",
        "ステップが3つ以上に増えたり依存関係が複雑になってきたら、このLambda群の上にStep Functionsを被せる形でそのまま成長させられる"
      ],
      pros: [
        "最安・最速で構築でき、起動オーバーヘッドもほぼない",
        "コードだけで完結し、学習コストが小さい"
      ],
      cons: [
        "実行15分・メモリ10GBの上限があり、大きなデータの結合・集計には不向き",
        "処理の順序管理やリトライを自前で書き始めると急に複雑化する"
      ],
      cost: "<strong>月数十円〜数百円</strong>（毎晩数分の実行なら無料枠内に収まることも多い）。3案の中で圧倒的に安いが、上限に達したときの作り直しコストまで含めて判断する。",
      references: [
        { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
        { title: "Lambdaのクォータ（15分制限など）", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/gettingstarted-limits.html", note: "この案を選べるかの判断基準" },
        { title: "Lambdaの非同期呼び出しと失敗時送信先", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/invocation-async.html" }
      ]
    },
    {
      name: "AWS Batch（独自コード・大規模計算）",
      when: "既存のPython等のプログラムをそのまま動かしたい・1回数時間かかる重い計算がある場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "eb", icon: "services/eventbridge", label: "EventBridge\nスケジュール", col: 1, row: 0 },
          { id: "batch", icon: "services/batch", label: "AWS Batch\nジョブ実行", col: 2, row: 0 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nコンテナ登録", col: 1, row: 1 },
          { id: "s3in", icon: "services/s3", label: "S3\n元データ", col: 3, row: 0 },
          { id: "s3out", icon: "services/s3", label: "S3\n計算結果", col: 3, row: 1 }
        ],
        edges: [
          { from: "eb", to: "batch", label: "ジョブ投入" },
          { from: "ecr", to: "batch", label: "イメージ取得", dashed: true },
          { from: "s3in", to: "batch", label: "読み込み" },
          { from: "batch", to: "s3out", label: "結果保存" }
        ]
      },
      flow: [
        "変換プログラムをコンテナイメージにしてECR（コンテナ置き場）へ登録しておく",
        "EventBridgeが定時にBatchのジョブキューへジョブを投入する",
        "Batchが必要な計算リソース（EC2やFargate）を自動で起動してコンテナを実行し、終われば自動で停止する",
        "ジョブはS3から元データを読み、計算結果をS3へ書き込む"
      ],
      services: [
        { icon: "services/batch", name: "AWS Batch", role: "ジョブのキュー管理と計算リソースの自動起動・停止。実行時間の制限が実質ない" },
        { icon: "services/ecr", name: "Amazon ECR", role: "実行するコンテナイメージの保管庫" },
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "定時起動のスケジューラ" },
        { icon: "services/s3", name: "Amazon S3", role: "入出力データの置き場" }
      ],
      points: [
        "GlueがSpark前提なのに対し、Batchは任意のコンテナを動かせる。既存のスクリプトや科学計算ライブラリをほぼそのまま持ち込めるのが最大の違い",
        "計算環境にスポットインスタンス（中断され得る代わりに大幅割引のVM）を指定すると、夜間バッチの計算費用を大きく削れる",
        "Batch自体のフロー制御は簡易的。ステップが増えて依存関係が複雑になったら、Step FunctionsからBatchジョブを呼ぶ構成に発展させる"
      ],
      pros: [
        "実行時間の制限が実質なく、数時間級の計算もそのまま動く",
        "既存コード資産を書き換えずに活かせる",
        "スポット活用で計算費用を大幅に下げられる"
      ],
      cons: [
        "コンテナ化とイメージ管理（ビルド・更新）の手間が増える",
        "Glueのようなデータ変換の便利機能はなく、すべて自分のコードで書く"
      ],
      cost: "<strong>月数百円〜数万円</strong>（Batch自体は無料で、起動した計算リソースの時間分のみ課金。毎晩1時間のスポット利用なら月千円台も可能）。計算が重いほどGlueより単価を抑えやすい。",
      references: [
        { title: "AWS Batchとは", url: "https://docs.aws.amazon.com/ja_jp/batch/latest/userguide/what-is-batch.html" },
        { title: "Amazon EventBridgeとは", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-what-is.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Step Functions+Glue）は<strong>月数千円〜2万円程度</strong>。Lambda案は<strong>月数百円以下</strong>で最安だが15分の壁がある。Batch案は<strong>月数百円〜数万円</strong>で、実行した計算時間にのみ課金される。3案とも夜間だけの従量課金であり、常時起動のバッチサーバー（月数千円〜の固定費＋運用）と比べるとどれを選んでも有利。分かれ目は「データ量・処理時間・既存コードの有無」。</p>",
  summary: "<p>ETLパイプラインの設計は「実行エンジン」と「オーケストレーション（順序・失敗管理）」を分けて考えるのが基本です。<strong>小さく速い処理はLambda、大量データの変換はGlue、既存の重いプログラムはBatch</strong>という実行エンジンの使い分けを覚えると、他のバッチ設計にも応用が利きます。そしてどのエンジンを選んでも、失敗検知と再実行の仕組み（Step Functions＋SNS通知、S3の層分け）が本番運用の生命線になる、という点がこのケースの核心です。</p>"
});
