// ケース7：スタートアップのMVP Webアプリ
registerCase({
  id: 7,
  category: "Webアプリ・EC",
  title: "スタートアップのMVP Webアプリ",
  scenario: "<p>創業間もないスタートアップが、アイデア検証用のMVP（Minimum Viable Product：必要最小限の機能だけを持つ試作サービス）となるWebアプリを公開したい。エンジニアは2名で、インフラ専任はいない。ユーザー数は当面少ないが、投資家向けデモやSNS紹介で急に増える可能性もある。とにかく「早く出して、早く直す」ことが最優先で、サーバー運用に時間を取られたくない。</p>",
  requirements: [
    "最短でリリースし、その後も1日に何度もデプロイしたい",
    "インフラ専任がいなくても運用できること（サーバー管理は極力なし）",
    "ユーザーが増えたら自動でスケールしてほしい",
    "会員情報などを扱うためリレーショナルDBが必要",
    "月額コストは小さく始めたい（ただし成長時の移行コストも考慮）"
  ],
  main: {
    name: "App Runner + Aurora Serverless v2（コンテナをそのまま動かす）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
        { type: "vpc", label: "VPC", from: [4, 0], to: [4, 1], depth: 1 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
      ],
      nodes: [
        { id: "dev", icon: "resources/client", label: "開発者", col: 0, row: 0 },
        { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 1 },
        { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 2, row: 0 },
        { id: "apprunner", icon: "services/app-runner", label: "App Runner\nアプリ実行", col: 2, row: 1 },
        { id: "aurora", icon: "services/aurora", label: "Aurora\nServerless v2", col: 4, row: 1 }
      ],
      edges: [
        { from: "dev", to: "ecr", label: "イメージpush" },
        { from: "ecr", to: "apprunner", label: "自動デプロイ" },
        { from: "users", to: "apprunner", label: "HTTPS" },
        { from: "apprunner", to: "aurora", label: "VPCコネクタ" }
      ]
    },
    flow: [
      "開発者はアプリのコンテナイメージ（アプリと実行環境を1つに固めたパッケージ）をECRにpushする",
      "App RunnerがECRの更新を検知し、新バージョンを自動でビルド・デプロイする",
      "ユーザーはApp Runnerが用意する公開URLにHTTPSでアクセスする。証明書・ロードバランサー・自動スケールはすべてApp Runnerに内蔵されている",
      "App RunnerはVPCコネクタという接続口を通じて、VPC内のプライベートサブネットにあるAuroraへ安全に接続する"
    ],
    services: [
      { icon: "services/app-runner", name: "AWS App Runner", role: "コンテナを渡すだけでWebアプリを公開できるフルマネージドサービス。HTTPS・スケーリング・ヘルスチェックまで内蔵" },
      { icon: "services/ecr", name: "Amazon ECR", role: "コンテナイメージ置き場（レジストリ）。pushをきっかけにApp Runnerの自動デプロイが動く" },
      { icon: "services/aurora", name: "Amazon Aurora Serverless v2", role: "MySQL/PostgreSQL互換のマネージドDB。負荷に応じて容量が自動で増減し、小規模時は小さく支払える" }
    ],
    points: [
      "MVPフェーズは「インフラの選択肢を学ぶ時間」より「機能を作る時間」が価値になる。ロードバランサーやAuto Scalingの設計を丸ごとApp Runnerに任せるのはそのための割り切り",
      "図にインターネットゲートウェイ（IGW）が無いのは省略ではない。ユーザーからの入口はAWSが運用するApp Runnerの公開エンドポイントで、自分のVPCをインターネットに公開していないため。VPCはDBを隠すためだけに使い、App RunnerからはVPCコネクタで内側に入る",
      "DBをAurora Serverless v2にすると、アイドル時は最小容量（0.5 ACU）まで下がりコストを抑えつつ、デモでアクセスが跳ねても自動で追従する",
      "アプリを最初からコンテナ（Dockerfile）で作っておくと、成長後にECSやEKSへ移行するときもイメージを作り直さずに済む。MVPの技術選定で将来の移行コストを下げる工夫"
    ],
    pros: [
      "コンテナイメージを用意するだけで公開でき、リリースまでが最短",
      "HTTPS・スケーリング・デプロイの仕組みを自作しなくてよい（インフラ専任不要）",
      "リクエストが少ない時間帯はコンテナ数とDB容量が自動で縮み、費用を抑えられる",
      "コンテナベースなので、将来ECS/EKSへ比較的スムーズに移行できる"
    ],
    cons: [
      "EC2やECSに比べて細かいネットワーク・OS設定はできない（ブラックボックス寄り）",
      "WebSocketの長時間接続や重いバックグラウンド処理など、リクエスト応答型以外の処理は苦手",
      "常時一定以上のアクセスがある規模になると、ECS等の自前構成より割高になることがある"
    ],
    cost: "<strong>月5,000円〜1.5万円程度</strong>（App Runner最小構成1vCPU/2GBを1インスタンス＋Aurora Serverless v2最小0.5ACU、東京リージョン・低トラフィックの場合）。App Runnerはアイドル時にCPU課金が下がる仕組みがあり、完全放置ならさらに下がる。",
    references: [
      { title: "AWS App Runnerとは", url: "https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/what-is-apprunner.html", note: "App Runner公式デベロッパーガイド" },
      { title: "App RunnerからVPC内リソースへ接続する（VPCコネクタ）", url: "https://docs.aws.amazon.com/ja_jp/apprunner/latest/dg/network-vpc.html", note: "図の「VPCコネクタ」の公式解説" },
      { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" },
      { title: "Aurora Serverless v2の使用", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html", note: "容量が自動増減するDBの仕組み" }
    ]
  },
  alternatives: [
    {
      name: "Elastic Beanstalk + RDS（コンテナなしで定番構成を自動構築）",
      when: "チームがまだコンテナに慣れていない・ZIPを渡すだけでEC2ベースの定番構成を組んでほしい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 1], to: [5, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 1], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [5, 1], to: [5, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 1 },
          { id: "eb", icon: "services/elastic-beanstalk", label: "Elastic\nBeanstalk", col: 2, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
          { id: "ec2", icon: "services/ec2", label: "EC2\nアプリ本体", col: 3, row: 1 },
          { id: "rds", icon: "services/rds", label: "RDS\nMySQL", col: 5, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "ec2" },
          { from: "ec2", to: "rds", label: "SQL" },
          { from: "eb", to: "ec2", label: "自動構築", dashed: true }
        ]
      },
      flow: [
        "開発者はアプリのZIP（またはコンテナ）をElastic Beanstalkにアップロードするだけでよい",
        "BeanstalkがVPC・EC2・セキュリティグループなどの定番構成を自動で構築・更新する（点線は「管理している」ことを表す）",
        "ユーザーのリクエストはVPCの入口であるインターネットゲートウェイを通り、パブリックサブネットのEC2に届く",
        "EC2はプライベートサブネットのRDSにSQLで接続する。DBを外から届かない場所に置くのはどの構成でも共通の定石"
      ],
      services: [
        { icon: "services/elastic-beanstalk", name: "AWS Elastic Beanstalk", role: "アプリを渡すとEC2ベースの環境一式を自動構築・管理するオーケストレーションサービス。追加料金なし（使ったEC2等の料金のみ）" },
        { icon: "services/ec2", name: "Amazon EC2", role: "アプリが実際に動く仮想サーバー。Beanstalk経由でもOSにSSHで入って調査できる" },
        { icon: "services/rds", name: "Amazon RDS（MySQL）", role: "会員情報などを保存するマネージドリレーショナルDB" }
      ],
      points: [
        "小規模のうちは単一インスタンス環境（ロードバランサーなし）で始められ、後から設定変更だけでALB＋Auto Scaling付きの冗長構成に切り替えられる",
        "RDSはBeanstalk環境に含めず別管理にする。環境ごと作り直すときにDBまで消えてしまう事故を防ぐ、公式も推奨する分離",
        "App Runnerと違いEC2が見える構成なので、SSHでの調査や細かいOSチューニングができる。その代わりOSパッチの責任は自分側に残る"
      ],
      pros: [
        "コンテナ知識がなくても、ZIPアップロードで定番のEC2構成が手に入る",
        "Beanstalk自体は無料で、裏側の構成（EC2・ALB等）が見えるためAWSの学習にもなる",
        "後からロードバランサー付き構成やAuto Scalingへ設定で拡張できる"
      ],
      cons: [
        "EC2が常時起動するため、アクセスゼロでも固定費がかかる",
        "デプロイや環境更新がApp Runnerより遅く、細かい挙動の理解に学習コストがある",
        "OS・ミドルウェアのアップデート運用（プラットフォーム更新の適用判断）が残る"
      ],
      cost: "<strong>月4,000円〜1万円程度</strong>（t3.small相当のEC2を1台＋RDS最小構成、東京リージョン）。Beanstalk自体は無料だが、EC2とRDSの常時起動ぶんが固定費になる。",
      references: [
        { title: "AWS Elastic Beanstalkとは", url: "https://docs.aws.amazon.com/ja_jp/elasticbeanstalk/latest/dg/Welcome.html", note: "Beanstalk公式デベロッパーガイド" },
        { title: "Elastic BeanstalkとAmazon RDSの併用", url: "https://docs.aws.amazon.com/ja_jp/elasticbeanstalk/latest/dg/using-features.managing.db.html", note: "DBを環境と分離すべき理由の公式解説" },
        { title: "インターネットゲートウェイを使用してインターネットに接続する", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/VPC_Internet_Gateway.html" }
      ]
    },
    {
      name: "EC2一台構成（アプリもDBも同居）",
      when: "とにかく今日動かしたい・費用を最小の固定額に抑えたい場合（ただしリスクを理解した上で）",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "ec2", icon: "services/ec2", label: "EC2\nアプリ+DB同居", col: 3, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\nバックアップ", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "ec2" },
          { from: "ec2", to: "s3", label: "バックアップ", dashed: true }
        ]
      },
      flow: [
        "ユーザーのリクエストはインターネットゲートウェイを通ってパブリックサブネットのEC2に直接届く",
        "EC2の中でWebサーバー・アプリ・DB（MySQL等）をすべて動かす。個人開発でよく見る、いわゆる一台全部載せ構成",
        "DBのダンプファイルなどはVPCの外にあるS3へ定期的に退避する。最低限これだけはやらないと、サーバー障害＝全データ消失になる"
      ],
      services: [
        { icon: "services/ec2", name: "Amazon EC2", role: "Web・アプリ・DBをすべて載せる仮想サーバー。構成の理解は一番簡単だが、責任もすべてこの1台に集中する" },
        { icon: "services/s3", name: "Amazon S3", role: "DBダンプや設定のバックアップ先。EC2が壊れても復元できる最後の命綱" }
      ],
      points: [
        "この構成の最大のリスクは「1台が単一障害点（そこが壊れると全部止まる箇所）になる」こと。EC2の障害・操作ミス・ディスク故障のどれでもサービス全体が停止する",
        "DB同居のままユーザーが増えると、アプリとDBがCPU・メモリを奪い合い、切り分けも難しくなる。分離の第一歩はDBだけRDSに逃がすこと",
        "OSパッチ・ミドルウェア更新・監視・バックアップがすべて手作業になる。「安く見えて、実は人件費を払っている」構成だと認識しておく",
        "それでも「最小の固定費で今日出せる」価値は本物。バックアップのS3退避と、RDS分離への移行計画をセットにするなら、検証用途としては合理的な選択"
      ],
      pros: [
        "構成が最も単純で、動かすまでが速い（学習にも向く）",
        "費用が固定で読みやすく、最小クラスなら月数千円で収まる",
        "OSに自由に入れるので、どんなミドルウェアでも動かせる"
      ],
      cons: [
        "1台が単一障害点。障害・メンテのたびにサービス全体が止まる",
        "スケールアップ（サーバー強化）しか成長手段がなく、その際も停止が必要",
        "パッチ・監視・バックアップが全部手動で、実は運用の人件費が一番かかる",
        "本番の個人情報を載せるなら、この構成のままではセキュリティの説明責任を果たしにくい"
      ],
      cost: "<strong>月2,000円〜5,000円程度</strong>（t3.small相当のEC2を1台＋S3少量、東京リージョン）。金額は最安だが、障害対応や手動運用の時間コストが乗ることを忘れずに。",
      references: [
        { title: "Amazon EC2とは", url: "https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/concepts.html", note: "EC2公式ユーザーガイド" },
        { title: "EC2のバックアップと復元", url: "https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/ec2-backup-and-recovery.html", note: "一台構成で最優先すべきバックアップの公式解説" },
        { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html", note: "次の一歩＝DB分離の移行先" }
      ]
    }
  ],
  cost: "<p>推奨構成（App Runner+Aurora Serverless v2）は<strong>月5,000円〜1.5万円程度</strong>で、アイドル時に自動で縮む従量寄りの課金。Beanstalk+RDS案は<strong>月4,000円〜1万円程度</strong>、EC2一台構成は<strong>月2,000円〜5,000円程度</strong>と金額だけなら最安だが、どちらも常時起動の固定費で、さらにEC2一台構成は運用の手間（時間コスト）と障害リスクを自分で背負う。「見えている月額」と「運用の人件費・止まったときの損失」を合算して比べるのがポイント。</p>",
  summary: "<p>MVPフェーズの正解は「一番安い構成」ではなく<strong>「機能開発に一番時間を使える構成」</strong>です。App Runnerはインフラ設計を丸ごと肩代わりし、コンテナで作っておけば成長後のECS移行にもつながります。一方でEC2一台構成は今も現場でよく見ますが、単一障害点・手動運用・DB同居という3つのリスクを理解した上で「検証用」と割り切れる場合に限り選択肢になります。チームのスキル（コンテナ経験の有無）で推奨とBeanstalkが分かれる、という判断軸も覚えておきましょう。</p>"
});
