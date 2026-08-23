// ケース12：予約システム（美容室・クリニック）
registerCase({
  id: 12,
  category: "Webアプリ・EC",
  title: "予約システム（美容室・クリニック）",
  scenario: "<p>美容室やクリニック向けの予約システムを作りたい。お客さんはスマホから空き枠を探して予約し、前日にはリマインドメールが自動で届く。予約が入るのは営業時間帯に偏り、深夜はほぼアクセスゼロ。店舗スタッフは数名で、システム専任のエンジニアはいない（開発は外部の小さなチーム）。無断キャンセル対策として、将来的には事前決済も入れたい。</p>",
  requirements: [
    "空き枠の検索と予約登録（ダブルブッキング禁止）",
    "予約前日に自動でリマインドメールを送りたい",
    "アクセスが少ない時間帯のコストを限りなくゼロに近づけたい",
    "サーバーの保守運用はやりたくない（少人数運営）",
    "将来は事前決済（仮予約→決済→確定）を追加したい"
  ],
  main: {
    name: "API Gateway + Lambda + DynamoDB + EventBridge Scheduler（フルサーバーレス）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "予約者\n(スマホ)", col: 0, row: 0 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway\n予約API", col: 1, row: 0 },
        { id: "fn", icon: "services/lambda", label: "Lambda\n予約処理", col: 2, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n予約データ", col: 3, row: 0 },
        { id: "scheduler", icon: "services/eventbridge", label: "EventBridge\nScheduler", col: 2, row: 1 },
        { id: "fn2", icon: "services/lambda", label: "Lambda\nリマインド送信", col: 3, row: 1 },
        { id: "ses", icon: "services/ses", label: "SES\nメール送信", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "apigw", label: "予約リクエスト" },
        { from: "apigw", to: "fn" },
        { from: "fn", to: "ddb", label: "予約を保存" },
        { from: "fn", to: "scheduler", label: "リマインドを登録" },
        { from: "scheduler", to: "fn2", label: "前日に起動" },
        { from: "fn2", to: "ddb", label: "予約情報参照", dashed: true },
        { from: "fn2", to: "ses", label: "送信依頼" }
      ]
    },
    flow: [
      "予約者がスマホからAPI Gateway（APIの受付窓口）にアクセスし、空き枠の検索や予約登録を行う",
      "API GatewayがLambda（サーバー不要でコードを動かす実行環境）を起動し、DynamoDBに予約を条件付き書き込みで保存する（同じ枠に2件入らないようにする）",
      "予約が確定したタイミングで、LambdaがEventBridge Schedulerに「予約前日の18時にリマインドを実行」という1回きりのスケジュールを登録する",
      "前日になるとSchedulerがリマインド用Lambdaを起動し、DynamoDBから予約内容を読み出す",
      "リマインド用LambdaがSES（メール送信サービス）に依頼し、予約者へリマインドメールが届く"
    ],
    services: [
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "予約APIの入口。認証・スロットリング（過剰リクエストの制限）も担当する" },
      { icon: "services/lambda", name: "AWS Lambda", role: "予約登録・リマインド送信のロジックを実行。リクエストがある時だけ動き、待機コストがない" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "予約データの保存先。条件付き書き込みでダブルブッキングを防げるNoSQLデータベース" },
      { icon: "services/eventbridge", name: "Amazon EventBridge Scheduler", role: "「この日時に1回だけ実行」を予約ごとに登録できるスケジューラ。リマインドの心臓部" },
      { icon: "services/ses", name: "Amazon SES", role: "リマインドメールの送信。1通あたり約0.01円と安価" }
    ],
    points: [
      "ダブルブッキング対策はDynamoDBの条件付き書き込み（ConditionExpression）で実現する。「その枠がまだ空いている場合のみ書き込む」をDB側が保証するため、同時アクセスでも二重予約が起きない",
      "リマインドはEventBridge Schedulerの「ワンタイムスケジュール」を予約1件ごとに作る。cronで毎分ポーリングする方式より無駄がなく、実行後の自動削除設定もできる",
      "深夜のアクセスゼロ時間帯は課金もほぼゼロ。全サービスが従量課金なので、営業時間に偏るトラフィックと相性が良い",
      "この図にVPCやインターネットゲートウェイが無いのは省略ではない。API Gateway・Lambda・DynamoDBはすべてVPCの外で動くマネージドサービスで、ネットワーク設計そのものが不要になっている"
    ],
    pros: [
      "アイドル時のコストがほぼゼロ（従量課金のみ）",
      "サーバーのOS管理・パッチ当てが一切不要で、少人数でも運用できる",
      "予約集中（キャンペーン告知直後など）にも自動でスケールする",
      "リマインドの仕組みをポーリングなしでシンプルに実現できる"
    ],
    cons: [
      "「月曜のカット担当者の空き枠を横断検索」のような複雑な検索はDynamoDBだと設計の工夫が必要（キー設計のスキルが要る）",
      "SESは最初サンドボックス状態で、本番送信には解除申請が必要",
      "ローカル開発・デバッグの体験はサーバーありの構成に比べてひと手間かかる"
    ],
    cost: "<strong>月数十円〜数百円程度</strong>（月数千件の予約規模。API Gateway・Lambda・DynamoDBはほぼ無料枠内、SESは1,000通あたり約15円、EventBridge Schedulerは月1,400万回まで無料枠あり）。",
    references: [
      { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html", note: "API Gateway公式開発者ガイド" },
      { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
      { title: "Amazon EventBridge Schedulerとは", url: "https://docs.aws.amazon.com/ja_jp/scheduler/latest/UserGuide/what-is-scheduler.html", note: "ワンタイムスケジュールの公式ガイド" },
      { title: "Amazon SESとは", url: "https://docs.aws.amazon.com/ja_jp/ses/latest/dg/Welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "RDS（リレーショナルDB）で空き枠を管理",
      when: "スタッフ・メニュー・複数店舗をまたぐ複雑な空き枠検索や、SQLでの集計・レポートを重視する場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "予約者", col: 0, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n(VPC接続)", col: 2, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nPostgreSQL", col: 4, row: 0 },
          { id: "secrets", icon: "services/secrets-manager", label: "Secrets Manager\nDB認証情報", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "予約リクエスト" },
          { from: "apigw", to: "fn" },
          { from: "fn", to: "rds", label: "SQLで空き枠検索" },
          { from: "fn", to: "secrets", label: "認証情報取得", dashed: true }
        ]
      },
      flow: [
        "API Gateway・Lambdaまでは推奨構成と同じ。違いはデータの持ち方にある",
        "LambdaをVPCに接続し、プライベートサブネット内のRDS（PostgreSQL）へSQLで空き枠を検索・予約登録する",
        "DBのパスワードはコードに書かず、Secrets Managerから実行時に取得する",
        "「スタッフ×メニュー×店舗」のような条件の組み合わせ検索は、JOINが使えるSQLの得意分野として処理する"
      ],
      services: [
        { icon: "services/rds", name: "Amazon RDS（PostgreSQL）", role: "予約・スタッフ・メニューをテーブルで管理。JOINやトランザクションで複雑な検索・整合性を実現" },
        { icon: "services/lambda", name: "AWS Lambda（VPC接続）", role: "VPC内のRDSに届くようENI（仮想ネットワークカード）経由で接続するAPI処理" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "推奨構成と同じくAPIの入口" },
        { icon: "services/secrets-manager", name: "AWS Secrets Manager", role: "DBパスワードの保管と自動ローテーション。コードへの直書きを防ぐ" }
      ],
      points: [
        "空き枠のような「条件の組み合わせで絞り込む」データはリレーショナルDBが素直に書ける。DynamoDBで頑張るより開発速度が出る場面は多い",
        "多数のLambdaからの同時接続でDBの接続数が枯渇しやすいため、実運用ではRDS Proxy（接続を束ねる中継役）を挟むのが定石",
        "図にインターネットゲートウェイが無いのは、VPCへの入口がAPI Gateway→Lambda（ENI経由）であり、インターネットからVPCへ直接入る経路が存在しないため。LambdaからSecrets Manager等へのアクセスにはVPCエンドポイントを使う",
        "最小構成のRDSは常時起動の固定費がかかる。夜間アクセスゼロでも課金される点がサーバーレス構成との最大の違い"
      ],
      pros: [
        "複雑な検索・集計をSQLで直感的に書ける（開発メンバーも慣れている）",
        "トランザクションで予約確定処理の整合性を保ちやすい",
        "管理画面やレポート機能の追加が容易"
      ],
      cons: [
        "RDSは常時起動でアイドル時も固定費がかかる",
        "VPC・サブネット・セキュリティグループの設計が必要になり、構成の学習コストが上がる",
        "接続数管理（RDS Proxy）など、サーバーレスとRDBの相性問題への対処が必要"
      ],
      cost: "<strong>月3,000円〜8,000円程度</strong>（db.t4g.micro相当のシングルAZ＋ストレージ20GB＋API Gateway/Lambda少量。マルチAZ化すると約2倍）。",
      references: [
        { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html", note: "RDS公式ユーザーガイド" },
        { title: "VPC内のリソースにLambda関数からアクセスする", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-vpc.html", note: "LambdaのVPC接続の公式解説" },
        { title: "AWS Secrets Managerとは", url: "https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/intro.html" }
      ]
    },
    {
      name: "Step Functionsで決済つき予約確定フロー",
      when: "事前決済を導入し、仮押さえ→決済→確定→通知の多段フローを確実にやり切りたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "予約者", col: 0, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 1, row: 0 },
          { id: "sfn", icon: "services/step-functions", label: "Step Functions\n予約確定フロー", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n予約データ", col: 3, row: 0 },
          { id: "payfn", icon: "services/lambda", label: "Lambda\n決済処理", col: 2, row: 1 },
          { id: "pay", icon: "resources/internet", label: "外部決済\nサービス", col: 0, row: 1 },
          { id: "ses", icon: "services/ses", label: "SES\n確定メール", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "予約確定リクエスト" },
          { from: "apigw", to: "sfn", label: "フロー開始" },
          { from: "sfn", to: "ddb", label: "仮押さえ→確定" },
          { from: "sfn", to: "payfn", label: "決済ステップ" },
          { from: "payfn", to: "pay", label: "決済API呼び出し" },
          { from: "sfn", to: "ses", dashed: true }
        ]
      },
      flow: [
        "予約確定リクエストを受けたAPI Gatewayが、Step Functions（複数の処理を順番に実行する状態管理サービス）のワークフローを開始する",
        "ステップ1：DynamoDBに枠を「仮押さえ」として書き込む（SDK統合でLambdaなしに直接呼べる）",
        "ステップ2：Lambdaが外部決済サービス（Stripe等）のAPIを呼び、決済を実行する",
        "ステップ3：決済成功なら予約を「確定」に更新し、SESで確定メールを送る。決済失敗なら仮押さえを解放する補償処理へ分岐する",
        "各ステップの成功・失敗・リトライはStep Functionsが記録し、実行履歴を画面で追跡できる"
      ],
      services: [
        { icon: "services/step-functions", name: "AWS Step Functions", role: "仮押さえ→決済→確定の順序・分岐・リトライを宣言的に管理するワークフローエンジン" },
        { icon: "services/lambda", name: "AWS Lambda", role: "外部決済APIの呼び出しなど、コードが必要なステップだけを担当" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "予約の状態（仮押さえ・確定・キャンセル）を保存。Step FunctionsからSDK統合で直接更新できる" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "フロー開始の入口。Step Functionsを直接起動できる" },
        { icon: "services/ses", name: "Amazon SES", role: "確定メール・キャンセル通知の送信" }
      ],
      points: [
        "「決済は成功したのに予約確定が失敗した」を防ぐには、失敗時に前のステップを取り消す補償処理（Sagaパターンと呼ばれる設計）が必要。Step Functionsは失敗時の分岐を図として書けるため、この種のフローの実装漏れを防ぎやすい",
        "外部決済APIは一時的なエラーが起きがち。ステップごとのリトライ回数・間隔を宣言的に設定でき、自前のリトライ実装が不要になる",
        "DynamoDBの更新やSES送信はSDK統合でStep Functionsから直接呼び、Lambdaのコード量を最小にする",
        "実行履歴がステップ単位で残るため、「どの予約がどこで失敗したか」の調査が圧倒的に楽になる"
      ],
      pros: [
        "多段フローの順序・リトライ・補償処理を宣言的に書けて、実装漏れが減る",
        "実行履歴の可視化で障害調査・問い合わせ対応が楽",
        "決済以外にも「本人確認」「在庫引き当て」などステップ追加が容易"
      ],
      cons: [
        "状態遷移1回ごとに課金されるため、単純な予約だけなら推奨構成よりやや割高",
        "ワークフロー定義（ASL）の学習コストがある",
        "シンプルな処理まで何でもStep Functions化すると、かえって見通しが悪くなる"
      ],
      cost: "<strong>月数百円程度</strong>（月5,000予約×10状態遷移=5万遷移で約200円＋Lambda・DynamoDB少量。無料枠4,000遷移/月あり）。",
      references: [
        { title: "AWS Step Functionsとは", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/welcome.html", note: "Step Functions公式開発者ガイド" },
        { title: "Step FunctionsのAWS SDK統合", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/supported-services-awssdk.html", note: "LambdaなしでDynamoDB等を直接呼ぶ方法" },
        { title: "Sagaパターン", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/modernization-data-persistence/saga-pattern.html", note: "決済失敗時の補償処理の設計パターン解説" }
      ]
    }
  ],
  cost: "<p>推奨構成（フルサーバーレス）は<strong>月数十円〜数百円</strong>で、アクセスの少ない時間帯はほぼゼロ円。RDS案は最小でも<strong>月3,000円〜8,000円程度</strong>の固定費が乗る代わりに複雑な検索の開発が楽になる。Step Functions案は推奨構成に<strong>月数百円</strong>の上乗せで決済フローの信頼性を買うイメージ。</p>",
  summary: "<p>予約システムは「トラフィックが時間帯に偏る小規模サービス」の典型で、<strong>従量課金のサーバーレス構成が最も相性の良い分野</strong>です。設計の勘所は2つ。1つ目はダブルブッキングをアプリのif文ではなくDynamoDBの条件付き書き込み（またはRDBのトランザクション）というデータベースの仕組みで防ぐこと。2つ目はリマインドをEventBridge Schedulerのワンタイムスケジュールで実現し、ポーリング処理を書かないこと。検索要件が複雑になったらRDS、決済など多段フローが入ったらStep Functionsと、<strong>要件の変化に応じて部品を差し替える判断</strong>を覚えておきましょう。</p>"
});
