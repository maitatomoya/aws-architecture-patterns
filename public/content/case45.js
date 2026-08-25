// ケース45：コンテナ基盤の選定（ECS/EKS/App Runner）
registerCase({
  id: 45,
  category: "運用・セキュリティ・信頼性",
  title: "コンテナ基盤の選定（ECS/EKS/App Runner）",
  scenario: "<p>Dockerで開発しているWebアプリを本番運用するにあたり、コンテナの実行基盤を選びたい。AWSにはECS・EKS・App Runnerと複数の選択肢があり、チームでどれを採用すべきか判断がつかない。現在のチームはエンジニア4人でKubernetesの経験者はいない。まずは1つのWebサービスを安定運用したいが、将来のサービス拡大にも備えたい。インフラ専任者はおらず、アプリ開発と兼任で運用する。</p>",
  requirements: [
    "Dockerイメージをそのまま本番で動かしたい",
    "アクセス増に応じてコンテナ数を自動で増減させたい",
    "サーバー（ホストOS）のパッチ当てや管理はやりたくない",
    "ログ・メトリクスを確認できる運用の土台がほしい",
    "チームのスキル（Kubernetes未経験・専任インフラ不在）に合った基盤を選びたい"
  ],
  main: {
    name: "ECS on Fargate + ECR + ALB（AWS標準のコンテナ基盤）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
        { type: "vpc", label: "VPC", from: [2, 0], to: [4, 0], depth: 1 },
        { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
        { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
        { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 0 },
        { id: "ecs", icon: "services/ecs", label: "ECS on Fargate\nアプリコンテナ", col: 4, row: 0 },
        { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 1, row: 1 },
        { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nログ・メトリクス", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "igw", label: "HTTPS" },
        { from: "igw", to: "alb", label: "転送" },
        { from: "alb", to: "ecs", label: "振り分け" },
        { from: "ecs", to: "ecr", label: "イメージpull" },
        { from: "ecs", to: "cw", label: "ログ・メトリクス" }
      ]
    },
    flow: [
      "ユーザーのリクエストはインターネットゲートウェイを通ってパブリックサブネットのALB（ロードバランサー）に届く",
      "ALBがプライベートサブネットで動くECSタスク（コンテナの実行単位）へリクエストを振り分ける",
      "ECSタスクはFargate（サーバー管理不要のコンテナ実行エンジン）上で動き、起動時にECRからイメージを取得する",
      "アクセス増でCPU使用率が上がるとECSのオートスケーリングがタスク数を自動で増やし、ALBが新タスクにも振り分ける",
      "ログとメトリクスはCloudWatchに集約され、異常時のアラームもここから設定できる"
    ],
    services: [
      { icon: "services/ecs", name: "Amazon ECS", role: "コンテナのオーケストレーター（配置・数の維持・入れ替えの管理役）。AWSサービスとの統合が深く学習コストが低い" },
      { icon: "services/fargate", name: "AWS Fargate", role: "コンテナの実行エンジン。EC2ホストの管理・パッチ当てが不要になり、タスク単位の従量課金になる" },
      { icon: "services/ecr", name: "Amazon ECR", role: "Dockerイメージのレジストリ。バージョン管理と脆弱性スキャンを提供する" },
      { icon: "services/elb", name: "Application Load Balancer", role: "リクエストを複数タスクへ分散。ヘルスチェックで異常タスクを自動で切り離す" },
      { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "コンテナのログ・メトリクスの集約先。Container Insightsでタスク単位の状況も見える" }
    ],
    points: [
      "「ECSかEKSか」の前に「ホストを管理するか」を決めるのが選定の順序。Fargateを選べばOSパッチ・ホスト監視が丸ごと消え、専任インフラ不在のチームでも運用が回る",
      "タスクはプライベートサブネットに置き、入口をALBに一本化する。ECRからのイメージ取得はVPCエンドポイント経由にするとNATゲートウェイ費用を抑えられる",
      "オートスケーリングはCPU使用率などのターゲット追跡（目標値を決めるだけの方式）から始めると設定が簡単で暴発しにくい",
      "ECSはAWS独自のしくみなので他クラウドへの可搬性はないが、その分ALB・IAM・CloudWatchとの統合が滑らかで「つなぎ込みのコード」をほぼ書かなくてよい"
    ],
    pros: [
      "Kubernetes未経験でも習得しやすく、AWS内の情報・事例が豊富",
      "Fargateによりホスト管理が不要で、少人数でも運用が成立する",
      "ALB・IAM・CloudWatchなどAWSサービスとの統合が最初から揃っている",
      "コントロールプレーン（管理部分）の追加料金がない"
    ],
    cons: [
      "AWS固有のしくみのため、他クラウドやオンプレへの可搬性はない",
      "FargateはEC2起動タイプよりvCPU単価が割高（管理コスト削減とのトレードオフ）",
      "Kubernetesエコシステムの豊富なツール群（Helm等）は使えない"
    ],
    cost: "<strong>月8,000円〜2万円程度</strong>（0.25vCPU/0.5GBのタスク2個常時起動+ALBの場合）。Fargateは東京リージョンで1vCPUあたり月約37USD+メモリ課金で、小型タスク2個で約23USD、ALBが約20USD〜。タスク数を増やせば比例して増える。夜間にdev環境のタスク数を0にする等の節約が効きやすい。",
    references: [
      { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
      { title: "AWS Fargate", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html", note: "サーバーレスなコンテナ実行の公式解説" },
      { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
      { title: "Container Insights", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/ContainerInsights.html", note: "コンテナ監視のしくみ" },
      { title: "ECRのVPCエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/vpc-endpoints.html" }
    ]
  },
  alternatives: [
    {
      name: "EKS（Kubernetes基盤）",
      when: "Kubernetes経験者がいる・複数チームで多数のサービスを運用する・他環境との可搬性が必要な場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [4, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "alb", icon: "services/elb", label: "ALB\n(Ingress連携)", col: 3, row: 0 },
          { id: "worker", icon: "services/ec2", label: "ワーカーノード\nPod実行", col: 4, row: 0 },
          { id: "eks", icon: "services/eks", label: "EKS\nコントロールプレーン", col: 5, row: 0 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 1, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "alb", label: "転送" },
          { from: "alb", to: "worker", label: "Podへ振り分け" },
          { from: "eks", to: "worker", label: "ノード管理" },
          { from: "worker", to: "ecr", label: "イメージpull" }
        ]
      },
      flow: [
        "EKSがKubernetesのコントロールプレーン（クラスター全体の頭脳）をマネージドで提供し、ユーザーはマニフェスト（YAMLの構成定義）でアプリを宣言する",
        "アプリのPod（Kubernetesのコンテナ実行単位）はVPC内のワーカーノード（EC2またはFargate）上で動く",
        "外部公開はIngressの定義からAWS Load Balancer ControllerがALBを自動作成して行う",
        "ノードもPodも負荷に応じて自動スケールし、イメージはECRから取得する"
      ],
      services: [
        { icon: "services/eks", name: "Amazon EKS", role: "Kubernetesコントロールプレーンのマネージドサービス。バージョンアップやHA構成をAWSが面倒を見る" },
        { icon: "services/ec2", name: "Amazon EC2（ワーカーノード）", role: "Podが実際に動く計算資源。マネージドノードグループやFargateも選べる" },
        { icon: "services/elb", name: "Application Load Balancer", role: "Ingress定義から自動作成される外部公開の入口" },
        { icon: "services/ecr", name: "Amazon ECR", role: "イメージレジストリ。EKSからの利用はECSと同様" }
      ],
      points: [
        "EKSの価値は「Kubernetesという業界標準API」にある。Helmチャートなどの膨大なエコシステム資産と、他クラウド・オンプレでも通用する運用知識が手に入る",
        "引き換えにクラスターのバージョンアップ（年数回）、アドオン管理、マニフェスト管理などECSにはない継続的な運用作業が発生する。専任がいないチームには重い",
        "「将来のためにEKS」は少人数チームの典型的な過剰投資。1〜数個のサービスならECSで十分で、チームとサービス数が育ってから移行しても遅くない",
        "コントロールプレーンだけで月約73USDかかるため、小規模ではコスト面でも不利になる"
      ],
      pros: [
        "業界標準のKubernetes APIで、他クラウド・オンプレへの可搬性がある",
        "Helm・ArgoCDなど巨大なエコシステムのツール資産を活用できる",
        "多数のサービス・チームを1クラスターに集約する大規模運用に強い"
      ],
      cons: [
        "学習コストが高く、Kubernetes経験者がいないチームには負担が大きい",
        "クラスターのバージョンアップ対応など継続的な運用作業が必須",
        "コントロールプレーン料金（月約73USD）が固定でかかり、小規模では割高"
      ],
      cost: "<strong>月2万円〜5万円程度〜</strong>（最小構成）。コントロールプレーンが月約73USD、ワーカーノード（t3.medium×2で約60USD）とALB費用が加わる。同じ規模のアプリならECS Fargateより固定費が高くつく。",
      references: [
        { title: "Amazon EKSとは", url: "https://docs.aws.amazon.com/ja_jp/eks/latest/userguide/what-is-eks.html" },
        { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" },
        { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" }
      ]
    },
    {
      name: "App Runner（最小運用のフルマネージド）",
      when: "小規模なWebサービスを最小の手間で公開したい・VPCやALBの設計すら省きたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "ar", icon: "services/app-runner", label: "App Runner\nアプリ実行", col: 2, row: 0 },
          { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nログ・メトリクス", col: 4, row: 0 },
          { id: "dev", icon: "resources/client", label: "開発者", col: 0, row: 1 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "ar", label: "HTTPS" },
          { from: "dev", to: "ecr", label: "イメージpush" },
          { from: "ecr", to: "ar", label: "自動デプロイ" },
          { from: "ar", to: "cw", label: "ログ・メトリクス" }
        ]
      },
      flow: [
        "開発者がECRへイメージをpushすると、App Runnerが検知して自動でデプロイする",
        "ユーザーはApp Runnerが発行するHTTPSのURL（独自ドメインも設定可）へ直接アクセスする。ALB・VPC・証明書の設定は不要",
        "リクエスト量に応じてインスタンス数が自動増減し、アイドル時はCPU課金が抑えられる",
        "ログ・メトリクスは自動でCloudWatchに送られる"
      ],
      services: [
        { icon: "services/app-runner", name: "AWS App Runner", role: "ロードバランサー・スケーリング・HTTPS・デプロイまでを一体で提供するフルマネージドのコンテナ実行サービス" },
        { icon: "services/ecr", name: "Amazon ECR", role: "デプロイ元のイメージレジストリ。pushをトリガーに自動デプロイできる" },
        { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "ログ・メトリクスの自動集約先" }
      ],
      points: [
        "この図にVPCやALBが登場しないのは省略ではなく、App Runnerがそれらを内部で肩代わりしているから。ネットワーク設計を学ぶ前でも安全に公開できるのが最大の価値",
        "アイドル時はCPU課金が止まりメモリ分だけになるため、アクセスの少ないサービスならECS常時起動より安くなることが多い",
        "WebSocketの長時間接続や常駐バッチ、細かいネットワーク制御が必要になったらECSへの移行を検討する。イメージはそのまま使えるので移行は比較的軽い",
        "RDSなどVPC内のリソースへはVPCコネクタ機能で接続できるため、「DBがあるからApp Runnerは無理」とは限らない"
      ],
      pros: [
        "VPC・ALB・スケーリングの設計が不要で、公開までの手数が最小",
        "アイドル時のコストが抑えられ、小規模サービスに向く",
        "HTTPSと自動デプロイが標準装備"
      ],
      cons: [
        "インフラの細かい制御（ネットワーク設計・サイドカー構成等）はできない",
        "大規模・高トラフィックではECS/EKSより割高かつ制約が出やすい",
        "対応リージョンやリソース上限に制約があり、要件次第で使えない場合がある"
      ],
      cost: "<strong>月2,000円〜1万円程度</strong>（1vCPU/2GB、低トラフィックの場合）。アクティブ時は1vCPUあたり約0.064USD/時+メモリ課金、アイドル時はメモリ分のみ。ALB固定費（月約20USD〜）が不要な分、小規模ではECS構成より安くなりやすい。",
      references: [
        { title: "AWS App Runnerとは", url: "https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/what-is-apprunner.html" },
        { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" },
        { title: "Amazon CloudWatchとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html" }
      ]
    }
  ],
  cost: "<p>小規模構成の目安は、App Runnerが<strong>月2,000円〜1万円</strong>、ECS on Fargate+ALBが<strong>月8,000円〜2万円</strong>、EKSが<strong>月2万円〜5万円〜</strong>（コントロールプレーン月約73USDの固定費込み）。規模が小さいほどApp Runnerの手軽さと安さが効き、規模とチームが大きくなるほどECS/EKSの制御力が費用差を上回る価値を持つ。</p>",
  summary: "<p>コンテナ基盤選定は技術の優劣ではなく<strong>「チームの運用能力とサービスの規模に合わせる」</strong>問題です。迷ったらECS on Fargateが中庸の第一候補。1個の小規模サービスならApp Runnerで運用ゼロに寄せ、Kubernetes経験者と多数のサービスを抱えるならEKSでエコシステムを取り込みます。どの案でもイメージはECRに置くため、基盤の乗り換え自体は可能です。「小さく始めて、必要になったら制御力の高い基盤へ移る」が定石と覚えておきましょう。</p>"
});
