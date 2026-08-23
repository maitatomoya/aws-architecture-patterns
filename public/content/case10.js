// ケース10：モバイルアプリのバックエンド
registerCase({
  id: 10,
  category: "Webアプリ・EC",
  title: "モバイルアプリのバックエンド",
  scenario: "<p>toC向けのモバイルアプリ（iOS/Android）を新規開発する。会員登録・データの保存/取得・プッシュ通知が主な機能で、利用者数は数千人から始まり、ヒットすれば数十万人まで伸びる可能性がある。アプリ側のエンジニアは充実しているが、サーバーサイド専任は1名だけ。利用は朝晩に集中し、深夜はほぼゼロという波の大きいトラフィックが予想される。</p>",
  requirements: [
    "会員登録・ログイン（ソーシャルログイン含む）を安全に実装したい",
    "利用者数が数千人から数十万人までスケールしても構成を変えたくない",
    "プッシュ通知（お知らせ・リマインド）を送りたい",
    "深夜など利用がない時間帯のコストを最小にしたい",
    "サーバー専任1名でも運用できる構成にしたい"
  ],
  main: {
    name: "Cognito + API Gateway + Lambda + DynamoDB + SNS（フルサーバーレス）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "mobile", icon: "resources/mobile-client", label: "モバイル\nアプリ", col: 0, row: 0 },
        { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 1 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 2, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\nAPI処理", col: 3, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nユーザーデータ", col: 4, row: 0 },
        { id: "sns", icon: "services/sns", label: "SNS\nプッシュ通知", col: 3, row: 1 }
      ],
      edges: [
        { from: "mobile", to: "apigw", label: "API+JWT" },
        { from: "mobile", to: "cognito", label: "サインイン" },
        { from: "apigw", to: "lambda" },
        { from: "lambda", to: "ddb", label: "読み書き" },
        { from: "lambda", to: "sns", label: "通知指示" },
        { from: "sns", to: "mobile", label: "プッシュ通知" }
      ]
    },
    flow: [
      "アプリはまずCognitoでサインインし、トークン（JWT：署名付きの本人証明データ）を受け取る",
      "以降のAPI呼び出しはトークンを添えてAPI Gatewayへ送る。API Gatewayはトークンを検証し、不正なリクエストをLambdaに届く前に弾く",
      "検証を通ったリクエストはLambda関数が処理し、ユーザーデータをDynamoDBに読み書きする",
      "お知らせ等の通知は、LambdaがSNSに配信を指示し、SNSがAPNs/FCM（AppleとGoogleの通知配信網）経由で各端末へプッシュ通知を届ける",
      "この構成にVPCやゲートウェイ類が無いのは省略ではない。すべてVPC外のマネージドサービスで完結しており、守るべき自前ネットワークが存在しないため"
    ],
    services: [
      { icon: "services/cognito", name: "Amazon Cognito", role: "会員登録・ログイン・ソーシャルログインとトークン発行を担う認証基盤。パスワードを自前DBで持たずに済む" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "APIの受付窓口。Cognitoトークンの検証・流量制限を入口で行う" },
      { icon: "services/lambda", name: "AWS Lambda", role: "リクエストが来たときだけ動く関数実行環境。同時アクセスに応じて自動で並列化される" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "ユーザーデータの保存先。数千人でも数十万人でも同じ構成のまま使えるNoSQL DB" },
      { icon: "services/sns", name: "Amazon SNS", role: "プッシュ通知の配信サービス。APNs/FCMへの接続と端末トークン管理を肩代わりする" }
    ],
    points: [
      "認証を自作しないことが最大の工夫。パスワード保存・多要素認証・ソーシャルログインはセキュリティ事故の頻発地帯で、Cognitoに任せれば責任範囲を大きく減らせる",
      "トークン検証をAPI Gatewayのオーソライザー（入口での認可チェック機能）に置くことで、各Lambda関数から認証コードを排除でき、実装漏れも防げる",
      "全コンポーネントが従量課金なので、深夜ほぼゼロ・朝晩ピークという波の激しいモバイル特有のトラフィックと相性が良い。使われない時間帯の費用がほぼ発生しない",
      "DynamoDBは「画面ごとにどう読むか」を先に決めるアクセスパターン駆動で設計する。モバイルの画面単位のデータ取得とは相性が良いが、管理画面の複雑な検索は苦手なので、必要なら検索専用の仕組みを後付けする"
    ],
    pros: [
      "利用者が数千人でも数十万人でも、構成変更なしでスケールする",
      "アイドル時のコストがほぼゼロで、トラフィックの波と課金が一致する",
      "サーバー・OSの管理が一切なく、専任1名でも運用が回る",
      "認証・通知というモバイルの定番機能をマネージドサービスに任せられる"
    ],
    cons: [
      "Lambdaのコールドスタート（しばらく使われない関数の初回応答が遅れる現象）が体感に影響することがある",
      "DynamoDBのデータ設計はRDBと発想が異なり、慣れるまで設計ミスをしやすい",
      "多数のLambda関数に処理が分散するため、ログやエラーの追跡に分散トレーシングの仕組みが必要になる"
    ],
    cost: "<strong>月1,000円〜1万円程度</strong>（月間数百万リクエスト・ユーザー数千〜数万人規模の従量課金。Cognitoは月間アクティブユーザー数万人までの無料枠が大きい）。利用者が10倍になっても課金はリクエスト数に比例するだけで、構成変更の費用はかからない。",
    references: [
      { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html", note: "Cognito公式デベロッパーガイド" },
      { title: "API GatewayとCognitoユーザープールの統合", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html", note: "入口でのトークン検証の公式手順" },
      { title: "Lambda + API GatewayでのAPI構築", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/services-apigateway.html" },
      { title: "SNSによるモバイルプッシュ通知", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/sns-mobile-application-as-subscriber.html", note: "APNs/FCM連携の公式解説" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "AppSync（GraphQLでAPIをまとめる）",
      when: "画面ごとに必要なデータの形が多様・リアルタイム同期（チャット等）が必要・API本数の増加を抑えたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "mobile", icon: "resources/mobile-client", label: "モバイル\nアプリ", col: 0, row: 1 },
          { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 0 },
          { id: "appsync", icon: "services/appsync", label: "AppSync\nGraphQL API", col: 2, row: 1 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n複雑な処理", col: 3, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB", col: 3, row: 1 }
        ],
        edges: [
          { from: "mobile", to: "cognito", label: "サインイン" },
          { from: "mobile", to: "appsync", label: "GraphQL" },
          { from: "cognito", to: "appsync", dashed: true, noArrow: true },
          { from: "appsync", to: "ddb", label: "リゾルバー" },
          { from: "appsync", to: "lambda", label: "複雑な処理", dashed: true }
        ]
      },
      flow: [
        "アプリはGraphQL（必要なデータの形をクライアントが指定できるAPI規格）でAppSyncに問い合わせる。画面に必要なデータを1リクエストでまとめて取得できる",
        "認証はCognitoと連携し、AppSyncがトークンを検証する",
        "単純な読み書きはリゾルバー（GraphQLとデータソースを対応付ける変換層）がDynamoDBへ直結し、Lambdaを書かずに済む。複雑なロジックだけLambdaに委ねる",
        "サブスクリプション機能を使うと、データ更新をサーバー側から端末へリアルタイムに配信できる（チャットや共同編集向け）"
      ],
      services: [
        { icon: "services/appsync", name: "AWS AppSync", role: "マネージドGraphQL API。リゾルバーによるデータソース直結とリアルタイム配信（サブスクリプション）を提供" },
        { icon: "services/cognito", name: "Amazon Cognito", role: "サインインとトークン発行。AppSyncの認証方式として組み込める" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "データの保存先。リゾルバーから直接読み書きされる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "リゾルバー直結では書けない複雑なビジネスロジックの受け皿" }
      ],
      points: [
        "RESTでは画面ごとに「一覧用API」「詳細用API」と本数が増えがちだが、GraphQLはクエリで形を指定できるため、アプリの画面変更のたびにAPIを作り直す往復が減る。モバイルチームが主導権を持てるのが実務上の利点",
        "モバイル回線では通信回数と転送量が体感速度に直結する。必要なフィールドだけ1回で取れるGraphQLは、REST比で過剰取得（オーバーフェッチ）を減らせる",
        "リアルタイム同期を自前のWebSocketサーバーなしで実現できるのはAppSync固有の強み。逆にリアルタイム要件がないなら、REST（API Gateway）の方が学習コストは低い",
        "GraphQLスキーマがアプリとサーバーの契約書になるため、スキーマ設計とバージョン管理の規律がREST以上に重要になる"
      ],
      pros: [
        "1リクエストで必要なデータをまとめて取得でき、モバイルの通信効率が良い",
        "サブスクリプションでリアルタイム同期を追加実装なしで実現できる",
        "単純なCRUDはリゾルバー直結で済み、Lambda関数の本数を減らせる"
      ],
      cons: [
        "GraphQLとリゾルバーの学習コストがRESTより高い",
        "キャッシュ戦略やエラー処理などRESTの定石がそのまま使えない場面がある",
        "細かい流量制限やAPIキー管理はAPI Gatewayの方が細かく制御できる"
      ],
      cost: "<strong>月1,000円〜1万円程度</strong>（クエリ数百万件/月の従量課金。リアルタイム配信は接続時間＋メッセージ数で加算）。REST構成とほぼ同水準で、こちらもアイドル時はほぼゼロ。",
      references: [
        { title: "AWS AppSyncとは", url: "https://docs.aws.amazon.com/ja_jp/appsync/latest/devguide/what-is-appsync.html", note: "AppSync公式デベロッパーガイド" },
        { title: "AppSyncのリアルタイムデータ", url: "https://docs.aws.amazon.com/ja_jp/appsync/latest/devguide/aws-appsync-real-time-data.html", note: "サブスクリプションの公式解説" },
        { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html" }
      ]
    },
    {
      name: "App Runner + RDS（既存REST資産の載せ替え）",
      when: "既存のRESTサーバー（Rails/Laravel/Spring等）とRDBのコード資産があり、書き換えずにモバイル向けに公開したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [4, 0], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "dev", icon: "resources/client", label: "開発者\n既存アプリ", col: 0, row: 0 },
          { id: "mobile", icon: "resources/mobile-client", label: "モバイル\nアプリ", col: 0, row: 1 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 2, row: 0 },
          { id: "apprunner", icon: "services/app-runner", label: "App Runner\nRESTサーバー", col: 2, row: 1 },
          { id: "rds", icon: "services/rds", label: "RDS\n既存スキーマ", col: 4, row: 1 }
        ],
        edges: [
          { from: "dev", to: "ecr", label: "イメージpush" },
          { from: "ecr", to: "apprunner", label: "自動デプロイ" },
          { from: "mobile", to: "apprunner", label: "REST API" },
          { from: "apprunner", to: "rds", label: "VPCコネクタ" }
        ]
      },
      flow: [
        "既存のRESTサーバーをコンテナイメージ化してECRにpushする。フレームワークのコードはほぼそのまま使える",
        "App Runnerがイメージを自動デプロイし、HTTPSの公開URLを提供する。モバイルアプリはそのURLを呼ぶだけ",
        "DBは使い慣れたRDS（MySQL/PostgreSQL）で、既存のテーブル設計・SQL資産をそのまま移行できる",
        "RDSはVPCのプライベートサブネットに置き、App RunnerからVPCコネクタ経由でのみ接続する。入口はApp Runnerの公開エンドポイントなので、この図にIGWは登場しない"
      ],
      services: [
        { icon: "services/app-runner", name: "AWS App Runner", role: "既存RESTサーバーのコンテナをそのまま公開できる実行基盤。HTTPS・スケーリング内蔵" },
        { icon: "services/ecr", name: "Amazon ECR", role: "コンテナイメージ置き場。pushで自動デプロイが走る" },
        { icon: "services/rds", name: "Amazon RDS", role: "既存のスキーマ・SQL資産をそのまま活かせるマネージドRDB" }
      ],
      points: [
        "「サーバーレスに書き換える」のではなく「動いているものを載せ替える」戦略。移行リスクと工数が最小で、チームの既存スキル（RailsやSpring等）を全部活かせる",
        "認証も既存実装をそのまま使えるが、新規部分から徐々にCognitoへ寄せると、パスワード管理の責任を段階的に手放せる",
        "サーバーレス構成と違い、App RunnerとRDSは稼働時間ベースの課金。深夜もアクセスがあるアプリや、常時一定の負荷があるアプリならむしろ読みやすい料金になる",
        "将来リクエストが桁で増えたら、同じコンテナイメージのままECSへ移行できる。App Runnerは「入口としてのコンテナ基盤」と割り切る"
      ],
      pros: [
        "既存のコード・スキーマ・運用ノウハウをほぼ無修正で活かせる",
        "RDBなので複雑な検索・集計・トランザクションが素直に書ける",
        "コールドスタートがなく、応答時間が安定している"
      ],
      cons: [
        "アイドル時もApp RunnerとRDSの稼働費がかかり、深夜ゼロでも課金が続く",
        "スケールの上限や細かい制御はLambda構成やECSに劣る",
        "プッシュ通知や認証を強化する際は、結局SNSやCognitoを追加していくことになる"
      ],
      cost: "<strong>月8,000円〜2万円程度</strong>（App Runner 1vCPU/2GB×1〜2インスタンス＋RDS最小構成、東京リージョン）。従量課金のサーバーレス構成より高いが、金額が安定していて予算化しやすい。",
      references: [
        { title: "AWS App Runnerとは", url: "https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/what-is-apprunner.html", note: "App Runner公式デベロッパーガイド" },
        { title: "App RunnerからVPC内リソースへ接続する（VPCコネクタ）", url: "https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/network-vpc.html" },
        { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html" }
      ]
    }
  ],
  cost: "<p>推奨のサーバーレス構成は<strong>月1,000円〜1万円程度</strong>で、利用の波にそのまま比例する従量課金。AppSync案もほぼ同水準。App Runner+RDS案は<strong>月8,000円〜2万円程度</strong>の稼働時間ベースで、アイドル時も課金される代わりに金額が安定する。「深夜ほぼゼロ」というモバイルの利用パターンでは従量課金の優位が大きいが、既存資産の書き換え工数（人件費）まで含めると載せ替え案が最安になることも多い。</p>",
  summary: "<p>モバイルバックエンドの定石は<strong>「認証はCognito、入口はAPI GatewayかAppSync、処理はLambda」</strong>というサーバーレスの組み合わせです。トラフィックの波が激しく、サーバー専任が少ないというモバイル特有の事情に、従量課金・運用レスという特性がぴったり噛み合います。一方で、REST資産を持つチームの正解は書き換えではなく載せ替え（App Runner+RDS）であることも多く、GraphQL（AppSync）はリアルタイム同期や画面主導のデータ取得という明確な動機があるときに選ぶ、と整理して覚えておきましょう。</p>"
});
