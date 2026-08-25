// ケース6：グローバル向けサイト・多地域配信
registerCase({
  id: 6,
  category: "Webサイト・配信",
  title: "グローバル向けサイト・多地域配信",
  scenario: "<p>日本発のサービスを海外展開することになり、北米・欧州・アジアのユーザーにも快適な速度でサイトを届けたい。コンテンツは製品情報やドキュメントが中心の静的サイトで、一部に動的なAPIもある。「海外からだと表示が遅い」という問い合わせが増えており、特定リージョンの障害時にも世界のユーザーへの提供を続けたい。</p>",
  requirements: [
    "北米・欧州・アジアのどこからでも表示速度を確保したい",
    "オリジン（配信元データ）を複数リージョンに持ち、リージョン障害に備えたい",
    "地域ごとにサーバー一式を運用する体制は組みたくない",
    "ドメインは1つのまま、ユーザーを自動的に最適な経路へ誘導したい",
    "まずは静的コンテンツの配信を最適化し、動的APIは段階的に対応したい"
  ],
  main: {
    name: "CloudFrontオリジングループ + S3クロスリージョンレプリケーション",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
        { type: "region", label: "東京リージョン", from: [3, 0], to: [4, 0], depth: 1 },
        { type: "region", label: "米国リージョン", from: [3, 1], to: [4, 1], depth: 1 }
      ],
      nodes: [
        { id: "usersjp", icon: "resources/users", label: "日本の\nユーザー", col: 0, row: 0 },
        { id: "usersgl", icon: "resources/users", label: "海外の\nユーザー", col: 0, row: 1 },
        { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 0 },
        { id: "r53", icon: "services/route53", label: "Route 53\nDNS", col: 1, row: 1 },
        { id: "s3jp", icon: "services/s3", label: "S3 東京\nプライマリ", col: 3, row: 0 },
        { id: "s3us", icon: "services/s3", label: "S3 米国\nセカンダリ", col: 3, row: 1 }
      ],
      edges: [
        { from: "usersjp", to: "cf", label: "HTTPS" },
        { from: "usersgl", to: "cf" },
        { from: "usersgl", to: "r53", label: "名前解決", dashed: true },
        { from: "r53", to: "cf", noArrow: true, dashed: true },
        { from: "cf", to: "s3jp", label: "プライマリから取得" },
        { from: "cf", to: "s3us", label: "障害時に自動切替", dashed: true },
        { from: "s3jp", to: "s3us", label: "レプリケーション" }
      ]
    },
    flow: [
      "世界中のユーザーは、Route 53の名前解決を経て最寄りのCloudFrontエッジ拠点に接続する。キャッシュにあるコンテンツはその場で返るため、大半のアクセスはこの時点で完結する",
      "キャッシュにない場合、CloudFrontはオリジングループのプライマリに設定した東京のS3へ取得しに行く",
      "東京のS3が接続失敗や特定のエラー（500番台等）を返すと、CloudFrontは同じリクエストをセカンダリの米国のS3へ自動で再送し、配信を継続する（オリジンフェイルオーバー）",
      "米国のS3の中身は、S3クロスリージョンレプリケーションで東京から自動複製しておく。運用者は東京にアップロードするだけでよい"
    ],
    services: [
      { icon: "services/cloudfront", name: "Amazon CloudFront", role: "世界600拠点超のエッジからキャッシュ配信するCDN。オリジングループでプライマリ障害時の自動切替も担う" },
      { icon: "services/route53", name: "Amazon Route 53", role: "DNS。独自ドメインをCloudFrontへ向ける" },
      { icon: "services/s3", name: "Amazon S3（2リージョン）", role: "静的コンテンツのオリジン。東京を正（プライマリ）とし、クロスリージョンレプリケーションで米国へ自動複製する" }
    ],
    points: [
      "グローバル高速化の主役はあくまでCloudFrontのエッジキャッシュ。この構成はさらに「リージョン障害への耐性」を、オリジングループ（プライマリのオリジンがエラーを返したらセカンダリへ自動で切り替えるCloudFrontの機能）で解決している",
      "S3のバケット名は全世界で一意という制約があるため、「同じオリジン名をDNSで東京と米国のS3に振り分ける」方式はS3では組めない。S3を複数リージョンに置く場合は、CloudFront側のオリジングループで切り替えるのが公式の定石",
      "レプリケーションは非同期のため、複製先への反映にタイムラグがある。更新直後に切り替わると新旧が混ざり得ることをコンテンツ運用側と合意しておく",
      "発展形として、複数リージョンのS3バケットを1つのグローバルなエンドポイントに束ねるS3 Multi-Region Access Pointsもある。平常時から近いリージョンへ自動ルーティングしたい要件まで進んだら検討する"
    ],
    pros: [
      "世界中のユーザーに対して、単一ドメインのまま低遅延な配信ができる",
      "東京リージョンの障害時はCloudFrontが自動でセカンダリへ切り替え、利用者の操作なしで配信を継続できる",
      "サーバーレス構成なので、地域ごとの運用チームや常時起動サーバーが不要",
      "運用者のアップロード先は東京だけでよく、複製は自動で行われる"
    ],
    cons: [
      "S3の保存費とリージョン間の複製転送費が二重にかかる",
      "非同期複製のタイムラグにより、切替直後は最新の更新が反映されていない可能性がある",
      "オリジンフェイルオーバーの対象はGET/HEADなど取得系のリクエストで、切替時は再試行のぶん応答が一時的に遅くなる",
      "CDN・複製・フェイルオーバーと登場する仕組みが多く、障害時の切り分けに各層の理解が必要"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（静的サイト規模の前提。S3保存が2リージョン分＋リージョン間複製の転送費＋CloudFront転送量＋Route 53のホストゾーン月0.5ドル。オリジングループ自体に追加料金はない）。単一リージョン構成との差分は主に「S3もう1面分の保存費＋複製転送費」で、更新頻度が低い静的サイトなら小さい。",
    references: [
      { title: "CloudFrontオリジンフェイルオーバーを使用して高可用性を最適化する", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html", note: "オリジングループの公式ガイド" },
      { title: "S3レプリケーション", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/replication.html", note: "クロスリージョンレプリケーションの公式ガイド" },
      { title: "マルチリージョンアクセスポイントを使用したマルチリージョントラフィックの管理", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/MultiRegionAccessPoints.html", note: "工夫点で触れた発展形の公式ガイド" },
      { title: "Route 53でCloudFrontディストリビューションにルーティングする", url: "https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html" }
    ]
  },
  alternatives: [
    {
      name: "Global Accelerator + ALB（動的API向けの多リージョン）",
      when: "キャッシュできない動的API・ログイン処理などを、世界中から低遅延かつ高可用に提供したい場合",
      diagram: {
        cols: 6, rows: 4,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 3] },
          { type: "region", label: "東京リージョン", from: [2, 0], to: [5, 1], depth: 1 },
          { type: "region", label: "米国リージョン", from: [2, 2], to: [5, 3], depth: 1 },
          { type: "vpc", label: "VPC", from: [3, 0], to: [5, 1], depth: 2 },
          { type: "vpc", label: "VPC", from: [3, 2], to: [5, 3], depth: 2 },
          { type: "public-subnet", label: "パブリックサブネット", from: [4, 0], to: [4, 1], depth: 3 },
          { type: "public-subnet", label: "パブリックサブネット", from: [4, 2], to: [4, 3], depth: 3 },
          { type: "private-subnet", label: "プライベートサブネット", from: [5, 0], to: [5, 1], depth: 3 },
          { type: "private-subnet", label: "プライベートサブネット", from: [5, 2], to: [5, 3], depth: 3 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "世界中の\nユーザー", col: 0, row: 1 },
          { id: "ga", icon: "services/global-accelerator", label: "Global\nAccelerator", col: 1, row: 1 },
          { id: "alb1", icon: "services/elb", label: "ALB", col: 4, row: 1 },
          { id: "ec21", icon: "services/ec2", label: "EC2\nAPI処理", col: 5, row: 1 },
          { id: "alb2", icon: "services/elb", label: "ALB", col: 4, row: 3 },
          { id: "ec22", icon: "services/ec2", label: "EC2\nAPI処理", col: 5, row: 3 }
        ],
        edges: [
          { from: "users", to: "ga", label: "固定IPに接続" },
          { from: "ga", to: "alb1", label: "最寄りリージョンへ" },
          { from: "ga", to: "alb2", label: "障害時は切替", dashed: true },
          { from: "alb1", to: "ec21", label: "振り分け" },
          { from: "alb2", to: "ec22", label: "振り分け" }
        ]
      },
      flow: [
        "ユーザーはGlobal Acceleratorが提供する世界共通の固定IP（エニーキャストIP）へ接続する。接続は世界各地のAWSエッジで受け付けられる",
        "エッジからは混雑するインターネットではなくAWS専用網を通り、最も近い（または重み付けした）リージョンのALBへ届く。TLSの往復が速くなり、動的APIの体感が改善する",
        "各リージョンではALB→EC2という通常のVPC構成でAPIを処理する。Global Acceleratorからの通信はAWS内部網からALBへ直接届く",
        "リージョン障害時はGlobal Acceleratorがヘルスチェックに基づき、数十秒オーダーでもう一方のリージョンへトラフィックを切り替える（DNSのキャッシュ切れを待つ必要がない）"
      ],
      services: [
        { icon: "services/global-accelerator", name: "AWS Global Accelerator", role: "固定エニーキャストIPでユーザーを受け、AWS専用網で最適なリージョンへ転送する。キャッシュはしない" },
        { icon: "services/elb", name: "Application Load Balancer", role: "各リージョン内でEC2群へ振り分けるロードバランサー。Global Acceleratorの転送先" },
        { icon: "services/ec2", name: "Amazon EC2", role: "動的APIを処理するサーバー。各リージョンに配置する" }
      ],
      points: [
        "CloudFrontとの使い分けが最重要。CloudFrontは「キャッシュできるコンテンツ」を速くする仕組み、Global Acceleratorは「キャッシュできない通信の経路」を速くする仕組みで、両者は併用もできる",
        "DNSベースの切替（Route 53フェイルオーバー）はクライアント側のDNSキャッシュに左右されるが、Global AcceleratorはIPが変わらないため切替が速く確実なのが強み",
        "マルチリージョンの本当の難所はDB（データをどちらのリージョンに置き、どう同期するか）。Aurora Global DatabaseやDynamoDBグローバルテーブルの検討が必要で、配信層より先にデータ設計を固める",
        "Global Accelerator経由の通信はAWS内部網からALBへ直接届き、インターネットゲートウェイ（IGW）を通らない。インターネット向けALBを置くためにVPCへIGWをアタッチしておくこと自体は必要だが、通信の経路上には現れないため図にも描いていない",
        "この図ではAPIサーバーの最小構成を示している。実際には各リージョンでAuto ScalingやNATゲートウェイを推奨構成どおりに整える"
      ],
      pros: [
        "キャッシュ不可の動的通信でも世界中から低遅延にできる",
        "固定IPのため、企業顧客のファイアウォール許可リスト運用がしやすい",
        "ヘルスチェック連動の高速なリージョン切替ができ、可用性が高い"
      ],
      cons: [
        "リージョンごとにサーバー一式（VPC・ALB・EC2・DB）を運用するため、コストと運用負荷がほぼ2倍になる",
        "データベースの多リージョン同期という難題が必ずついてくる",
        "Global Accelerator自体の固定費と転送プレミアムが上乗せされる"
      ],
      cost: "<strong>月3万円〜10万円以上</strong>（Global Acceleratorの固定費が月20ドル前後＋転送プレミアム、ALB×2で月40ドル前後、EC2×2リージョン、DB同期の転送費）。多リージョン化は「インフラ費2倍＋α」になるため、要件（可用性・遅延）がその費用に見合うかを最初に判断する。",
      references: [
        { title: "AWS Global Acceleratorとは", url: "https://docs.aws.amazon.com/ja_jp/global-accelerator/latest/dg/what-is-global-accelerator.html" },
        { title: "AWS Global Acceleratorでの安全なVPC接続", url: "https://docs.aws.amazon.com/ja_jp/global-accelerator/latest/dg/secure-vpc-connections.html", note: "GA経由の通信がIGWを通らないことの公式解説" },
        { title: "AWS Global Acceleratorのよくある質問", url: "https://aws.amazon.com/jp/global-accelerator/faqs/", note: "CloudFrontとの使い分けの公式見解" },
        { title: "Application Load Balancerとは", url: "https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/introduction.html" }
      ]
    },
    {
      name: "単一リージョン + CloudFront（まずはこれで足りるかを見極める）",
      when: "コンテンツの大半が静的またはキャッシュ可能で、リージョン障害への備えが必須要件ではない場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "region", label: "東京リージョン", from: [3, 0], to: [4, 0], depth: 1 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "世界中の\nユーザー", col: 0, row: 0 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 1, row: 0 },
          { id: "r53", icon: "services/route53", label: "Route 53\nDNS", col: 1, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nオリジン", col: 3, row: 0 }
        ],
        edges: [
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "users", to: "r53", label: "名前解決", dashed: true },
          { from: "r53", to: "cf", noArrow: true, dashed: true },
          { from: "cf", to: "s3", label: "オリジン取得" }
        ]
      },
      flow: [
        "世界中のユーザーは最寄りのCloudFrontエッジに接続し、キャッシュ済みコンテンツはそこから即座に返る",
        "キャッシュにない場合だけ東京のS3まで取得しに行くが、その結果は各地のエッジにキャッシュされるため、2回目以降は海外からも速い",
        "オリジンは東京の1リージョンだけなので、構成・運用はケース1の静的サイトとほぼ同じ"
      ],
      services: [
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "世界中のエッジでキャッシュ配信。海外ユーザーの表示速度問題の大半はこれで解決する" },
        { icon: "services/route53", name: "Amazon Route 53", role: "DNS。独自ドメインをCloudFrontへ向ける" },
        { icon: "services/s3", name: "Amazon S3", role: "静的コンテンツのオリジン。東京リージョンのみに配置" }
      ],
      points: [
        "「海外から遅い」の原因の多くはユーザーとサーバー間の距離なので、エッジ配信（CloudFront）だけで体感が劇的に変わる。多リージョン化の前に必ずこの案で足りるかを検証する",
        "キャッシュヒット率が高いほど海外もオリジン距離の影響を受けない。TTLを長めにし、更新時はInvalidationで消す運用にする",
        "残る弱点は2つ。キャッシュできない動的APIの遅延（エッジからオリジンへの往復が毎回発生）と、東京リージョン障害時に更新系が止まること。この2つが受容できるかが多リージョン化の判断基準",
        "将来多リージョン化する場合も、この構成に推奨構成（S3複製）や代替1（Global Accelerator）を積み増す形で移行できる"
      ],
      pros: [
        "構成が最小で、運用もコストも単一リージョンのまま",
        "静的コンテンツ中心なら、体感速度は多リージョン構成とほとんど変わらない",
        "多リージョン構成への段階的な移行の土台になる"
      ],
      cons: [
        "東京リージョン障害時は、キャッシュ切れのコンテンツ配信と更新作業が止まる",
        "キャッシュできない動的APIは、海外からはオリジンまでの往復分だけ毎回遅い",
        "リージョン障害への備えが必須の要件（SLA契約など）には応えられない"
      ],
      cost: "<strong>月数十円〜数千円程度</strong>（ケース1と同じくS3保存料＋CloudFront転送量のみ。転送量は世界向けでも日本向けと大きくは変わらない）。多リージョン化との差額は小さく見えるが、動的APIまで多リージョン化する場合との差は月数万円以上になる。",
      references: [
        { title: "AWSグローバルインフラストラクチャ", url: "https://aws.amazon.com/jp/about-aws/global-infrastructure/", note: "リージョンとエッジ拠点の全体像" },
        { title: "Amazon CloudFrontによるウェブサイトの高速化", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/website-hosting-cloudfront-walkthrough.html", note: "S3+CloudFront配信の公式チュートリアル" },
        { title: "Amazon CloudFrontとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/Introduction.html" }
      ]
    }
  ],
  cost: "<p>単一リージョン+CloudFrontなら<strong>月数十円〜数千円</strong>で、静的コンテンツのグローバル配信はほぼ解決する。推奨構成（S3の2リージョン複製）の追加費用は<strong>S3もう1面分＋複製転送費で月数百円〜</strong>と小さい。一方、動的APIまで多リージョン化するGlobal Accelerator案は<strong>月3万円〜10万円以上</strong>とインフラ費がほぼ2倍になる。「静的はエッジ配信で安く解決、動的の多リージョン化は高くつく」という費用構造を押さえること。</p>",
  summary: "<p>グローバル配信は「とにかく多リージョン」ではなく、<strong>まずCloudFrontのエッジ配信で足りるかを見極める</strong>のが正しい順序です。静的コンテンツはエッジキャッシュで解決し、オリジンの耐障害性が必要になったらS3複製を足す。キャッシュできない動的通信を世界中から速くしたい段階になって、初めてGlobal Acceleratorと各リージョンへのサーバー配置が登場します。そして多リージョン化の本当の難所は配信層ではなくデータベースの同期にある、という視点を持てると設計判断の精度が上がります。</p>",
  quiz: [
    {
      q: "「海外から表示が遅い」という相談に対して、いきなり多リージョン構成にせず、まずCloudFrontで足りるかを確認するのはなぜでしょうか。",
      a: "遅さの主因はユーザーとサーバーの物理的な距離であることが多く、エッジキャッシュを挟むだけで体感が大きく改善します。多リージョン化はサーバー一式とデータ同期を地域ごとに運用することになり、コストと運用負荷がほぼ倍になります。安い施策で解決するかを先に検証し、それでも残る問題に重い構成を投入するのが正しい順序です。"
    },
    {
      q: "S3を二つのリージョンに置くとき、DNSで振り分けるのではなくCloudFrontのオリジングループで切り替えているのはなぜでしょうか。",
      a: "S3のバケット名は全世界で一意という制約があるため、同じ名前のバケットを東京と米国に置いてDNSで振り分ける、という方式がそもそも成立しないからです。CloudFront側でプライマリのオリジンがエラーを返したらセカンダリへ回す仕組みにすれば、バケット名が違っても自動でフェイルオーバーできます。サービス固有の制約が構成の形を決める、分かりやすい例です。"
    },
    {
      q: "「ログインや決済などキャッシュできないAPIも世界中から速くしたい」と言われました。あなたなら何を検討し、何を最初に確認しますか。",
      a: "キャッシュできない通信の経路を速くするのはGlobal Acceleratorの役割なので、各リージョンにALBとサーバーを置き、その前段に置く構成を検討します。ただし本当の難所は配信層ではなくデータベースで、書き込みをどのリージョンで受けてどう同期するかを先に決めないと構成が破綻します。Aurora Global DatabaseやDynamoDBグローバルテーブルの検討から入るのが実務の順序です。"
    }
  ]
});
