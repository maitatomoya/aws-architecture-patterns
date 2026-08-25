// ケース2：ブログ・オウンドメディア（WordPress運用）
registerCase({
  id: 2,
  category: "Webサイト・配信",
  title: "ブログ・オウンドメディア（WordPress運用）",
  scenario: "<p>企業のオウンドメディア（自社ブログ）を運営したい。記事の入稿は編集部の非エンジニアが週に数本、WordPressの管理画面から行う。月間数万〜数十万PVで、SNSでバズると一時的にアクセスが数倍になる。画像を多用した記事が中心。インフラ担当のエンジニアは1〜2人で、他業務と兼任している。</p>",
  requirements: [
    "非エンジニアの編集部がWordPressの管理画面から入稿・更新できること",
    "月間数十万PV規模のアクセスと一時的なバズに耐えたい",
    "画像が多いため、ストレージと配信を効率化したい",
    "サーバー障害時に復旧しやすい構成にしたい",
    "月額コストは1万円台までに収めたい"
  ],
  main: {
    name: "EC2 + RDS + CloudFront + S3（王道のWordPress構成）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] },
        { type: "vpc", label: "VPC", from: [2, 0], to: [5, 0], depth: 1 },
        { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [5, 0], to: [5, 0], depth: 2 }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
        { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 0 },
        { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
        { id: "ec2", icon: "services/ec2", label: "EC2\nWordPress", col: 3, row: 0 },
        { id: "rds", icon: "services/rds", label: "RDS\nMySQL", col: 5, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n画像・メディア", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "cf", label: "HTTPS" },
        { from: "cf", to: "igw" },
        { from: "igw", to: "ec2" },
        { from: "ec2", to: "rds", label: "SQL" },
        { from: "ec2", to: "s3", label: "画像保存" },
        { from: "cf", to: "s3", label: "画像の取得" }
      ]
    },
    flow: [
      "ユーザーのリクエストはCloudFrontを経由し、VPCの入口であるインターネットゲートウェイを通ってパブリックサブネットのEC2（WordPress）に届く",
      "EC2はプライベートサブネットのRDS（MySQL）に接続し、記事データを読み書きする",
      "編集部がアップロードした画像はVPCの外にあるS3へ保存する（S3はサブネットの中には置けないマネージドサービス）",
      "CloudFrontはHTMLをEC2から、画像をS3から取得してキャッシュ配信する。2回目以降の多くのアクセスはキャッシュが返すため、EC2の負荷が大きく減る"
    ],
    services: [
      { icon: "services/ec2", name: "Amazon EC2", role: "WordPress本体（PHP+Webサーバー）が動く仮想サーバー。OSから自分で管理する" },
      { icon: "services/rds", name: "Amazon RDS（MySQL）", role: "記事・設定を保存するマネージドDB。自動バックアップ・パッチ適用はAWSが面倒を見る" },
      { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。ページと画像をキャッシュしてEC2を守り、表示を高速化する。バズ対策の要" },
      { icon: "services/s3", name: "Amazon S3", role: "アップロード画像の保存先。EC2のディスクと分離することでサーバーを使い捨てにできる" }
    ],
    points: [
      "RDSはプライベートサブネットに置き、セキュリティグループ（インスタンス単位のファイアウォール）でEC2からの3306番ポートのみ許可する",
      "画像はプラグイン（WP Offload Media等）でS3へ逃がす。EC2に状態を残さないことで「壊れたら作り直す」運用ができる",
      "メディアは読み取りが大半なのでCloudFrontのキャッシュが効きやすい。ただし管理画面（/wp-admin）とログイン中のユーザーはキャッシュをバイパスする設定が必須",
      "EC2のAMIバックアップとRDSの自動バックアップを設定し、障害時は「新しいEC2を立てて復元」できる手順を用意しておく"
    ],
    pros: [
      "編集部は使い慣れたWordPress管理画面をそのまま使える",
      "CloudFrontのキャッシュでEC2が小さいインスタンスでも数十万PVを捌ける",
      "画像をS3に分離しているため、ディスク容量の心配とEC2障害時のデータ消失リスクが減る",
      "WordPressの豊富なテーマ・プラグイン資産が使える"
    ],
    cons: [
      "EC2とRDSは常時起動のため、アクセスが少なくても固定費がかかる",
      "OS・WordPress本体・プラグインの脆弱性対応（アップデート運用）が継続的に必要",
      "EC2が1台構成のため、インスタンス障害中は復旧作業のあいだ管理画面が使えない"
    ],
    cost: "<strong>月5,000円〜1.5万円程度</strong>（t3.small相当のEC2＋db.t3.micro〜small相当のRDS＋S3保存料＋CloudFront転送量の前提）。キャッシュが効くほどCloudFrontの転送費は抑えられるが、EC2とRDSの常時起動ぶんは固定でかかる。",
    references: [
      { title: "Best Practices for WordPress on AWS", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/best-practices-wordpress/welcome.html", note: "AWS公式ホワイトペーパー。この構成の発展形まで解説" },
      { title: "インターネットゲートウェイを使用してインターネットに接続する", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/VPC_Internet_Gateway.html", note: "VPCの入口の公式解説" },
      { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html" },
      { title: "Amazon CloudFrontとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "WordPressの静的書き出し + S3 + CloudFront",
      when: "公開側に動的機能（コメント・検索・会員機能）がなく、セキュリティ運用の手間と月額費用を極小化したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "onpremise", label: "社内環境", from: [0, 0], to: [0, 0] },
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "wp", icon: "resources/client", label: "WordPress\n（社内運用）", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n静的HTML", col: 3, row: 0 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 2, row: 1 },
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 1 }
        ],
        edges: [
          { from: "wp", to: "s3", label: "静的書き出し" },
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "cf", to: "s3", label: "オリジン取得" }
        ]
      },
      flow: [
        "WordPress本体は社内PCやローカルのDocker等、インターネットに公開しない場所で動かす",
        "記事を更新したら、静的書き出しツール（WP2Static等のプラグイン）でサイト全体をHTMLファイルに変換してS3へアップロードする",
        "ユーザーにはCloudFrontがS3のHTMLをキャッシュ配信する。公開側にWordPressは存在しないため、攻撃対象が事実上なくなる"
      ],
      services: [
        { icon: "services/s3", name: "Amazon S3", role: "書き出した静的HTMLと画像の置き場。サーバー不要で公開できる" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。世界中のエッジでキャッシュ配信し、バズにも自動で耐える" }
      ],
      points: [
        "WordPressの管理画面を公開しないため、WordPressを狙う攻撃（脆弱なプラグインへの攻撃や不正ログイン）から構造的に守られる",
        "公開側はケース1と同じ静的ホスティングなので、アイドル時のコストがほぼゼロになる",
        "書き出し後にCloudFrontのキャッシュ削除（Invalidation）を打つ手順まで自動化しておくと、編集部が「更新が反映されない」と混乱しない",
        "コメント欄や検索が必要になったら、外部SaaSか小さなAPI（別ケースで学ぶサーバーレス構成）を後付けする"
      ],
      pros: [
        "公開サーバーがないため、セキュリティ運用の負担が激減する",
        "月額コストがほぼゼロ（S3+CloudFrontの従量課金のみ）",
        "静的配信なので表示が速く、アクセス集中にも強い"
      ],
      cons: [
        "更新のたびに書き出し作業が必要で、記事公開までに一手間かかる",
        "コメント・検索・会員機能などの動的機能はそのままでは使えない",
        "書き出しツールの相性問題（テーマやプラグインによっては正しく変換されない）の検証が必要"
      ],
      cost: "<strong>月数十円〜数百円</strong>（S3保存料＋CloudFront転送量のみ。WordPress本体は社内PC等で動かす前提）。公開側の固定費がなくなるのが最大の違い。",
      references: [
        { title: "Amazon S3を使用して静的ウェブサイトをホスティングする", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/WebsiteHosting.html" },
        { title: "Amazon CloudFrontによるウェブサイトの高速化", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/website-hosting-cloudfront-walkthrough.html", note: "S3+CloudFront配信の公式チュートリアル" },
        { title: "ファイルを無効化してキャッシュを削除する（Invalidation）", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html", note: "書き出し後の反映に必須の操作" }
      ]
    },
    {
      name: "ECS on Fargate + EFS（コンテナ化WordPress）",
      when: "複数台で冗長化したい・OS管理をやめたい・チームにコンテナ運用の経験がある場合",
      diagram: {
        cols: 7, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [6, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [5, 0], to: [6, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "alb", icon: "services/elb", label: "ALB\n負荷分散", col: 3, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 3, row: 1 },
          { id: "fargate", icon: "services/fargate", label: "ECS on Fargate\nWordPress", col: 5, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nMySQL", col: 6, row: 0 },
          { id: "efs", icon: "services/efs", label: "EFS\n共有ファイル", col: 5, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "alb" },
          { from: "alb", to: "fargate", label: "転送" },
          { from: "fargate", to: "rds", label: "SQL" },
          { from: "fargate", to: "efs", label: "wp-content共有" },
          { from: "fargate", to: "nat", label: "外向き通信", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "リクエストはインターネットゲートウェイからパブリックサブネットのALB（ロードバランサー）に入り、プライベートサブネットのWordPressコンテナ（ECS on Fargate）へ振り分けられる",
        "コンテナはRDSに記事データを、EFS（複数コンテナから同時マウントできる共有ファイルシステム）にテーマ・プラグイン・画像を保存する",
        "コンテナは使い捨てだが、状態はRDSとEFSに残るため、何台に増やしても同じサイトを表示できる",
        "プライベートサブネットからのイメージ取得やアップデート等の外向き通信は、パブリックサブネットのNATゲートウェイを経由する"
      ],
      services: [
        { icon: "services/fargate", name: "AWS Fargate（ECS）", role: "サーバーレスなコンテナ実行環境。EC2と違いOSの管理が不要で、台数の増減も容易" },
        { icon: "services/elb", name: "Application Load Balancer", role: "複数コンテナへのリクエスト振り分けとヘルスチェックを担う" },
        { icon: "services/efs", name: "Amazon EFS", role: "複数コンテナから同時にマウントできるNFS共有ストレージ。wp-contentの置き場" },
        { icon: "services/rds", name: "Amazon RDS（MySQL）", role: "記事データを保存するマネージドDB" }
      ],
      points: [
        "WordPressはファイルに状態を持つ（テーマ・プラグイン・アップロード）ため、コンテナ化にはEFSのような共有ストレージが必須になる。ここがステートレスなアプリとの大きな違い",
        "コンテナを2台以上にすればローリング更新（1台ずつ入れ替え）ができ、EC2の1台構成と違って無停止でアップデートできる",
        "NATゲートウェイは時間課金で意外と高い（月約45USD、約6,800円）。コスト重視ならS3用のゲートウェイ型VPCエンドポイント併用などの工夫を検討する",
        "前段にCloudFrontを足す構成は推奨構成と同じ考え方で追加できる（図では省略）"
      ],
      pros: [
        "OSのパッチ当てが不要になり、セキュリティ運用がWordPress本体とプラグインに絞れる",
        "コンテナの複数台構成で冗長化・無停止デプロイができる",
        "アクセス増に応じたスケールアウト（台数追加）が設定だけでできる"
      ],
      cons: [
        "ALB・NATゲートウェイ・EFSと登場人物が増え、月額固定費はEC2の1台構成より高くなりがち",
        "コンテナイメージの管理やタスク定義など、コンテナ運用の学習コストがかかる",
        "小規模なブログにはオーバースペックになりやすい"
      ],
      cost: "<strong>月1.5万円〜3万円程度</strong>（Fargate 0.25vCPU×2タスク＋ALB＋NATゲートウェイ＋RDS＋EFSの前提）。ALBとNATゲートウェイの固定費が乗るため、冗長化の対価として推奨構成より高くなる。",
      references: [
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
        { title: "AWS Fargateの概要", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/AWS_Fargate.html" },
        { title: "ECSでAmazon EFSボリュームを使用する", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/efs-volumes.html", note: "コンテナからEFSをマウントする公式手順" },
        { title: "Amazon EFSとは", url: "https://docs.aws.amazon.com/ja_jp/efs/latest/ug/whatisefs.html" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（EC2+RDS+CloudFront+S3）は<strong>月5,000円〜1.5万円程度</strong>。静的書き出し案は<strong>月数十円〜数百円</strong>で公開側の固定費が消えるが、動的機能を捨てる割り切りが必要。Fargate+EFS案は<strong>月1.5万円〜3万円程度</strong>で、冗長化とOS管理からの解放をお金で買う構成。どこまでを「人手の運用」でカバーし、どこからを「月額費用」で解決するかの判断になる。</p>",
  summary: "<p>WordPressのようなCMSは「管理画面で誰でも更新できる」ことが価値なので、まずはEC2+RDSの王道構成に<strong>CloudFrontとS3を足してサーバーを守る</strong>のが定石です。重要なのは、状態（DBはRDS、画像はS3、共有ファイルはEFS）をサーバー本体から引き剥がすという考え方で、これができているとEC2からコンテナへの移行も、静的書き出しへの転換もスムーズになります。公開側に動的機能が不要と割り切れるなら、静的書き出しでセキュリティ運用ごと消してしまう選択も実務では有力です。</p>"
});
