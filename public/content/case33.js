// ケース33：オンプレとのハイブリッド接続
registerCase({
  id: 33,
  category: "社内・閉域・ハイブリッド",
  title: "オンプレとのハイブリッド接続",
  scenario: "<p>製造業の情報システム部門。データセンターで動く基幹システム（生産管理・販売管理）はすぐには動かせないが、新しい分析基盤やデータ保管はAWSを使いたい。オンプレの基幹システムとAWS上のシステムが毎日大量のデータをやり取りするため、安定した閉域の常時接続が必要になった。オンプレとクラウドを併用する、いわゆるハイブリッド構成である。</p>",
  requirements: [
    "オンプレの基幹システムとAWSが常時通信できること",
    "日次バッチで数十GB規模のデータを転送しても安定していること（帯域保証）",
    "通信はインターネットを経由しない閉域であること",
    "回線障害時の代替経路を用意できる設計であること",
    "将来のクラウド移行（ケース34）の足場になること"
  ],
  main: {
    name: "Direct Connect+VPC+EC2+S3（常時ハイブリッド接続）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "onpremise", label: "オンプレ拠点", from: [0, 0], to: [0, 1] },
        { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 0] },
        { type: "vpc", label: "VPC", from: [3, 0], to: [4, 0], depth: 1 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 }
      ],
      nodes: [
        { id: "office", icon: "resources/office", label: "基幹システム", col: 0, row: 0 },
        { id: "users", icon: "resources/users", label: "社員PC", col: 0, row: 1 },
        { id: "dx", icon: "services/direct-connect", label: "Direct\nConnect", col: 2, row: 0 },
        { id: "ec2", icon: "services/ec2", label: "EC2\n連携アプリ", col: 4, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\nデータ保管", col: 5, row: 0 }
      ],
      edges: [
        { from: "users", to: "office", noArrow: true, dashed: true },
        { from: "office", to: "dx", label: "専用線", dashed: true },
        { from: "dx", to: "ec2", label: "閉域通信" },
        { from: "ec2", to: "s3", label: "加工データを保存" }
      ]
    },
    flow: [
      "オンプレのデータセンターとAWSをDirect Connect（物理専用線）で接続する。インターネットを経由しない、帯域が保証された閉域の通信路になる",
      "基幹システムのデータは専用線を通ってVPC内のEC2（連携アプリ）に届き、変換・集計される",
      "処理済みデータはS3に保管する。S3はVPCの外にあるサービスだが、ゲートウェイ型VPCエンドポイントを使えばインターネットに出ずに到達できる",
      "社員は社内ネットワークから、そのまま閉域経由でAWS上のシステムも利用する"
    ],
    services: [
      { icon: "services/direct-connect", name: "AWS Direct Connect", role: "オンプレとAWSを結ぶ物理専用線。帯域保証・低遅延・閉域を同時に満たす、ハイブリッド接続の本命" },
      { icon: "services/ec2", name: "Amazon EC2", role: "オンプレとやり取りするデータの変換・集計を行う連携アプリの実行基盤" },
      { icon: "services/s3", name: "Amazon S3", role: "加工済みデータやバックアップの保管先。ライフサイクルルールで古いデータを低コスト層へ自動移動できる" }
    ],
    points: [
      "Direct Connectは物理専用線なので、VPNと違って帯域・遅延が安定する。日次で大容量転送があるハイブリッド構成の第一候補",
      "ただし開通には物理工事と通信事業者との契約が必要で、数週間〜数か月かかる。プロジェクト計画に必ず織り込む",
      "S3をサブネットの中に描いていないのは作図の誤りではなくAWSの仕様。VPCの外にあるマネージドサービスへは、VPCエンドポイント経由で閉域のままアクセスする",
      "Direct Connect1本は物理障害で全断する。基幹連携を任せる本番構成では、代替2のようにVPNバックアップを足すのが定石"
    ],
    pros: [
      "帯域保証・低遅延・閉域の3つを同時に満たせる",
      "データ転送料金がインターネット経由より安く、大容量転送ほど有利",
      "基幹連携のような「止められない通信」に耐える回線品質"
    ],
    cons: [
      "回線費用が高く、費用の大半を占める",
      "開通までのリードタイムが長い（数週間〜数か月）",
      "1本だけの構成は物理障害が単一障害点になる"
    ],
    cost: "<strong>月5万円〜数十万円程度</strong>。内訳はAWS側ポート料金（1Gbps専有で月約3.3万円、ホスト型50Mbpsなら月数千円〜）+通信事業者の専用線費用（距離・帯域次第で月数万円〜）+EC2（t3.medium約6,000円）+S3保管料。回線費用が支配的",
    references: [
      { title: "AWS Direct Connectとは", url: "https://docs.aws.amazon.com/ja_jp/directconnect/latest/UserGuide/Welcome.html", note: "Direct Connect公式ユーザーガイド" },
      { title: "Amazon S3のゲートウェイエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/privatelink/vpc-endpoints-s3.html", note: "S3へ閉域のままアクセスする方法" },
      { title: "Amazon VPC接続オプション", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/aws-vpc-connectivity-options/welcome.html", note: "接続方式を比較するAWS公式ホワイトペーパー" },
      { title: "AWS Direct Connectの料金", url: "https://aws.amazon.com/jp/directconnect/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "Site-to-Site VPN（スモールスタート・バックアップ回線）",
      when: "転送量が少なく帯域保証まで不要な段階、Direct Connectの開通待ちの間、またはDXのバックアップ回線として",
      diagram: {
        cols: 6, rows: 1,
        groups: [
          { type: "onpremise", label: "オンプレ拠点", from: [0, 0], to: [0, 0] },
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 0] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 0], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [4, 0], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "resources/office", label: "基幹システム", col: 0, row: 0 },
          { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site\nVPN", col: 3, row: 0 },
          { id: "ec2", icon: "services/ec2", label: "EC2\n連携アプリ", col: 4, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\nデータ保管", col: 5, row: 0 }
        ],
        edges: [
          { from: "office", to: "vpn", label: "IPsec VPN", dashed: true },
          { from: "vpn", to: "ec2" },
          { from: "ec2", to: "s3", label: "データ保存" }
        ]
      },
      flow: [
        "オンプレのルーターとAWSの間にIPsecのVPNトンネルを張る。インターネット回線上の暗号化トンネルなので、物理工事なしで数時間〜数日で開通する",
        "以降はDirect Connect構成と同じく、EC2で処理してS3へ保管する",
        "帯域はインターネット回線の品質に依存するため、大容量転送は夜間に寄せるなど運用でカバーする"
      ],
      services: [
        { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "インターネット上に張る暗号化トンネル。月約5,500円と安く、すぐ使える" },
        { icon: "services/ec2", name: "Amazon EC2", role: "データ連携アプリの実行基盤" },
        { icon: "services/s3", name: "Amazon S3", role: "データの保管先" }
      ],
      points: [
        "月約5,500円・工事不要で始められるのが最大の利点。ハイブリッド接続の入門はまずVPNから",
        "暗号化はされるが経路はインターネット。帯域・遅延は保証されず、1トンネル最大約1.25Gbpsの上限もある",
        "後からDirect Connectを開通させた場合、このVPNはそのままバックアップ回線に転用できる（代替2の形）"
      ],
      pros: [
        "安く、即日〜数日で開通できる",
        "将来Direct Connectを引いたときにバックアップ回線へ転用できる"
      ],
      cons: [
        "帯域・遅延がインターネット品質に左右され不安定",
        "毎日の大容量定時転送には力不足のことがある"
      ],
      cost: "<strong>月1万円〜2万円程度</strong>（VPN約5,500円+EC2小型約3,000円+S3保管料。転送量により変動）",
      references: [
        { title: "AWS Site-to-Site VPNとは", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/VPC_VPN.html", note: "VPN公式ユーザーガイド" },
        { title: "Site-to-Site VPN接続の冗長化", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/vpn-redundant-connection.html" },
        { title: "AWS VPNの料金", url: "https://aws.amazon.com/jp/vpn/pricing/" }
      ]
    },
    {
      name: "Direct Connect+VPNの冗長構成（本番の定石）",
      when: "基幹連携が止まると業務が止まるため、回線障害時も接続を維持したい本番運用の場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "onpremise", label: "オンプレ拠点", from: [0, 0], to: [0, 0] },
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [3, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 1], to: [3, 1], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "resources/office", label: "基幹システム", col: 0, row: 0 },
          { id: "dx", icon: "services/direct-connect", label: "Direct Connect\n主回線", col: 2, row: 0 },
          { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site VPN\n予備回線", col: 2, row: 1 },
          { id: "ec2", icon: "services/ec2", label: "EC2\n連携アプリ", col: 3, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nデータ保管", col: 4, row: 0 }
        ],
        edges: [
          { from: "office", to: "dx", label: "主回線：専用線", dashed: true },
          { from: "office", to: "vpn", label: "予備：VPN", dashed: true },
          { from: "dx", to: "ec2", label: "通常時" },
          { from: "vpn", to: "ec2", label: "障害時のみ" },
          { from: "ec2", to: "s3", label: "データ保存" }
        ]
      },
      flow: [
        "通常時はDirect Connect（主回線）で通信する",
        "同じVPCにSite-to-Site VPN（予備回線）も接続しておき、BGP（経路を自動で切り替えるルーティングプロトコル）でDX障害時に自動でVPNへ切り替わるようにする",
        "切替後は帯域が細くなるため、「最低限流すべき通信」をあらかじめ決めておく"
      ],
      services: [
        { icon: "services/direct-connect", name: "AWS Direct Connect", role: "通常時に使う主回線。帯域保証・低遅延" },
        { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "DX障害時に自動で切り替わる予備回線。月約5,500円の保険" },
        { icon: "services/ec2", name: "Amazon EC2", role: "データ連携アプリの実行基盤" },
        { icon: "services/s3", name: "Amazon S3", role: "データの保管先" }
      ],
      points: [
        "AWS公式もDirect Connect単線を推奨しておらず、DX2本またはDX+VPNの冗長化を推奨している。コストを抑えた現実解がDX+VPN",
        "切替は手動ではなくBGPで自動化する。年に1回は計画的にフェイルオーバー訓練を行い、実際に切り替わることを確認する",
        "VPN側はDXより帯域が細い。障害時に全トラフィックは流せない前提で、基幹連携など優先度の高い通信を決めておく（縮退運転の設計）"
      ],
      pros: [
        "回線の物理障害・工事・事業者障害に耐えられる",
        "DXを2本引くより大幅に安く冗長化できる"
      ],
      cons: [
        "BGP設計など構成・運用が複雑になる",
        "障害時はVPNの帯域に縮退し、性能が落ちる"
      ],
      cost: "<strong>推奨構成+月約5,500円</strong>（VPN接続料の追加分のみ。DX側の費用は推奨構成と同じ）",
      references: [
        { title: "AWS Direct Connect Resiliency Toolkit", url: "https://docs.aws.amazon.com/ja_jp/directconnect/latest/UserGuide/resiliency_toolkit.html", note: "回線冗長化の公式推奨パターン" },
        { title: "Site-to-Site VPN接続の冗長化", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/vpn-redundant-connection.html" },
        { title: "Amazon VPC接続オプション", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/aws-vpc-connectivity-options/welcome.html", note: "接続方式比較のホワイトペーパー" }
      ]
    }
  ],
  cost: "<p>推奨構成（Direct Connect）は回線費用が支配的で<strong>月5万円〜数十万円</strong>。VPN案なら<strong>月1万円〜2万円程度</strong>で始められる。本番の定石であるDX+VPN冗長は<strong>DX費用+月約5,500円</strong>で回線障害への保険が買えるため、費用対効果が非常に高い。</p>",
  summary: "<p>ハイブリッド接続の選択は<strong>帯域・納期・費用のトレードオフ</strong>です。まずVPNで安く速くつなぎ、転送量が増えて品質が必要になったらDirect Connectへ、本番の基幹連携を任せるならDX+VPN冗長へ、という段階的な進化が定番です。オンプレとクラウドの併存は「移行が終わっていない中途半端な状態」ではなく、動かせないものを残しつつクラウドの利点を取り込む立派な戦略です。接続はその生命線なので、単一障害点を作らない設計を最初から意識しましょう。</p>"
});
