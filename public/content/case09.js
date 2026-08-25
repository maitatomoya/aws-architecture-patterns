// ケース9：SaaSマルチテナント基盤
registerCase({
  id: 9,
  category: "Webアプリ・EC",
  title: "SaaSマルチテナント基盤",
  scenario: "<p>企業向けの業務SaaS（勤怠管理サービス）を開発・提供したい。マルチテナント、つまり1つのシステムを複数の契約企業（テナント）で共用する形態で、まずは数十社、将来は数百社の利用を見込む。テナントごとのデータ分離は契約上の必須要件で、「他社のデータが見えた」は事業存続に関わる事故になる。開発チームは10名弱、コンテナ開発の経験がある。</p>",
  requirements: [
    "1つの基盤を複数テナントで共用し、インフラコストを抑えたい",
    "テナント間のデータ分離を確実に保証したい（情報漏えいは致命傷）",
    "テナントごとにユーザー認証・権限管理が必要",
    "テナント追加（オンボーディング）を素早く・自動で行いたい",
    "特定テナントの高負荷が他テナントの性能に影響しにくくしたい"
  ],
  main: {
    name: "Cognito + ALB + ECS + Aurora（プール型：全テナント共用）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
        { type: "vpc", label: "VPC", from: [2, 0], to: [5, 1], depth: 1 },
        { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [5, 1], depth: 2 }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "各テナントの\n利用者", col: 0, row: 1 },
        { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 0 },
        { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
        { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 0 },
        { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 1 },
        { id: "ecs", icon: "services/ecs", label: "ECS(Fargate)\nSaaSアプリ", col: 4, row: 1 },
        { id: "aurora", icon: "services/aurora", label: "Aurora\n共用DB", col: 5, row: 1 }
      ],
      edges: [
        { from: "users", to: "cognito", label: "ログイン" },
        { from: "users", to: "igw", label: "HTTPS" },
        { from: "cognito", to: "alb", label: "認証連携", dashed: true },
        { from: "igw", to: "alb" },
        { from: "alb", to: "ecs", label: "振り分け" },
        { from: "ecs", to: "aurora", label: "SQL" },
        { from: "ecs", to: "nat", dashed: true }
      ]
    },
    flow: [
      "利用者はまずCognitoでログインする。発行されるトークン（JWT）には所属テナントのID（テナント識別子）を埋め込んでおく",
      "アプリへのリクエストはインターネットゲートウェイを通ってALBに届く。ALBはCognitoと連携し、未ログインのリクエストを入口で弾ける",
      "ALBはプライベートサブネットのECSコンテナ群へ振り分ける。アプリはトークン内のテナントIDを信頼の起点として処理する",
      "データは全テナント共用のAuroraに保存し、全テーブルにテナントID列を持たせて必ず絞り込む。コンテナの外向き通信はNATゲートウェイを経由する"
    ],
    services: [
      { icon: "services/cognito", name: "Amazon Cognito", role: "サインイン・サインアップとトークン発行を担う認証基盤。テナントごとのグループや属性を管理できる" },
      { icon: "services/elb", name: "Application Load Balancer", role: "リクエスト振り分けに加え、Cognito連携で認証を入口に集約できる" },
      { icon: "services/ecs", name: "Amazon ECS（Fargate）", role: "SaaSアプリのコンテナ実行基盤。全テナントのリクエストを同じコンテナ群で処理する" },
      { icon: "services/aurora", name: "Amazon Aurora", role: "全テナント共用のDB。行レベルでテナントIDにより分離する" },
      { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットからの外向き通信（外部API呼び出し等）の出口" }
    ],
    points: [
      "プール型（全テナントで基盤を共用する方式）は、テナントが増えてもインフラがほぼ増えないためコスト効率が最も高い。その代償として「アプリのバグ1つで他社データが見える」リスクを背負うので、分離はコードの規律で守る",
      "プール型とサイロ型の2択ではなく、間に「ブリッジ型」もある。アプリは全テナントで共用したまま、DBインスタンスやスキーマ（DB内の論理的な区画）だけをテナント別に分ける折衷案で、実務では「アプリは1系統で運用しつつ、データ分離の説明責任が重い顧客にはDBを分ける」形でよく使われる",
      "テナントIDはリクエストパラメータではなく、Cognitoが署名したトークンから取り出す。利用者が改ざんできない場所に分離の起点を置くのが鉄則",
      "DBアクセスは「テナントIDで必ず絞るデータアクセス層」を1か所に集約し、素のSQLを書かせない。PostgreSQLの行レベルセキュリティ（行単位のアクセス制御機能）を併用するとバグへの保険になる",
      "特定テナントの高負荷が全体を巻き込む「うるさい隣人問題」には、API Gatewayやアプリ側でのテナント別流量制限、将来的には大口テナントだけ専用リソースに退避するハイブリッド化で備える"
    ],
    pros: [
      "テナント数が増えてもインフラコストがほぼ一定で、SaaSの利益率を確保しやすい",
      "デプロイ・監視の対象が1系統で済み、少人数チームでも数百社を運用できる",
      "テナント追加はDBへの登録だけで完了し、オンボーディングが即時",
      "Cognito+ALB連携により、認証処理をアプリから分離して入口に集約できる"
    ],
    cons: [
      "データ分離がアプリの実装品質に依存する（テナントID絞り込み漏れが即事故）",
      "全テナントが同じ基盤に乗るため、障害・メンテナンスの影響が全社に及ぶ",
      "「専用環境にしてほしい」という大企業の要求には応えにくい",
      "テナント別の性能保証やコスト按分の仕組みは自作が必要"
    ],
    cost: "<strong>月3万円〜10万円程度</strong>（Fargate2〜4タスク＋Auroraライター+リーダー＋ALB・NAT、東京リージョン。Cognitoは月間アクティブユーザー数に応じた従量課金で、小規模なら無料枠内）。テナント数が10倍になっても、この基盤費用は数倍程度に収まるのがプール型の強み。",
    references: [
      { title: "SaaSアーキテクチャの基礎（AWSホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/saas-architecture-fundamentals/saas-architecture-fundamentals.html", note: "プール型・サイロ型などテナント方式の公式整理" },
      { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html" },
      { title: "ALBでのユーザー認証（Cognito連携）", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/listener-authenticate-users.html", note: "図の「認証連携」の公式解説" },
      { title: "マルチテナントSaaSのAPIアクセス認可", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html", note: "テナントIDをトークンで運ぶ設計の公式ガイド" }
    ]
  },
  alternatives: [
    {
      name: "サイロ型（テナントごとにAWSアカウントを分離）",
      when: "金融・医療など分離要件が厳格な顧客が中心・テナント単価が高く環境費用を転嫁できる場合",
      diagram: {
        cols: 7, rows: 3,
        groups: [
          { type: "account", label: "テナントA専用アカウント", from: [2, 0], to: [6, 0] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [6, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [4, 0], to: [4, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [6, 0], to: [6, 0], depth: 2 },
          { type: "account", label: "テナントB専用アカウント", from: [2, 2], to: [6, 2] },
          { type: "vpc", label: "VPC", from: [3, 2], to: [6, 2], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [4, 2], to: [4, 2], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [6, 2], to: [6, 2], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "各テナントの\n利用者", col: 0, row: 1 },
          { id: "org", icon: "services/organizations", label: "Organizations\nアカウント統制", col: 1, row: 1 },
          { id: "igwA", icon: "resources/internet-gateway", label: "IGW", col: 3, row: 0 },
          { id: "ecsA", icon: "services/ecs", label: "ECS\nアプリ", col: 4, row: 0 },
          { id: "auroraA", icon: "services/aurora", label: "Aurora\n専用DB", col: 6, row: 0 },
          { id: "igwB", icon: "resources/internet-gateway", label: "IGW", col: 3, row: 2 },
          { id: "ecsB", icon: "services/ecs", label: "ECS\nアプリ", col: 4, row: 2 },
          { id: "auroraB", icon: "services/aurora", label: "Aurora\n専用DB", col: 6, row: 2 }
        ],
        edges: [
          { from: "users", to: "igwA", label: "テナントA" },
          { from: "users", to: "igwB", label: "テナントB" },
          { from: "org", to: "ecsA", dashed: true, noArrow: true },
          { from: "org", to: "ecsB", dashed: true, noArrow: true },
          { from: "igwA", to: "ecsA" },
          { from: "ecsA", to: "auroraA", label: "SQL" },
          { from: "igwB", to: "ecsB" },
          { from: "ecsB", to: "auroraB", label: "SQL" }
        ]
      },
      flow: [
        "テナントごとに専用のAWSアカウントを払い出し、その中にアプリ・DB一式を丸ごと複製する（図は1アカウントぶんを簡略化しており、実際は推奨構成と同じALB等を含む）",
        "利用者はテナント専用のURLから、自社専用アカウント内の環境にアクセスする",
        "AWS Organizationsが全アカウントを束ね、請求の集約と、ガードレール（SCP：アカウント内で禁止操作を強制するポリシー）の適用を行う",
        "新規テナントのオンボーディングは、IaC（インフラのコード化）でアカウントごと自動複製する"
      ],
      services: [
        { icon: "services/organizations", name: "AWS Organizations", role: "多数のアカウントを一元管理する仕組み。請求集約とSCPによる統制の要" },
        { icon: "services/ecs", name: "Amazon ECS（Fargate）", role: "各テナント専用のアプリ実行基盤。テナント間でリソースを一切共有しない" },
        { icon: "services/aurora", name: "Amazon Aurora", role: "テナント専用DB。アカウント境界で物理的に分離される" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "各テナントVPCの入口。アカウントごとに独立して存在する" }
      ],
      points: [
        "アカウント境界はAWSにおける最強の分離境界。アプリのバグでは越えられないため、「他社データが見える」事故を構造的に防げるのが最大の価値",
        "テナント別の障害影響・性能影響・コストがアカウント単位で自然に分離され、「A社のコストはいくら」が請求書レベルで説明できる",
        "環境の複製・更新はCloudFormation等のIaC必須。手作業では数十テナントで確実に破綻する",
        "全テナントへのアプリ更新は数十回のデプロイになる。デプロイパイプラインの自動化と、バージョンずれの管理がプール型にはない新たな仕事になる"
      ],
      pros: [
        "アカウント境界による物理的な分離で、データ混在事故を構造的に防げる",
        "障害・高負荷・メンテナンスの影響が他テナントに波及しない",
        "「専用環境」を求める大企業・規制業種の要件にそのまま応えられる",
        "テナント別コストが請求書単位で正確に把握できる"
      ],
      cons: [
        "テナント数に比例してインフラ費用が増える（共用によるコスト削減が効かない）",
        "全テナント一斉のアプリ更新・監視など、運用の自動化に大きな投資が必要",
        "テナント追加にアカウント発行を伴い、オンボーディングが分単位では済まない"
      ],
      cost: "<strong>月2万円〜5万円程度×テナント数</strong>（1テナントあたり最小のFargate+Aurora+ALB構成の場合）。10社で月20万〜50万円と、プール型との差はテナント数に比例して開く。テナント単価に環境費用を転嫁できる価格設定が前提になる。",
      references: [
        { title: "AWS Organizationsとは", url: "https://docs.aws.amazon.com/ja_jp/organizations/latest/userguide/orgs_introduction.html", note: "マルチアカウント統制の公式ユーザーガイド" },
        { title: "SaaSテナント分離戦略（AWSホワイトペーパー）", url: "https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/saas-tenant-isolation-strategies.html", note: "サイロ/プールの分離手法を体系的に解説（英語）。2020年公開版で、公式が「歴史的参照（historical reference）」と明示している点に注意" },
        { title: "SaaSアーキテクチャの基礎（AWSホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/saas-architecture-fundamentals/saas-architecture-fundamentals.html" }
      ]
    },
    {
      name: "EKS基盤（大規模・高カスタマイズのコンテナ運用）",
      when: "テナント数百規模・専任のプラットフォームチームがあり、Kubernetesの細かい制御力が必要な場合",
      diagram: {
        cols: 7, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [5, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [5, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "各テナントの\n利用者", col: 0, row: 1 },
          { id: "cognito", icon: "services/cognito", label: "Cognito\n認証", col: 1, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 0 },
          { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 1 },
          { id: "eks", icon: "services/eks", label: "EKS\nK8sクラスター", col: 4, row: 1 },
          { id: "aurora", icon: "services/aurora", label: "Aurora\n共用DB", col: 5, row: 1 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 6, row: 0 }
        ],
        edges: [
          { from: "users", to: "cognito", label: "ログイン" },
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "cognito", to: "alb", label: "認証連携", dashed: true },
          { from: "igw", to: "alb" },
          { from: "alb", to: "eks", label: "振り分け" },
          { from: "eks", to: "aurora", label: "SQL" },
          { from: "eks", to: "ecr", label: "イメージ取得", dashed: true },
          { from: "eks", to: "nat", dashed: true }
        ]
      },
      flow: [
        "入口の構成（Cognito・IGW・ALB）はプール型と同じで、アプリ実行基盤だけがECSからEKS（マネージドKubernetes）に置き換わる",
        "EKSクラスター内では、Kubernetesのnamespace（クラスター内の論理的な仕切り）でテナントや機能ごとにワークロードを分離できる",
        "コンテナイメージはECRからNATゲートウェイまたはVPCエンドポイント経由で取得する",
        "スケジューリング・リソース割当・ネットワークポリシーなど、Kubernetesの豊富な制御機能でテナント別の細かい運用要件に応える"
      ],
      services: [
        { icon: "services/eks", name: "Amazon EKS", role: "マネージドKubernetes。namespaceやリソースクォータでテナント別の細かい制御ができる" },
        { icon: "services/ecr", name: "Amazon ECR", role: "コンテナイメージの保管場所" },
        { icon: "services/cognito", name: "Amazon Cognito", role: "テナント利用者の認証とトークン発行" },
        { icon: "services/elb", name: "Application Load Balancer", role: "クラスターへの入口となるロードバランサー" },
        { icon: "services/aurora", name: "Amazon Aurora", role: "テナントデータの保存先" }
      ],
      points: [
        "namespace＋リソースクォータで「テナントAには最大これだけのCPU」といった割当制御ができ、うるさい隣人問題にKubernetesの標準機能で対処できる",
        "Helmチャート等でテナント環境をコード化すれば、プール型とサイロ型の中間（同一クラスター内でテナント別namespace分離）が柔軟に作れる",
        "その代償として、クラスターのバージョンアップ（年数回、追従必須）やアドオン管理という継続的な運用負荷が発生する。ECSにはないこの負荷を引き受けられる体制かが採用の分かれ目",
        "エコシステム（監視・CI/CD・サービスメッシュ）の選択肢が豊富な反面、選定・習熟のコストも大きい。「小規模ならECS、制御力が必要な規模になったらEKS」が現実的な使い分け"
      ],
      pros: [
        "namespaceやクォータなど、テナント分離・リソース制御の表現力が最も高い",
        "Kubernetesの標準技術なので、他クラウドやオンプレとの可搬性がある",
        "豊富なOSSエコシステムを活用でき、数百テナント規模の複雑な要件に応えられる"
      ],
      cons: [
        "クラスター管理費（約1万円/月）と、バージョンアップ追従などの運用負荷が常にかかる",
        "Kubernetesの学習コストが高く、専任のプラットフォーム担当がいないと破綻しやすい",
        "小〜中規模ではECSに対する明確な利点が出にくく、過剰装備になりがち"
      ],
      cost: "<strong>月10万円〜30万円程度</strong>（EKSコントロールプレーン約1万円＋ワーカーノードEC2数台＋Aurora・ALB・NAT、東京リージョン）。基盤自体のコストに加え、専任運用者の人件費を織り込んで判断すべき構成。",
      references: [
        { title: "Amazon EKSとは", url: "https://docs.aws.amazon.com/ja_jp/eks/latest/userguide/what-is-eks.html", note: "EKS公式ユーザーガイド" },
        { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" },
        { title: "SaaSレンズ（AWS Well-Architected）", url: "https://docs.aws.amazon.com/ja_jp/wellarchitected/latest/saas-lens/saas-lens.html", note: "SaaS設計の公式ベストプラクティス集" }
      ]
    }
  ],
  cost: "<p>プール型（推奨）は<strong>月3万円〜10万円程度</strong>でテナント数が増えてもほぼ一定。サイロ型は<strong>1テナントあたり月2万円〜5万円程度が数に比例して増加</strong>し、10社なら月20万〜50万円。EKS基盤は<strong>月10万円〜30万円程度</strong>に加えて専任運用の人件費がかかる。SaaSでは「インフラ費がテナント単価に収まるか」という事業計算がそのままアーキテクチャ選定になる。</p>",
  summary: "<p>マルチテナントSaaSの本質は「<strong>分離をどのレイヤーで保証するか</strong>」の選択です。プール型はアプリのコード（テナントID絞り込み）で、サイロ型はAWSアカウント境界で、EKSはnamespaceで分離を実現し、右に行くほど安全・柔軟になる代わりにコストと運用負荷が増えます。まずはプール型で始めて、規制業種の大口顧客にはサイロ型を併設する「ハイブリッド」に育てていくのが実際のSaaS企業でよく見る進化パターンです。認証トークンにテナントIDを埋め込み、改ざんできない場所を分離の起点にするという設計は全方式に共通する核心なので、必ず押さえておきましょう。</p>",
  quiz: [
    {
      q: "プール型でテナントIDをリクエストパラメータから受け取ってはいけないのはなぜでしょうか。",
      a: "リクエストの中身は利用者側で自由に書き換えられるため、他社のテナントIDを指定するだけで他社データが読めてしまいます。Cognitoが署名したトークンから取り出せば、改ざんされても署名検証で弾かれるため、分離の起点を利用者が触れない場所に置けます。プール型の安全性はこの一点にかかっていると言ってよいほど重要な原則です。"
    },
    {
      q: "プール型とサイロ型は「分離をどのレイヤーで保証するか」が違います。それぞれ何が分離を守っているのでしょうか。",
      a: "プール型はアプリのコード、つまりテナントIDで必ず絞り込むという実装の規律が分離を守っています。サイロ型はAWSアカウントという境界そのものが守るため、アプリにバグがあっても他社データには到達できません。安全性が上がる代わりにテナント数に比例して費用と運用負荷が増えるので、顧客の要求水準と単価で選ぶことになります。"
    },
    {
      q: "金融業界の大口顧客から「他社と同じ基盤では契約できない」と言われました。プール型で運用中のあなたなら、どう対応しますか。",
      a: "全社をサイロ型へ作り直すのではなく、その顧客だけ専用アカウントへ切り出すハイブリッド構成にするのが現実的です。要求が物理的な分離なのか、データが混ざらない保証なのかを先に確認し、後者ならアプリは共用のままDBインスタンスやスキーマだけ分けるブリッジ型で説明責任を果たせる場合もあります。実際のSaaS企業も、この形で段階的に対応範囲を広げていくことが多いです。"
    }
  ]
});
