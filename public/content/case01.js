// ケース1：コーポレートサイト・LP（静的サイト）
registerCase({
  id: 1,
  category: "Webサイト・配信",
  title: "コーポレートサイト・LP（静的サイト）",
  scenario: "<p>中小企業のコーポレートサイトや、キャンペーン用のランディングページを公開したい。ページ内容は問い合わせフォームを除けばすべて静的で、更新は月に数回。アクセスは通常時は少ないが、テレビやSNSで紹介された瞬間だけ跳ね上がる可能性がある。担当エンジニアは1人（他業務と兼任）。</p>",
  requirements: [
    "静的コンテンツ（HTML/CSS/JS/画像）が中心",
    "急なアクセス集中に耐えたい（バズ耐性）",
    "月額コストはできるだけ小さく（アイドル時はほぼゼロが理想）",
    "サーバーの保守・パッチ当てはやりたくない",
    "独自ドメイン＋HTTPSは必須"
  ],
  main: {
    name: "S3 + CloudFront 静的ホスティング",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 1 },
        { id: "r53", icon: "services/route53", label: "Route 53\nDNS", col: 1, row: 0 },
        { id: "acm", icon: "services/acm", label: "ACM\nSSL証明書", col: 2, row: 0 },
        { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 2, row: 1 },
        { id: "s3", icon: "services/s3", label: "S3\n静的ファイル", col: 3, row: 1 },
        { id: "waf", icon: "services/waf", label: "AWS WAF\n(任意)", col: 3, row: 0 }
      ],
      edges: [
        { from: "users", to: "r53", label: "名前解決", dashed: true },
        { from: "users", to: "cf", label: "HTTPS" },
        { from: "cf", to: "s3", label: "オリジン取得" },
        { from: "acm", to: "cf", noArrow: true, dashed: true },
        { from: "waf", to: "cf", noArrow: true, dashed: true }
      ]
    },
    flow: [
      "ユーザーがドメインにアクセスすると、Route 53が名前解決してCloudFrontに誘導する",
      "CloudFrontは世界中のエッジ拠点でコンテンツをキャッシュ配信する（2回目以降はS3まで行かない）",
      "キャッシュにない場合だけ、オリジンであるS3からファイルを取得する",
      "HTTPS証明書はACMが無料で発行し、CloudFrontに紐づける"
    ],
    services: [
      { icon: "services/s3", name: "Amazon S3", role: "HTML・画像などのファイル置き場。サーバー不要で耐久性99.999999999%のストレージ" },
      { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。世界中のエッジでキャッシュ配信し、表示を高速化しつつS3への負荷とコストを減らす" },
      { icon: "services/route53", name: "Amazon Route 53", role: "DNS。独自ドメインをCloudFrontに向ける" },
      { icon: "services/acm", name: "AWS Certificate Manager", role: "SSL/TLS証明書を無料で発行・自動更新。HTTPS化の手間をゼロにする" },
      { icon: "services/waf", name: "AWS WAF（任意）", role: "不正なリクエストのブロック。問い合わせフォーム等を守りたい場合に追加" }
    ],
    points: [
      "S3は「公開バケット」にせず、CloudFront経由のみ許可（OAC：Origin Access Control）にする。直アクセスを塞ぐのが現在の定石",
      "キャッシュのTTLを長めに設定し、更新時はデプロイでキャッシュ削除（Invalidation）を打つ運用にすると配信コストが最小になる",
      "バズってもCloudFrontとS3が自動で受け止めるため、事前のキャパシティ設計が不要",
      "この図にインターネットゲートウェイやNATが無いのは省略ではない。Route 53・CloudFront・S3はVPCの外にあるAWSマネージドサービスで、ユーザーはAWSが運用する公開エンドポイントに直接アクセスする。ゲートウェイ類はVPCを使う構成（代替パターン参照）で初めて登場する"
    ],
    pros: [
      "サーバー管理ゼロ（OSパッチ・スケーリングの心配がない）",
      "アイドル時のコストがほぼゼロ（従量課金のみ。月数十円〜数百円規模）",
      "急なアクセス集中に自動で耐える",
      "構成が単純で、1人でも運用できる"
    ],
    cons: [
      "サーバー側の動的処理はできない（問い合わせフォームは別途APIが必要）",
      "キャッシュ削除の運用を知らないと「更新が反映されない」と混乱しがち",
      "CloudFront＋S3＋Route 53と登場人物が多く、初回設定はそれなりに手数がある"
    ],
    cost: "<strong>月数十円〜数百円</strong>。S3の保存料＋CloudFrontの転送量のみの従量課金で、CloudFrontは無料枠（転送1TB/月）が大きいため小規模サイトなら無料枠内に収まることも多い。",
    references: [
      { title: "Amazon S3を使用して静的ウェブサイトをホスティングする", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/WebsiteHosting.html", note: "S3公式ユーザーガイド" },
      { title: "Amazon CloudFrontによるウェブサイトの高速化", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/website-hosting-cloudfront-walkthrough.html", note: "S3+CloudFront配信のこの構成そのものの公式チュートリアル" },
      { title: "S3オリジンへのアクセスを制限する（OAC）", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html", note: "「工夫点」で触れた直アクセス対策" },
      { title: "AWS Certificate Managerとは", url: "https://docs.aws.amazon.com/ja_jp/acm/latest/userguide/acm-overview.html" },
      { title: "Route 53でCloudFrontディストリビューションにルーティングする", url: "https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html" }
    ]
  },
  alternatives: [
    {
      name: "Amplify Hosting（Git連携で全部おまかせ）",
      when: "設定の手数を最小にしたい・Gitにpushしたら自動デプロイまでしてほしい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "dev", icon: "resources/client", label: "開発者\nGit push", col: 0, row: 0 },
          { id: "amplify", icon: "services/amplify", label: "Amplify\nHosting", col: 2, row: 0 },
          { id: "users", icon: "resources/users", label: "ユーザー", col: 0, row: 1 },
          { id: "cf2", icon: "services/cloudfront", label: "CDN配信\n(内蔵)", col: 3, row: 1 }
        ],
        edges: [
          { from: "dev", to: "amplify", label: "自動ビルド" },
          { from: "users", to: "cf2", label: "HTTPS" },
          { from: "amplify", to: "cf2", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "開発者がGitリポジトリにpushすると、Amplifyが検知して自動でビルド・デプロイする",
        "ユーザーはAmplifyに内蔵されたCDN（CloudFront）経由でHTTPS配信を受ける",
        "S3・CloudFront・証明書の設定はAmplifyが内部でまとめて面倒を見る"
      ],
      services: [
        { icon: "services/amplify", name: "AWS Amplify Hosting", role: "Git連携の静的ホスティング。ビルド・CDN・HTTPS・プレビュー環境までを一体で提供" },
        { icon: "services/cloudfront", name: "Amazon CloudFront（内蔵）", role: "Amplifyが内部で使うCDN。自分で設定する必要はない" }
      ],
      points: [
        "ブランチごとにプレビューURLが自動発行されるので、公開前レビューの仕組みを自作しなくてよい",
        "ビルド設定はリポジトリ直下のamplify.ymlで管理でき、インフラ知識が浅いメンバーでも運用に参加しやすい",
        "凝ったキャッシュ制御やLambda@Edgeが必要になったら、推奨構成（S3+CloudFrontの手組み）への移行を検討する"
      ],
      pros: [
        "GitHub連携でpush→ビルド→デプロイまで全自動。CDN・HTTPSも内蔵",
        "プレビュー環境（ブランチごとのURL）が自動でできる"
      ],
      cons: [
        "S3+CloudFrontよりカスタマイズの自由度が低い",
        "内部の挙動がブラックボックス寄りで、細かいキャッシュ制御はしにくい"
      ],
      cost: "<strong>月0円〜数百円</strong>。ビルド時間（無料枠1,000分/月）＋配信量（無料枠15GB/月）の従量課金。小規模サイトならほぼ無料枠内。",
      references: [
        { title: "AWS Amplify Hostingとは", url: "https://docs.aws.amazon.com/ja_jp/amplify/latest/userguide/welcome.html", note: "Amplify公式ユーザーガイド" }
      ]
    },
    {
      name: "EC2 + WordPress（動的CMSが必要なとき）",
      when: "非エンジニアが管理画面から頻繁に更新したい・既存のWordPress資産がある場合",
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
          { id: "cf", icon: "services/cloudfront", label: "CloudFront", col: 1, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "ec2", icon: "services/ec2", label: "EC2\nWordPress", col: 3, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nMySQL", col: 5, row: 0 },
          { id: "s3m", icon: "services/s3", label: "S3\n画像等", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "cf", to: "igw" },
          { from: "igw", to: "ec2" },
          { from: "ec2", to: "rds", label: "SQL" },
          { from: "ec2", to: "s3m", label: "メディア保存" }
        ]
      },
      flow: [
        "ユーザーのリクエストはCloudFrontを経由し、VPCの玄関であるインターネットゲートウェイ（IGW）を通ってパブリックサブネットのEC2に届く",
        "EC2はプライベートサブネットのRDSにSQLで接続する。RDSは外から直接届かない場所に置くのが定石",
        "アップロード画像はVPCの外にあるS3へ保存する（S3はサブネットの中には置けない）"
      ],
      services: [
        { icon: "services/ec2", name: "Amazon EC2", role: "WordPress本体（PHP+Webサーバー）が動く仮想サーバー。OSから自分で管理する" },
        { icon: "services/rds", name: "Amazon RDS（MySQL）", role: "記事・設定を保存するマネージドDB。バックアップ・パッチはAWSが面倒を見る" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "画像などをキャッシュ配信してEC2の負荷を下げる" },
        { icon: "services/s3", name: "Amazon S3", role: "アップロード画像の保存先。EC2のディスクに置かないことでサーバーを使い捨てにできる" }
      ],
      points: [
        "メディアファイルはプラグインでS3へ逃がす。EC2を「いつ作り直してもよい状態」に保つのがクラウド流",
        "RDSはプライベートサブネットに置き、セキュリティグループでEC2からの3306番ポートのみ許可する",
        "小規模ならEC2は1台構成で始め、成長したらALB+Auto Scaling化（別ケースで学ぶ）を検討する"
      ],
      cost: "<strong>月3,000円〜1万円程度</strong>（t3.small相当のEC2＋最小構成のRDS）。アクセスがなくても常時起動ぶんの固定費がかかるのが推奨構成との最大の違い。",
      pros: [
        "管理画面から誰でも更新できる（CMSの本領）",
        "WordPressの豊富なテーマ・プラグイン資産が使える"
      ],
      cons: [
        "EC2とRDSは常時起動＝アイドル時も月数千円〜の固定費がかかる",
        "OS・WordPress本体・プラグインのアップデート運用が必要（セキュリティ責任が重い）",
        "アクセス集中には自力でスケーリング設計が必要"
      ],
      references: [
        { title: "Best Practices for WordPress on AWS", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/best-practices-wordpress/welcome.html", note: "AWS公式ホワイトペーパー" },
        { title: "インターネットゲートウェイを使用してインターネットに接続する", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/VPC_Internet_Gateway.html", note: "VPC公式ユーザーガイド" },
        { title: "Amazon RDSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/Welcome.html" }
      ]
    }
  ],
  cost: "<p>推奨構成の場合：<strong>月数十円〜数百円</strong>が目安（S3保存料＋CloudFront転送量。小規模サイトなら無料枠内に収まることも多い）。EC2+WordPress案は<strong>月3,000円〜1万円程度</strong>（t3.small相当＋RDS最小構成）からで、アイドル時も課金され続ける点が大きな違い。</p>",
  summary: "<p>「静的サイトはS3+CloudFront」はAWSの最頻出パターンです。<strong>サーバーを持たない構成はコスト・運用・耐障害性の全部で有利</strong>で、動的処理が必要になったらケース14で学ぶAPI構成を後付けすれば拡張できます。逆に「更新担当が非エンジニア」という人の要件が入った瞬間にCMS（WordPress）案が浮上する、という判断の分かれ方も覚えておきましょう。</p>",
  quiz: [
    {
      q: "推奨構成（S3+CloudFront）の図には、インターネットゲートウェイもNATゲートウェイも描かれていません。これはなぜでしょうか。",
      a: "S3・CloudFront・Route 53はVPCの外にあるAWSマネージドサービスで、利用者はAWSが運用する公開エンドポイントへ直接アクセスするためです。インターネットゲートウェイは自分で作ったVPCの出入口なので、VPCを使わないこの構成には登場しません。省略しているのではなく、存在しないのが正しい描写です。"
    },
    {
      q: "このサイトに「ログインした会員だけが見られるページ」を追加したいと言われました。あなたなら構成をどう変えますか。",
      a: "静的配信のままでは会員かどうかを判定できないため、認証と動的処理を足す必要があります。ログインはCognitoに任せ、会員限定データはケース14で学ぶAPI Gateway+Lambdaの小さなAPIから返す形にすれば、公開部分はS3+CloudFrontのまま拡張できます。サイト全体をWordPressのような動的CMSへ作り替えるのは、更新担当が非エンジニアといった別の理由がない限り過剰です。"
    },
    {
      q: "「更新担当は非エンジニアの広報担当者」という要件が加わった瞬間に、EC2+WordPress案が浮上します。推奨構成では何が困るのでしょうか。",
      a: "S3+CloudFrontの更新はファイルをアップロードしてキャッシュ削除を打つ作業で、GitやAWSコンソールの操作が前提になります。管理画面から誰でも書き換えられることがCMSの価値なので、更新頻度と担当者のスキルが要件に入ると、固定費と運用負荷を払ってでもWordPress案が合理的になります。技術の優劣ではなく誰が運用するかで正解が変わる、典型的な分かれ目です。"
    }
  ]
});
