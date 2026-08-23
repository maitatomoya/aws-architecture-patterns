// ケース11：BtoB会員制ポータル
registerCase({
  id: 11,
  category: "Webアプリ・EC",
  title: "BtoB会員制ポータル",
  scenario: "<p>メーカーが取引先（販売代理店）向けに、見積・発注・請求書ダウンロードができる会員制ポータルを構築したい。利用者は取引先企業の担当者数百名で、一般公開はしない。取引条件や価格といった機密性の高い情報を扱うため、取引先からは「セキュリティ対策の説明」を求められる。アクセスは平日日中に集中し、夜間・休日はほぼゼロ。社内の開発チームは3名。</p>",
  requirements: [
    "取引先ごとのアカウント管理と、確実なログイン認証（多要素認証含む）",
    "見積・価格など機密情報を扱うため、通信と保存の安全性を確保したい",
    "取引先に説明できるセキュリティ対策（WAF・アクセス制御）を備えたい",
    "利用者は数百名規模で急増はしないが、安定稼働が求められる",
    "少人数チームで構築・運用できること"
  ],
  main: {
    name: "Cognito + WAF + ALB + ECS + RDS（VPCで守る会員制Web）",
    diagram: {
      cols: 7, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 1] },
        { type: "vpc", label: "VPC", from: [3, 0], to: [6, 1], depth: 1 },
        { type: "public-subnet", label: "パブリックサブネット", from: [4, 0], to: [4, 1], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [5, 1], to: [6, 1], depth: 2 }
      ],
      nodes: [
        { id: "client", icon: "resources/client", label: "取引先\n担当者", col: 0, row: 1 },
        { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 0 },
        { id: "waf", icon: "services/waf", label: "AWS WAF", col: 2, row: 0 },
        { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 3, row: 1 },
        { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 4, row: 0 },
        { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 4, row: 1 },
        { id: "ecs", icon: "services/ecs", label: "ECS(Fargate)\nポータル", col: 5, row: 1 },
        { id: "rds", icon: "services/rds", label: "RDS\n取引データ", col: 6, row: 1 }
      ],
      edges: [
        { from: "client", to: "cognito", label: "ログイン" },
        { from: "client", to: "igw", label: "HTTPS" },
        { from: "waf", to: "alb", noArrow: true, dashed: true },
        { from: "cognito", to: "alb", label: "認証連携", dashed: true },
        { from: "igw", to: "alb" },
        { from: "alb", to: "ecs", label: "振り分け" },
        { from: "ecs", to: "rds", label: "SQL" },
        { from: "ecs", to: "nat", dashed: true }
      ]
    },
    flow: [
      "取引先の担当者はCognitoでログインする。多要素認証（パスワードに加えワンタイムコード等を要求する仕組み）もCognitoの設定で有効化できる",
      "ポータルへのリクエストはインターネットゲートウェイを通ってALBに届く。ALBにはWAFを適用し、攻撃パターンを入口で遮断する",
      "ALBはCognitoと連携して未ログインのリクエストを弾き、認証済みのリクエストだけをプライベートサブネットのECSへ振り分ける",
      "見積・発注などの取引データはプライベートサブネットのRDSに保存する。外部の基幹システムAPIへの接続などの外向き通信はNATゲートウェイを経由する"
    ],
    services: [
      { icon: "services/cognito", name: "Amazon Cognito", role: "取引先担当者のアカウント管理・ログイン・多要素認証。招待制のユーザー作成にも対応" },
      { icon: "services/waf", name: "AWS WAF", role: "SQLインジェクション等の攻撃遮断に加え、IPセットで接続元を取引先に限定する制御もできる" },
      { icon: "services/elb", name: "Application Load Balancer", role: "リクエストの振り分けとCognito連携による入口での認証チェック" },
      { icon: "services/ecs", name: "Amazon ECS（Fargate）", role: "ポータルアプリのコンテナ実行基盤。サーバー管理不要で少人数運用に向く" },
      { icon: "services/rds", name: "Amazon RDS", role: "見積・発注・請求データを保存するマネージドRDB。保存時の暗号化を有効にする" },
      { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットから基幹システムAPI等への外向き通信の出口" }
    ],
    points: [
      "BtoBポータルは「誰が入れるか」の管理が主戦場。認証をCognito、認可チェックをALBの入口に集約することで、アプリのページごとに認証コードを書く事故（実装漏れ＝情報漏えい）を防ぐ",
      "取引先への説明責任がある案件では、「WAFで攻撃遮断」「DBはプライベートサブネットで外部から到達不可」「通信・保存とも暗号化」と、対策を構成図で示せること自体が営業上の価値になる",
      "利用者数百名・平日日中のみという負荷なら性能設計は容易。それでもALB+ECSにするのは、コンテナの入れ替えデプロイで平日日中でも無停止リリースできるようにするため",
      "さらに接続元を絞りたい場合、WAFのIPセット（許可するIPアドレスの一覧）で取引先の固定IPだけ許可する制限を入口に追加できる。閉域が必要になったら代替パターン3へ進む"
    ],
    pros: [
      "認証・攻撃対策・ネットワーク分離という説明可能な多層防御を標準サービスだけで構成できる",
      "Fargateによりサーバー管理が不要で、3名チームでも運用が回る",
      "コンテナの入れ替えデプロイで業務時間中も無停止でリリースできる",
      "アカウント管理（招待・無効化・多要素認証）をCognitoの機能でまかなえる"
    ],
    cons: [
      "ALB・NAT・RDSなど常時起動の固定費が、利用が平日日中だけでもかかり続ける",
      "VPC・サブネット・セキュリティグループの設計に一定のネットワーク知識が必要",
      "Cognitoのログイン画面のデザイン自由度には制約がある（作り込むなら自前実装が必要）"
    ],
    cost: "<strong>月3万円〜8万円程度</strong>（Fargate2タスク＋RDSマルチAZ＋ALB・NAT・WAF、東京リージョン。Cognitoは数百ユーザーなら無料枠内）。利用が平日日中だけでも固定費は24時間ぶんかかる点は、コスト説明の際に正直に伝えるべきポイント。",
    references: [
      { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html", note: "Cognito公式デベロッパーガイド" },
      { title: "ALBでのユーザー認証（Cognito連携）", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/listener-authenticate-users.html", note: "図の「認証連携」の公式解説" },
      { title: "AWS WAFとは", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/what-is-aws-waf.html" },
      { title: "WAFのIPセットマッチルール", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/waf-rule-statement-type-ipset-match.html", note: "取引先IP制限を行う場合の公式解説" },
      { title: "VPCのセキュリティのベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-security-best-practices.html" }
    ]
  },
  alternatives: [
    {
      name: "サーバーレス化（API Gateway + Lambda + DynamoDB）",
      when: "利用が平日日中に偏る特性を活かして固定費をなくしたい・画面はSPA中心で作れる場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "client", icon: "resources/client", label: "取引先\n担当者", col: 0, row: 1 },
          { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 0 },
          { id: "waf", icon: "services/waf", label: "AWS WAF", col: 2, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 2, row: 1 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n業務処理", col: 3, row: 1 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n取引データ", col: 4, row: 1 }
        ],
        edges: [
          { from: "client", to: "cognito", label: "ログイン" },
          { from: "client", to: "apigw", label: "API+JWT" },
          { from: "waf", to: "apigw", noArrow: true, dashed: true },
          { from: "cognito", to: "apigw", noArrow: true, dashed: true },
          { from: "apigw", to: "lambda" },
          { from: "lambda", to: "ddb", label: "読み書き" }
        ]
      },
      flow: [
        "担当者はCognitoでログインしてトークンを取得し、以降のAPI呼び出しに添える",
        "API GatewayにはWAFを適用し、さらにCognitoオーソライザーでトークンを検証して、不正リクエストを入口で二重に弾く",
        "認証を通ったリクエストだけがLambdaで処理され、取引データをDynamoDBに読み書きする",
        "この構成にVPCやゲートウェイ類は登場しない。全コンポーネントがVPC外のマネージドサービスで、夜間・休日はコストがほぼゼロになる"
      ],
      services: [
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "APIの受付窓口。WAF適用とCognitoトークン検証を入口で行う" },
        { icon: "services/lambda", name: "AWS Lambda", role: "見積・発注などの業務処理。リクエストが来たときだけ課金される" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "取引データの保存先。オンデマンド課金なら夜間・休日の費用がほぼゼロ" },
        { icon: "services/cognito", name: "Amazon Cognito", role: "取引先担当者の認証とトークン発行" },
        { icon: "services/waf", name: "AWS WAF", role: "API Gatewayに適用する攻撃遮断・IP制限" }
      ],
      points: [
        "平日日中しか使われないBtoBポータルは、実は稼働時間が全体の3割以下。固定費型との差が最も出やすい利用パターンで、サーバーレス化の費用対効果が高い",
        "「VPCがない＝守りが弱い」ではない。守る対象がネットワークからIAM（サービス間の権限設定）とトークン検証に移るだけで、各サービスへのアクセスはすべて認証・認可を通る",
        "見積や請求の履歴などは形が定まっているためDynamoDBでも設計しやすいが、「条件を組み合わせた検索」が多い業務ならRDS（Aurora Serverless v2）を選ぶ判断もある",
        "帳票PDFの生成など時間のかかる処理は、Lambdaの実行時間上限（15分）を意識して非同期処理に逃がす設計にする"
      ],
      pros: [
        "夜間・休日のコストがほぼゼロになり、利用パターンと課金が一致する",
        "サーバー・OS・ネットワークの管理が不要で、3名チームの負担が最小",
        "WAF+Cognitoオーソライザーで、入口の守りは推奨構成と同水準を保てる"
      ],
      cons: [
        "既存のRDB前提の業務ロジックがあるなら、DynamoDB設計への移行コストがかかる",
        "コールドスタートで初回応答が遅れることがあり、体感品質の確認が必要",
        "複雑な帳票・集計処理はLambdaの制約（実行時間・メモリ）に合わせた設計が必要"
      ],
      cost: "<strong>月数千円〜2万円程度</strong>（数百ユーザー・平日日中利用の従量課金＋WAF固定費）。推奨構成の固定費型と比べ、利用の少ないBtoBポータルでは大幅に安くなりやすい。",
      references: [
        { title: "API GatewayとCognitoユーザープールの統合", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html", note: "入口でのトークン検証の公式手順" },
        { title: "AWS Lambdaとは", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/welcome.html" },
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
        { title: "HTTP APIとREST APIの選択", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/http-api-vs-rest.html", note: "API Gatewayの2方式の公式比較" }
      ]
    },
    {
      name: "Site-to-Site VPNによる閉域接続（インターネット非公開）",
      when: "取引先が大企業中心で「インターネット経由は不可」という要件がある・接続拠点数が限られる場合",
      diagram: {
        cols: 7, rows: 2,
        groups: [
          { type: "onpremise", label: "取引先オフィス", from: [0, 0], to: [0, 1] },
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [6, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [6, 1], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "resources/office", label: "取引先\n社内ネットワーク", col: 0, row: 1 },
          { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site\nVPN", col: 2, row: 1 },
          { id: "alb", icon: "services/elb", label: "内部ALB", col: 4, row: 1 },
          { id: "ecs", icon: "services/ecs", label: "ECS(Fargate)\nポータル", col: 5, row: 1 },
          { id: "rds", icon: "services/rds", label: "RDS\n取引データ", col: 6, row: 1 }
        ],
        edges: [
          { from: "office", to: "vpn", label: "IPsec VPN" },
          { from: "vpn", to: "alb", label: "閉域通信" },
          { from: "alb", to: "ecs" },
          { from: "ecs", to: "rds", label: "SQL" }
        ]
      },
      flow: [
        "取引先オフィスのネットワーク機器とAWSの間にSite-to-Site VPN（インターネット上に暗号化された専用トンネルを張る仕組み）を確立する",
        "担当者は社内ネットワークからVPNトンネル経由でのみポータルにアクセスできる。社外や自宅からは届かない",
        "ALBは内部ALB（VPC内部にだけ公開されるロードバランサー）として構成し、ECS・RDSはすべてプライベートサブネットに置く",
        "この図にインターネットゲートウェイが無いのは省略ではない。インターネットからの入口をそもそも作らないのがこの構成の目的で、コンテナイメージ取得などAWSサービスへの通信はVPCエンドポイント（AWS内部の接続口。図では省略）でまかなう"
      ],
      services: [
        { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "取引先拠点とVPCを結ぶ暗号化トンネル。拠点ごとに接続を作成する" },
        { icon: "services/elb", name: "Application Load Balancer（内部）", role: "VPC内部にだけ公開されるロードバランサー。インターネットからは見えない" },
        { icon: "services/ecs", name: "Amazon ECS（Fargate）", role: "ポータルアプリの実行基盤。完全にプライベートサブネット内で動く" },
        { icon: "services/rds", name: "Amazon RDS", role: "取引データの保存先" }
      ],
      points: [
        "「インターネットに公開しない」は最強のアクセス制御。ログイン画面すら外部から見えないため、パスワード攻撃やWAFで防ぐ類いの攻撃が構造的に成立しない",
        "その代わり取引先ごとにVPN接続（先方のネットワーク機器設定を含む）が必要で、相手側にも情報システム部門の協力が求められる。接続拠点が数社までなら現実的、数十社では運用が破綻しやすい",
        "軽量な代替として「WAFのIPセットで取引先の固定IPだけ許可する」方法がある。閉域ほどの強度はないが、相手側の作業が不要で数十社にもスケールする。要件の強さで使い分ける",
        "リモートワークの担当者が使えなくなる問題には、取引先側のVPN経由アクセスか、クライアントVPN追加で対応する。要件定義の段階で利用シーンを確認しておく"
      ],
      pros: [
        "インターネット非公開により、外部からの攻撃面がほぼゼロになる",
        "「閉域接続」という要件をそのまま満たし、大企業・規制業種の監査に通しやすい",
        "経路が固定されるため、通信の監視・記録も説明しやすい"
      ],
      cons: [
        "取引先ごとにVPN設定・機器・調整が必要で、追加のたびに双方の作業が発生する",
        "取引先の増加やリモートワークへの対応が難しく、BtoBポータルの手軽さが失われる",
        "VPN接続料とVPCエンドポイント費用が上乗せされ、構成全体の費用と複雑さが増す"
      ],
      cost: "<strong>月4万円〜10万円程度＋VPN接続1本あたり月5,000円程度</strong>（基本構成はFargate+RDSマルチAZ+内部ALB、東京リージョン。VPCエンドポイント費用を含む）。接続拠点数に比例してVPN費用と調整コストが増える。",
      references: [
        { title: "AWS Site-to-Site VPNとは", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/VPC_VPN.html", note: "Site-to-Site VPN公式ユーザーガイド" },
        { title: "WAFのIPセットマッチルール", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/waf-rule-statement-type-ipset-match.html", note: "軽量な代替となるIP制限の公式解説" },
        { title: "ECRのVPCエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/vpc-endpoints.html", note: "閉域でコンテナイメージを取得する方法" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月3万円〜8万円程度</strong>の固定費型。サーバーレス案は<strong>月数千円〜2万円程度</strong>で、平日日中しか使われないBtoBポータルの利用パターンでは差が開きやすい。閉域VPN案は<strong>月4万円〜10万円程度＋VPN接続ごとの費用</strong>で、金額よりも取引先との調整コストが実質的な負担になる。セキュリティ要件の強さ（公開Web＋WAFで足りるか、IP制限か、閉域か）がそのまま構成とコストを決める。</p>",
  summary: "<p>BtoB会員制ポータルの設計軸は、性能よりも<strong>「アクセスできる人をどう絞り、それを取引先にどう説明するか」</strong>です。推奨構成のCognito+WAF+プライベートサブネットは、標準サービスだけで説明可能な多層防御を作る定石です。そのうえで、セキュリティ要件の強度に応じて「公開Web＋WAF → IP制限 → 閉域VPN」と段階的に選択肢があること、逆にコスト最適化の方向ではサーバーレス化が有効なことを整理しておくと、要件定義の会話にそのまま使えます。認証をCognitoに寄せて自前実装を避ける判断は、どの構成でも共通の核心です。</p>"
});
