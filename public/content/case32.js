// ケース32：閉域の社内業務システム
registerCase({
  id: 32,
  category: "社内・閉域・ハイブリッド",
  title: "閉域の社内業務システム",
  scenario: "<p>人事・経理・勤怠管理など、社員だけが使う業務システムをAWS上に構築したい。会社のセキュリティポリシーで「業務システムはインターネットに公開しないこと」と定められており、社内ネットワークからのみアクセスできる必要がある。老朽化したサーバールームは縮小したいので、サーバー本体はAWSへ移したい。利用者は全国の拠点にいる社員約500名。</p>",
  requirements: [
    "インターネットには一切公開しない（社内ネットワークからのみアクセス）",
    "全国の拠点から社内ネットワーク経由で利用できる",
    "サーバーの調達・保守をなくし、運用負担を減らしたい",
    "監査に対して「外部から到達できない」ことを構成で説明できる",
    "データベースのバックアップ・パッチ適用は自動化したい"
  ],
  main: {
    name: "Site-to-Site VPN+内部ALB+ECS+RDS（閉域構成）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "onpremise", label: "社内拠点", from: [0, 0], to: [0, 1] },
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 0] },
        { type: "vpc", label: "VPC", from: [2, 0], to: [5, 0], depth: 1 },
        { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [4, 0], depth: 2 },
        { type: "private-subnet", label: "プライベートサブネット", from: [5, 0], to: [5, 0], depth: 2 }
      ],
      nodes: [
        { id: "office", icon: "resources/office", label: "本社オフィス", col: 0, row: 0 },
        { id: "users", icon: "resources/users", label: "社員PC", col: 0, row: 1 },
        { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site\nVPN", col: 2, row: 0 },
        { id: "alb", icon: "services/elb", label: "内部ALB", col: 3, row: 0 },
        { id: "ecs", icon: "services/ecs", label: "ECS\n業務アプリ", col: 4, row: 0 },
        { id: "rds", icon: "services/rds", label: "RDS\n業務DB", col: 5, row: 0 }
      ],
      edges: [
        { from: "users", to: "office", noArrow: true, dashed: true },
        { from: "office", to: "vpn", label: "IPsec VPN", dashed: true },
        { from: "vpn", to: "alb", label: "社内通信のみ" },
        { from: "alb", to: "ecs", label: "HTTP" },
        { from: "ecs", to: "rds", label: "SQL" }
      ]
    },
    flow: [
      "社員PCからのリクエストは社内ネットワークを通り、オンプレのルーターとAWSの間に張ったSite-to-Site VPN（IPsecで暗号化した仮想的な専用トンネル）を通ってVPCに入る",
      "VPC内では内部ALB（インターネットに公開しないロードバランサー）がリクエストを受け、ECS上の業務アプリコンテナに振り分ける",
      "ECSのアプリはプライベートサブネットのRDSにSQLで接続し、業務データを読み書きする",
      "この図にインターネットゲートウェイ（IGW）が無い点が重要。IGWの無いVPCにはインターネットからの経路がそもそも存在せず、「非公開」が構造で保証される"
    ],
    services: [
      { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "社内ネットワークとVPCをIPsecで暗号化して常時接続する。1接続につきトンネルが2本用意され、片方の障害に備えられる" },
      { icon: "services/elb", name: "ALB（内部）", role: "internalスキームで作成するロードバランサー。プライベートIPしか持たず、社内からの通信だけをECSに分散する" },
      { icon: "services/ecs", name: "Amazon ECS", role: "業務アプリのコンテナ実行基盤。Fargate起動にすればサーバーのOS管理をAWSに任せられる" },
      { icon: "services/rds", name: "Amazon RDS", role: "業務データを保存するマネージドDB。バックアップ・パッチ適用を自動化できる" }
    ],
    points: [
      "IGWを描いていないのは省略ではなく、これが閉域構成の正解。VPCにIGWをアタッチしない限りインターネットとの経路は作れないため、「公開しない」を運用ルールではなく構造そのもので保証でき、監査にも説明しやすい",
      "ALBは作成時にinternet-facingではなくinternalスキームを選ぶ。パブリックIPを持たないため、経路的にも社内からしか届かない",
      "コンテナイメージ取得やログ送信などAWSサービスへの通信は、NATゲートウェイではなくVPCエンドポイント（AWSサービスへ閉域のままつなぐ入口）を使えばインターネットに出ずに完結する",
      "VPNのトンネル2本は両方経路設定して片系障害に備える。閉域構成では「AWS側が無事でも社内側の障害で使えなくなる」ことも想定し、拠点側ルーター（カスタマーゲートウェイ）の障害対応手順を決めておく",
      "社内PCから内部ALBを独自ドメイン名（例：kintai.example.internal）で呼ぶには名前解決の設計が別途必要。Route 53のプライベートホストゾーンにALBのレコードを作り、Route 53 Resolverインバウンドエンドポイント（社内DNSからのDNS問い合わせをVPC内で受ける口）を用意して、社内DNSサーバーから該当ドメインをそこへフォワードする設定を入れる"
    ],
    pros: [
      "インターネット非公開を構成レベルで保証でき、セキュリティ説明が容易",
      "Site-to-Site VPNは物理工事が不要で、設定だけで数時間〜数日で開通できる",
      "ECS（Fargate）とRDSでOS管理・DB運用の負担が小さい"
    ],
    cons: [
      "VPNはインターネット回線上のトンネルなので、帯域や遅延は保証されない（1トンネルあたり最大約1.25Gbps）",
      "拠点側ルーターの設定・運用スキルが必要",
      "社内ネットワークやVPNが落ちると、クラウド側が正常でも業務が止まる"
    ],
    cost: "<strong>月1.5万円〜3万円程度</strong>（Site-to-Site VPN約5,500円+内部ALB約3,500円+Fargate2タスク約3,000円+RDSシングルAZ小型約4,000円〜。データ転送量とVPCエンドポイント利用分は別途）",
    references: [
      { title: "AWS Site-to-Site VPNとは", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/VPC_VPN.html", note: "VPN公式ユーザーガイド" },
      { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" },
      { title: "Elastic Load Balancingの仕組み", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html", note: "インターネット向け/内部向けスキームの違い" },
      { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
      { title: "AWS VPNの料金", url: "https://aws.amazon.com/jp/vpn/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "Direct Connect接続（本格運用・安定帯域）",
      when: "利用者・拠点が多く、帯域と遅延を安定させたい本格運用の場合",
      diagram: {
        cols: 6, rows: 1,
        groups: [
          { type: "onpremise", label: "社内拠点", from: [0, 0], to: [0, 0] },
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 0] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [5, 0], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [4, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [5, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "resources/office", label: "本社オフィス", col: 0, row: 0 },
          { id: "dx", icon: "services/direct-connect", label: "Direct\nConnect", col: 1, row: 0 },
          { id: "alb", icon: "services/elb", label: "内部ALB", col: 3, row: 0 },
          { id: "ecs", icon: "services/ecs", label: "ECS\n業務アプリ", col: 4, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\n業務DB", col: 5, row: 0 }
        ],
        edges: [
          { from: "office", to: "dx", label: "専用線", dashed: true },
          { from: "dx", to: "alb", label: "閉域通信" },
          { from: "alb", to: "ecs", label: "HTTP" },
          { from: "ecs", to: "rds", label: "SQL" }
        ]
      },
      flow: [
        "オンプレ拠点とAWSを物理専用線のDirect Connectで接続する。インターネットを一切経由しない",
        "以降の流れは推奨構成と同じで、内部ALB→ECS→RDSと閉域のまま処理される",
        "IGWが無い点も推奨構成と同じ。閉域性はそのままに、回線品質だけが強化される"
      ],
      services: [
        { icon: "services/direct-connect", name: "AWS Direct Connect", role: "拠点とAWSを結ぶ物理専用線。帯域が保証され、遅延も安定する" },
        { icon: "services/elb", name: "ALB（内部）", role: "社内からの通信をECSに分散する。推奨構成と同じ役割" },
        { icon: "services/ecs", name: "Amazon ECS", role: "業務アプリのコンテナ実行基盤" },
        { icon: "services/rds", name: "Amazon RDS", role: "業務データを保存するマネージドDB" }
      ],
      points: [
        "VPNとの違いは「インターネットを通るか通らないか」。Direct Connectは物理線なので帯域保証・低遅延だが、開通までに物理工事を含め数週間〜数か月かかる",
        "1本のDirect Connectは物理障害で全断する。本番ではDX2本、またはDX+VPNバックアップの冗長構成（ケース33参照）が定石",
        "全国の多拠点から使う場合は、通信事業者の閉域網サービスに各拠点を収容してDirect Connectへ乗り入れる形が一般的"
      ],
      pros: [
        "帯域保証・低遅延で、利用者が多くても操作感が安定する",
        "閉域性が物理レベルで担保され、監査説明がさらに容易"
      ],
      cons: [
        "回線費用が高く、開通までのリードタイムが長い",
        "1本だけでは物理障害が単一障害点になる"
      ],
      cost: "<strong>月5万円〜数十万円程度</strong>。AWS側ポート料金は1Gbps専有で月約3.3万円（ホスト型50Mbpsなら月数千円〜）、これに通信事業者の専用線費用が月数万円〜加わる。アプリ部分の費用は推奨構成と同様",
      references: [
        { title: "AWS Direct Connectとは", url: "https://docs.aws.amazon.com/ja_jp/directconnect/latest/UserGuide/Welcome.html", note: "Direct Connect公式ユーザーガイド" },
        { title: "AWS Direct Connect Resiliency Toolkit", url: "https://docs.aws.amazon.com/ja_jp/directconnect/latest/UserGuide/resiliency_toolkit.html", note: "回線冗長化の公式推奨パターン" },
        { title: "AWS Direct Connectの料金", url: "https://aws.amazon.com/jp/directconnect/pricing/" }
      ]
    },
    {
      name: "公開ALB+WAF+IP制限（簡易案）",
      when: "要件が「関係者以外に見せない」程度で閉域までは求められていない場合や、在宅勤務など社外からも使いたい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [2, 1], to: [5, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 1], to: [3, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [5, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "社員\n（社外含む）", col: 0, row: 1 },
          { id: "waf", icon: "services/waf", label: "AWS WAF\nIP制限", col: 3, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
          { id: "alb", icon: "services/elb", label: "ALB（公開）", col: 3, row: 1 },
          { id: "ecs", icon: "services/ecs", label: "ECS\n業務アプリ", col: 4, row: 1 },
          { id: "rds", icon: "services/rds", label: "RDS\n業務DB", col: 5, row: 1 }
        ],
        edges: [
          { from: "users", to: "igw", label: "HTTPS" },
          { from: "igw", to: "alb" },
          { from: "waf", to: "alb", noArrow: true, dashed: true },
          { from: "alb", to: "ecs", label: "HTTP" },
          { from: "ecs", to: "rds", label: "SQL" }
        ]
      },
      flow: [
        "ALBをパブリックサブネットに置き、インターネットゲートウェイ経由で公開する。公開構成なのでIGWが必須になる（閉域構成との最大の違い）",
        "ALBに関連付けたAWS WAFのIPセットで、会社の固定IPアドレスからのアクセスだけを許可し、それ以外を遮断する",
        "許可されたリクエストだけがECSに届き、プライベートサブネットのRDSを読み書きする"
      ],
      services: [
        { icon: "services/waf", name: "AWS WAF", role: "IPセット（許可IPアドレスの一覧）でALBへのアクセス元を制限する。攻撃対策のマネージドルールも併用できる" },
        { icon: "services/elb", name: "ALB（公開）", role: "internet-facingスキームのロードバランサー。インターネットからのHTTPSを受ける" },
        { icon: "services/ecs", name: "Amazon ECS", role: "業務アプリのコンテナ実行基盤" },
        { icon: "services/rds", name: "Amazon RDS", role: "業務データを保存するマネージドDB" }
      ],
      points: [
        "これは閉域ではなく「公開した上で入口を絞る」構成。経路としてはインターネットに面しているため、IP制限の設定ミスがそのまま公開事故になる。閉域を明記した監査要件には通らないことがある",
        "IP制限だけに頼らず、アプリ側の認証（Cognito等のログイン）を必ず併用する。IPは偽装や共有回線の相乗りがあり得る",
        "在宅勤務者は会社VPN経由で固定IPから出てもらうか、許可IPを追加して対応する。許可IPの棚卸し運用を決めておく"
      ],
      pros: [
        "VPN機器や専用線が不要で、最も速く安く構築できる",
        "社外（自宅・出張先）からも使える柔軟性がある"
      ],
      cons: [
        "閉域ではないため、設定ミスが即公開事故につながるリスクを抱える",
        "固定IPを持たない拠点や在宅勤務者への対応が煩雑になりがち"
      ],
      cost: "<strong>月1.3万円〜2.5万円程度</strong>（公開ALB約3,500円+WAF約1,500円+Fargate2タスク約3,000円+RDS約4,000円〜。VPNや専用線の費用が不要になる）",
      references: [
        { title: "AWS WAFとは", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/what-is-aws-waf.html", note: "WAF公式デベロッパーガイド" },
        { title: "IPセットの管理", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/waf-ip-set-managing.html", note: "IP制限の設定方法" },
        { title: "インターネットゲートウェイを使用してインターネットに接続する", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/VPC_Internet_Gateway.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（VPN閉域）は<strong>月1.5万円〜3万円程度</strong>。Direct Connect案は回線費用が支配的で<strong>月5万円〜数十万円</strong>と一桁上がる。公開ALB+WAF案は<strong>月1.3万円〜2.5万円程度</strong>と最も安いが、そもそも閉域要件を満たさない別物である点に注意。</p>",
  summary: "<p>閉域構成の本質は<strong>「IGWを作らないことで、インターネットへの経路を構造的に存在させない」</strong>ことです。図にIGWが無いのは描き忘れではなく正解で、公開構成との見分けポイントになります。回線はVPNでスモールスタートし、利用者が増えて帯域が苦しくなったらDirect Connectへ増強するのが定番の成長パスです。逆に「閉域」が本当に要件なのかは早めに確認しましょう。単なるアクセス制限で良いなら公開+WAF+認証のほうが安く柔軟ですが、両者はセキュリティの保証レベルがまったく異なります。</p>",
  quiz: [
    {
      q: "推奨構成の図にはインターネットゲートウェイが描かれていません。これはなぜでしょうか。",
      a: "インターネットゲートウェイをアタッチしない限り、VPCとインターネットの間には経路そのものが存在しないためです。これは描き忘れではなく、閉域構成の正しい描写です。ルールで塞いでいるのではなく構造として到達手段が無い状態なので、設定ミスによる公開事故が起こりようがなく、監査に対しても構成図だけで説明できます。"
    },
    {
      q: "コンテナイメージの取得やログ送信には外向きの通信が必要ですが、この構成ではNATゲートウェイを置きません。どう解決しているのでしょうか。",
      a: "宛先がAWSサービスであればVPCエンドポイントを使い、インターネットへ出ずにVPC内から到達できるからです。NATゲートウェイを置くとプライベートサブネットからインターネットへ抜ける経路ができ、せっかくの閉域性が崩れてしまいます。「外向き通信が必要イコールNATが必要」ではなく、宛先を確認してから判断する、と覚えておくとよいでしょう。"
    },
    {
      q: "要件を確認したところ、在宅勤務者からも使いたく、監査要件も「関係者以外に見せない」程度だと分かりました。あなたならどう作るでしょうか。",
      a: "代替2の公開ALBにWAFのIP制限とアプリ側の認証を組み合わせる構成が現実的です。VPN機器も専用線も不要で、社外からも使えます。ただしこれは閉域ではなく「公開した上で入口を絞る」構成であり、IP制限の設定ミスがそのまま公開事故になります。保証レベルがまったく違うので、要件が本当に閉域なのかを先に確認することが判断の起点になります。"
    }
  ]
});
