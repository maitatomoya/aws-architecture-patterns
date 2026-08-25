// ケース3：大規模ニュース・メディアサイト
registerCase({
  id: 3,
  category: "Webサイト・配信",
  title: "大規模ニュース・メディアサイト",
  scenario: "<p>月間数千万PVのニュースサイトを運営する。記事は編集部が1日数十本入稿し、速報時にはアクセスが平常時の10倍以上に急増する。記事ページのほか、ランキングやパーソナライズ枠など動的な要素もある。広告収益が主のため、表示速度の低下と障害はそのまま売上減につながる。インフラ専任のエンジニアが数名いる。</p>",
  requirements: [
    "月間数千万PV、速報時のスパイク（平常時の10倍以上）に耐えること",
    "記事ページの表示は速く保つこと（表示速度が収益に直結）",
    "DBを読み取り負荷から守ること（記事閲覧はほぼ読み取り）",
    "不正アクセスや大量リクエスト攻撃への防御があること",
    "一部のサーバー障害でもサイト全体は落ちないこと"
  ],
  main: {
    name: "CloudFront + WAF + ALB + EC2 Auto Scaling + Aurora + ElastiCache",
    diagram: {
      cols: 7, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 1] },
        { type: "vpc", label: "VPC", from: [2, 0], to: [6, 1], depth: 1 },
        { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 },
        { type: "private-subnet", label: "データ用サブネット", from: [6, 0], to: [6, 1], depth: 2 }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
        { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 0 },
        { id: "waf", icon: "services/waf", label: "AWS WAF\n防御", col: 1, row: 1 },
        { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
        { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 0 },
        { id: "asg", icon: "services/ec2-auto-scaling", label: "EC2\nAuto Scaling", col: 4, row: 0 },
        { id: "aurora", icon: "services/aurora", label: "Aurora\n記事DB", col: 6, row: 0 },
        { id: "cache", icon: "services/elasticache", label: "ElastiCache\nキャッシュ", col: 6, row: 1 }
      ],
      edges: [
        { from: "users", to: "cf", label: "HTTPS" },
        { from: "waf", to: "cf", noArrow: true, dashed: true },
        { from: "cf", to: "igw" },
        { from: "igw", to: "alb" },
        { from: "alb", to: "asg", label: "振り分け" },
        { from: "asg", to: "aurora", label: "SQL" },
        { from: "asg", to: "cache", label: "キャッシュ参照" }
      ]
    },
    flow: [
      "ユーザーのリクエストはまずCloudFrontが受ける。記事ページや画像の大半はエッジのキャッシュが返し、オリジンまで届くのはキャッシュにない分だけになる",
      "WAF（Webアプリケーションファイアウォール）はCloudFrontに紐づけ、SQLインジェクションなどの攻撃や異常な大量リクエストをエッジでブロックする",
      "キャッシュを通過したリクエストはインターネットゲートウェイからALBに入り、Auto Scalingで台数が増減するEC2群に振り分けられる",
      "EC2はまずElastiCache（メモリ上の高速キャッシュ）を参照し、なければAurora（記事DB）に問い合わせて結果をキャッシュに書き戻す。DBへの問い合わせを大幅に減らす定石の使い方",
      "速報時はアクセス増をCloudWatchのメトリクスが検知し、Auto ScalingがEC2を自動で追加する"
    ],
    services: [
      { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。記事・画像をエッジでキャッシュ配信し、オリジンへの到達リクエストを桁で減らす" },
      { icon: "services/waf", name: "AWS WAF", role: "Webアプリケーションファイアウォール。攻撃パターンの検知やレートベースの制限をエッジで行う" },
      { icon: "services/elb", name: "Application Load Balancer", role: "複数のEC2へリクエストを振り分け、異常なインスタンスを自動で切り離す" },
      { icon: "services/ec2-auto-scaling", name: "Amazon EC2 Auto Scaling", role: "負荷に応じてEC2の台数を自動で増減させる。速報スパイクへの耐性の中核" },
      { icon: "services/aurora", name: "Amazon Aurora", role: "MySQL/PostgreSQL互換の高性能マネージドDB。リードレプリカを増やして読み取りを分散できる" },
      { icon: "services/elasticache", name: "Amazon ElastiCache", role: "メモリ上のキャッシュ（Valkey/Redis互換）。記事本文やランキングを載せてDBを守る" }
    ],
    points: [
      "ニュースサイトは「同じ記事を大量の人が読む」ため、CloudFront→ElastiCache→Auroraの3段キャッシュ構造が非常に効く。各層で捌ければ下の層に負荷が届かない",
      "記事ページはキャッシュのTTLを短く（数十秒〜数分）設定し、速報の更新頻度と負荷軽減を両立する。パーソナライズ枠だけをJavaScriptで別途取得する設計にすると、ページ本体を共有キャッシュにできる",
      "Auroraはライターとリーダー（リードレプリカ）を分け、閲覧系のクエリはリーダーに向ける。閲覧が9割以上のメディアでは読み取り分散の効果が大きい",
      "EC2はプライベートサブネットに置き、外部から直接届かないようにする。OS更新などの外向き通信が必要になったらパブリックサブネットにNATゲートウェイを追加する"
    ],
    pros: [
      "各層（CDN・キャッシュ・DBレプリカ・Auto Scaling）が独立してスケールし、数千万PVでも成立する実績あるパターン",
      "WAF+CloudFrontで攻撃や急増トラフィックをオリジンの手前で吸収できる",
      "EC2の一部が壊れてもALBが切り離し、Auto Scalingが補充するため全体は落ちない",
      "既存のCMS（オンプレのLAMP構成など）からの移行がしやすい"
    ],
    cons: [
      "常時起動のEC2・Aurora・ElastiCacheが多く、月額固定費が大きい",
      "キャッシュの整合性設計（どこを何秒キャッシュするか、更新時にどう消すか）が難しく、設計を誤ると「古い記事が表示され続ける」事故になる",
      "構成要素が多く、監視・デプロイ・障害対応の運用体制が必要"
    ],
    cost: "<strong>月10万円〜50万円以上</strong>（EC2 t3.large相当×2〜10台＋ALB＋Aurora 2インスタンス＋ElastiCache＋CloudFront転送量数TBの前提）。PVよりもCloudFrontの転送量とAuroraのインスタンスサイズが支配的で、キャッシュヒット率の改善がそのままコスト削減になる。",
    references: [
      { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
      { title: "Amazon EC2 Auto Scalingとは", url: "https://docs.aws.amazon.com/ja_jp/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html" },
      { title: "Amazon Auroraとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html" },
      { title: "Amazon ElastiCacheとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonElastiCache/latest/dg/WhatIs.html" },
      { title: "AWS WAFとは", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/what-is-aws-waf.html" }
    ]
  },
  alternatives: [
    {
      name: "サーバーレスSSR（CloudFront + Lambda + DynamoDB）",
      when: "サーバー台数の管理をやめたい・アクセスの波が極端でアイドル時の固定費を削りたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\nSSR処理", col: 2, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n記事データ", col: 3, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n静的アセット", col: 2, row: 1 }
        ],
        edges: [
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "cf", to: "lambda", label: "動的ページ" },
          { from: "lambda", to: "ddb", label: "記事取得" },
          { from: "cf", to: "s3", label: "静的アセット" }
        ]
      },
      flow: [
        "CloudFrontがリクエストを受け、キャッシュにないページはオリジンのLambda（関数URL経由）に転送する",
        "LambdaがDynamoDBから記事データを取得してHTMLを生成する（SSR：サーバーサイドレンダリング）。生成結果はCloudFrontがキャッシュする",
        "CSS・JS・画像などの静的アセットはS3オリジンから配信する",
        "この構成にはVPCもゲートウェイ類も登場しない。Lambda・DynamoDB・S3はすべてAWSが運用するマネージドサービスで、利用者がネットワークを組む必要がないため"
      ],
      services: [
        { icon: "services/lambda", name: "AWS Lambda", role: "リクエストのたびに起動してHTMLを生成する関数実行環境。台数管理が不要で自動スケールする" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "記事データを保存するサーバーレスNoSQL。アクセス急増でも応答速度が安定している" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。SSR結果と静的アセットをキャッシュし、Lambdaの実行回数を減らす" },
        { icon: "services/s3", name: "Amazon S3", role: "CSS・JS・画像などの静的アセット置き場" }
      ],
      points: [
        "サーバーの台数設計・OS運用が丸ごと消える。速報スパイクもLambdaの同時実行数が自動で追従する",
        "課金がリクエスト数と実行時間に比例するため、深夜などアイドル時間帯の固定費がほぼゼロになる",
        "DynamoDBは「記事IDで1件取得」「新着順に一覧」のような決まったアクセスパターンに強い。複雑な集計や柔軟な検索はRDBより苦手なので、検索機能は別サービス（OpenSearch等）に切り出すのが定石",
        "Lambdaのコールドスタート（初回起動の遅延）対策として、CloudFrontのキャッシュヒット率を上げてLambda到達自体を減らす設計が重要"
      ],
      pros: [
        "サーバー管理ゼロでスパイクに自動追従する",
        "アイドル時のコストがほぼゼロになり、アクセスの波が激しいメディアと相性が良い",
        "構成要素が少なく、少人数でも運用できる"
      ],
      cons: [
        "既存CMS（WordPress等）からの移行はアプリの作り直しに近い工数がかかる",
        "DynamoDBはSQLのJOINや柔軟な集計ができず、データ設計の考え方をRDBから切り替える必要がある",
        "超高トラフィックではリクエスト課金が積み上がり、常時起動サーバーより高くつく場合もある（損益分岐の見極めが必要）"
      ],
      cost: "<strong>月1万円〜20万円程度</strong>（PVとキャッシュヒット率に強く依存。キャッシュヒット率90%なら月3,000万PVでもLambda実行は300万回で済む）。アイドル時がほぼゼロになる代わりに、トラフィック比例で青天井になり得る点に注意。",
      references: [
        { title: "Lambda関数URL", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-urls.html", note: "API Gatewayなしで関数をHTTPS公開する仕組み" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
        { title: "Amazon CloudFrontとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Introduction.html" }
      ]
    },
    {
      name: "静的生成 + API分離（Jamstack）",
      when: "記事本文は入稿時に確定する・動的要素が少ない・表示速度を最優先したい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] }
        ],
        nodes: [
          { id: "editor", icon: "resources/client", label: "編集部\nCMS入稿", col: 0, row: 0 },
          { id: "cb", icon: "services/codebuild", label: "CodeBuild\n静的ビルド", col: 1, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n静的HTML", col: 2, row: 0 },
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 1 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 2, row: 1 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway\n動的API", col: 3, row: 1 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\nAPI処理", col: 4, row: 1 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nランキング等", col: 5, row: 1 }
        ],
        edges: [
          { from: "editor", to: "cb", label: "入稿を検知" },
          { from: "cb", to: "s3", label: "ビルド成果物" },
          { from: "cf", to: "s3", label: "オリジン取得" },
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "cf", to: "apigw", label: "/apiのみ転送" },
          { from: "apigw", to: "lambda" },
          { from: "lambda", to: "ddb", label: "読み書き" }
        ]
      },
      flow: [
        "編集部がCMS（ヘッドレスCMS等）に入稿すると、CodeBuildが起動して全記事ページを静的HTMLにビルドし、S3へ配置する",
        "ユーザーへの配信はCloudFront+S3の純粋な静的配信になり、記事表示はDBに一切アクセスしない",
        "ランキングやコメント数など動的な部分だけを、ページ内のJavaScriptがCloudFront経由で/apiパスからAPI Gateway+Lambda+DynamoDBに問い合わせる",
        "「表示の土台は静的、動く部分だけAPI」という分離がJamstackと呼ばれる考え方"
      ],
      services: [
        { icon: "services/codebuild", name: "AWS CodeBuild", role: "入稿をトリガーに静的サイトジェネレーター（Next.js/Hugo等）を実行するビルドサービス" },
        { icon: "services/s3", name: "Amazon S3", role: "ビルドされた静的HTMLの置き場。配信の負荷はS3に届く前にCloudFrontが吸収する" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。静的ページの配信と/apiパスの振り分けを1つのドメインで行う" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "動的APIの入口。認証やレート制限を担う" },
        { icon: "services/lambda", name: "AWS Lambda", role: "ランキング集計やコメント取得などのAPI処理を実行" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "ランキング・コメントなど動的データの保存先" }
      ],
      points: [
        "記事表示が完全に静的なので、速報のスパイクが何倍来てもDBには一切届かない。「落ちない」方向の堅牢さでは最強クラス",
        "全記事の再ビルドは記事数が増えるほど時間がかかる。差分ビルドや、更新記事だけ再生成する仕組み（ISR等）の検討が実運用の肝",
        "CloudFrontのビヘイビア（パスごとの振り分け設定）で、同一ドメインの/api以下だけAPI Gatewayに向けるとCORS問題を避けられる",
        "速報を秒単位で反映したい媒体には不向き。ビルド＋キャッシュ削除で数分かかる前提を編集部と合意しておく"
      ],
      pros: [
        "表示速度と耐障害性が最も高い（記事表示はCDN+静的ファイルのみで完結）",
        "配信部分のコストが静的サイト並みに安い",
        "セキュリティの攻撃対象がAPI部分だけに絞られる"
      ],
      cons: [
        "入稿から公開反映までにビルド時間のタイムラグがある（速報性とのトレードオフ）",
        "ヘッドレスCMS＋静的サイトジェネレーターの開発体制が必要で、従来型CMSからの移行コストが大きい",
        "記事数が数十万本規模になるとビルド戦略（差分・分割）の設計難度が上がる"
      ],
      cost: "<strong>月1万円〜10万円程度</strong>（CloudFront転送量が支配的。ビルドはCodeBuildの実行分課金、APIはリクエスト比例）。配信部分は静的サイト並みに安く、動的API部分だけが従量で増える。",
      references: [
        { title: "AWS CodeBuildとは", url: "https://docs.aws.amazon.com/ja_jp/codebuild/latest/userguide/welcome.html" },
        { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html" },
        { title: "Amazon S3を使用して静的ウェブサイトをホスティングする", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/WebsiteHosting.html" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月10万円〜50万円以上</strong>と固定費が大きいが、数千万PVを安定して捌く実績と移行のしやすさがある。サーバーレスSSRは<strong>月1万円〜20万円程度</strong>でアイドル時がほぼゼロになる代わりにトラフィック比例で増える。Jamstackは配信部分が静的サイト並みに安く<strong>月1万円〜10万円程度</strong>。3案ともCloudFrontの転送量が大きな割合を占めるため、キャッシュヒット率の改善が共通のコスト対策になる。</p>",
  summary: "<p>大規模メディアの本質は「同じコンテンツを大量の人が読む」ことなので、<strong>いかに多くのリクエストをDBより手前の層で返すか</strong>が設計の中心になります。推奨構成はCDN→アプリ内キャッシュ→DBレプリカと多段で受け止める王道で、既存資産からの移行にも向きます。一方、開発体制を変えられるなら、サーバーレスSSRやJamstackのように「そもそも守るべきサーバーを減らす」アプローチが運用もコストも軽くなります。速報性（秒で反映）と静的化（ビルドに数分）のトレードオフが選定の分かれ目です。</p>",
  quiz: [
    {
      q: "この構成はCloudFront・ElastiCache・Auroraリーダーと三段のキャッシュを重ねています。なぜ一段では足りないのでしょうか。",
      a: "各層で受け止められたリクエストは下の層に届かないため、段を重ねるほどDBに到達する量が減ります。CloudFrontは同じ記事URLへの大量アクセスを、ElastiCacheはランキングなどページをまたいで使うデータを担当し、それでも残った読み取りをAuroraのリーダーが処理する、と役割が違うのがポイントです。速報でアクセスが十倍になっても、増えるのは主に一番上の層の処理量だけになります。"
    },
    {
      q: "記事ページのキャッシュTTLを数時間に延ばせば負荷はさらに減ります。それでも数十秒から数分に抑えているのはなぜでしょうか。",
      a: "ニュースサイトは速報の訂正や続報こそが価値なので、古い内容が長時間表示され続けることが事業リスクになります。TTLは負荷軽減と情報の鮮度のトレードオフを決める数字で、媒体の性格によって適正値が変わります。短いTTLでも耐えられるように、パーソナライズ枠だけを別取得にしてページ本体を全員共有のキャッシュにする工夫を組み合わせています。"
    },
    {
      q: "編集部から「速報は一秒でも早く出したい」と強く要望されました。Jamstack（静的生成）案を検討していたとして、あなたならどう判断しますか。",
      a: "Jamstackは記事表示がCDNと静的ファイルだけで完結する最も堅牢な構成ですが、入稿からビルドとキャッシュ削除まで数分のタイムラグが避けられません。秒単位の速報性が最優先要件なら、この時点でJamstackは要件を満たさないと判断し、推奨構成かサーバーレスSSR案へ寄せます。要件同士が衝突したときは、どちらを捨てるかを編集部と合意してから構成を決めるのが順序です。"
    }
  ]
});
