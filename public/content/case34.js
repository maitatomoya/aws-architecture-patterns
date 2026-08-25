// ケース34：オンプレサーバーのクラウド移行（リフト&シフト）
registerCase({
  id: 34,
  category: "社内・閉域・ハイブリッド",
  title: "オンプレサーバーのクラウド移行（リフト&シフト）",
  scenario: "<p>社内サーバールームで動かしてきた業務システム（WebアプリのAPサーバー2台とDBサーバー1台）のハードウェアが保守切れを迎える。アプリを改修する予算も期間もないため、まずはそのままAWSへ引っ越す「リフト&シフト」で移行したい。移行作業中も業務は止められず、切り替えは週末の短時間で済ませたい。</p>",
  requirements: [
    "アプリケーションは改修せず、そのまま移行する（リフト&シフト）",
    "移行期間中も業務を止めない（オンプレと並行稼働する）",
    "切り替え作業は週末などの短時間で完了させる",
    "移行後はバックアップ・パッチ適用の運用負担を減らしたい",
    "問題があればオンプレへ切り戻せること"
  ],
  main: {
    name: "Site-to-Site VPN+EC2+RDS（並行稼働で段階移行）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "onpremise", label: "移行元拠点", from: [0, 0], to: [0, 1] },
        { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 0] },
        { type: "vpc", label: "VPC", from: [3, 0], to: [5, 0], depth: 1 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 0], depth: 2 }
      ],
      nodes: [
        { id: "office", icon: "resources/office", label: "現行システム", col: 0, row: 0 },
        { id: "users", icon: "resources/users", label: "社員PC", col: 0, row: 1 },
        { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site\nVPN", col: 3, row: 0 },
        { id: "ec2", icon: "services/ec2", label: "EC2\n移行後アプリ", col: 4, row: 0 },
        { id: "rds", icon: "services/rds", label: "RDS\n移行後DB", col: 5, row: 0 }
      ],
      edges: [
        { from: "users", to: "office", noArrow: true, dashed: true },
        { from: "office", to: "vpn", label: "移行データ複製", dashed: true },
        { from: "users", to: "vpn", label: "移行済み機能を利用", dashed: true },
        { from: "vpn", to: "ec2" },
        { from: "ec2", to: "rds", label: "SQL" }
      ]
    },
    flow: [
      "まずSite-to-Site VPNでオンプレとVPCを接続し、移行期間中の閉域の通信路を確保する",
      "現行サーバーのディスク内容をAWS MGN（Application Migration Service）でEC2へ継続的に複製する。業務を止めずに複製が進む",
      "DBはDMS（Database Migration Service）でRDSへ継続レプリケーションし、切替時の停止を数分〜数十分に抑える",
      "並行稼働中、社員はVPN経由で移行済みの機能から順にAWS側を使い、全機能の切替が済んだらオンプレを停止する"
    ],
    services: [
      { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "移行データの転送と並行稼働中の社内アクセスを支える閉域トンネル。工事不要ですぐ張れる" },
      { icon: "services/ec2", name: "Amazon EC2", role: "現行サーバーの移行先。OS・ミドルウェアごとそのまま動かせるため改修が不要" },
      { icon: "services/rds", name: "Amazon RDS", role: "DBサーバーの移行先。バックアップ・パッチ適用が自動化され、移行後の運用負担が大きく減る" }
    ],
    points: [
      "移行戦略には7R（リホスト・リプラットフォーム・リファクタリングなど）という分類がある。リフト&シフト（リホスト）は改修なしで速く移行できる反面、クラウドの利点を活かしきれないため「まず移して、あとで最適化」と割り切る戦略",
      "AWS MGNはブロックレベル（ディスクの中身をそのまま複製する方式）の継続レプリケーションなので、切替直前まで最新状態が保たれる。テスト起動も本番に影響なく行える",
      "DBだけはEC2ではなくRDSへ載せ替える価値が大きい。バックアップ・パッチが自動化され、「リフトの中の小さなシフト」として定番の判断。なおOracle等の商用DBは持ち込みライセンス（BYOL）かライセンス込み料金かの整理が必要で、別のDBエンジンへ乗り換える場合はスキーマ変換を支援する公式ツールSCT（AWS Schema Conversion Tool）がある",
      "切替はDNSの向き先変更で行うが、切り戻しは「DNSを戻すだけ」では済まない点に注意。切替後にAWS側へ書き込まれたデータは自動ではオンプレへ戻らないため、切り戻しに備えるならDMS等で逆方向（AWS→オンプレ）のレプリケーションを用意しておく",
      "切り戻しの判断も事前に設計する。「切替当日の何時までに問題が出たら切り戻す」というリミット時刻を決め、切り戻しで失われてよいデータの許容窓（どの時点までの書き込みを諦めるか）を業務部門と事前に合意しておく"
    ],
    pros: [
      "アプリ改修が不要で、移行が速く計画しやすい",
      "並行稼働+継続レプリケーションで業務影響を最小化できる",
      "ハードウェア保守切れの期限に間に合わせやすい"
    ],
    cons: [
      "アプリ構成が最適化されないままなので、クラウドの費用効率は出にくい",
      "移行期間中はオンプレとAWSの費用が二重にかかる",
      "EC2のOS管理（パッチ適用など）は移行後も残る"
    ],
    cost: "<strong>月3万円〜6万円程度</strong>（EC2 t3.medium2台約1.2万円+RDS小型約6,000円+VPN約5,500円+ストレージ。AWS MGNは1サーバーあたり90日間の無料期間あり。移行期間中はオンプレ側の費用も並行してかかる点に注意）",
    references: [
      { title: "AWS Application Migration Service（MGN）とは", url: "https://docs.aws.amazon.com/ja_jp/mgn/latest/ug/what-is-mgn.html", note: "リフト&シフトの公式標準ツール" },
      { title: "AWS Database Migration Service（DMS）とは", url: "https://docs.aws.amazon.com/ja_jp/dms/latest/userguide/Welcome.html", note: "DB移行・継続レプリケーション" },
      { title: "移行戦略（7R）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html", note: "リホスト/リプラットフォーム等の判断基準" },
      { title: "AWS Site-to-Site VPNとは", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/VPC_VPN.html" }
    ]
  },
  alternatives: [
    {
      name: "リプラットフォーム（移行と同時にECS化・RDS化）",
      when: "コンテナ化の目処が立っており、どうせ移行するなら運用負担と費用効率も同時に改善したい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "onpremise", label: "移行元拠点", from: [0, 0], to: [0, 0] },
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [5, 0], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "resources/office", label: "現行システム", col: 0, row: 0 },
          { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site\nVPN", col: 3, row: 0 },
          { id: "ecs", icon: "services/ecs", label: "ECS\nコンテナ化アプリ", col: 4, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\n移行後DB", col: 5, row: 0 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 4, row: 1 }
        ],
        edges: [
          { from: "office", to: "vpn", label: "IPsec VPN", dashed: true },
          { from: "vpn", to: "ecs" },
          { from: "ecs", to: "rds", label: "SQL" },
          { from: "ecr", to: "ecs", label: "イメージ取得", dashed: true }
        ]
      },
      flow: [
        "アプリをコンテナイメージにしてECR（コンテナイメージの保管庫）に登録し、ECS（Fargate）で動かす。サーバーのOS管理がなくなる",
        "DBはリフト&シフトと同じくDMSでRDSへ移行する",
        "社内からはVPN経由で新環境へ段階的に切り替える"
      ],
      services: [
        { icon: "services/ecs", name: "Amazon ECS", role: "コンテナ化したアプリの実行基盤。Fargate起動ならOSパッチ運用が不要になる" },
        { icon: "services/ecr", name: "Amazon ECR", role: "コンテナイメージの保管・配布。ECSがここからイメージを取得して起動する" },
        { icon: "services/rds", name: "Amazon RDS", role: "DBの移行先。リホスト案と同じくDMSで移行する" },
        { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "移行期間と移行後の社内アクセスを支える閉域トンネル" }
      ],
      points: [
        "リホストとの違いは「サーバーをそのまま運ぶ」か「実行基盤を載せ替える」か。載せ替えた分だけ移行の工数とリスクは増えるが、移行後のOSパッチ運用が消える",
        "コンテナ化はアプリの起動方法・設定・ログ出力を整理する作業でもあり、属人化していた運用手順の棚卸しになる副次効果が大きい",
        "全部をECS化する必要はない。コンテナ化しやすいAPサーバーだけ載せ替え、難しいものはEC2のままにする混在構成も現実的"
      ],
      pros: [
        "移行後のOS運用負担が大きく減り、オートスケールなどクラウドの利点を活かしやすい",
        "リソースをタスク単位で細かく調整でき、費用効率が上がることが多い"
      ],
      cons: [
        "コンテナ化の工数と検証リスクが移行スケジュールに乗る",
        "コンテナ・ECSの知識がチームに必要になる"
      ],
      cost: "<strong>月2.5万円〜5万円程度</strong>（Fargate2タスク+RDS小型+VPN。EC2構成より安くなることも多いが、コンテナ化の人件費・移行工数は別途大きい）",
      references: [
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html", note: "ECS公式デベロッパーガイド" },
        { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" },
        { title: "AWS Database Migration Service（DMS）とは", url: "https://docs.aws.amazon.com/ja_jp/dms/latest/userguide/Welcome.html" }
      ]
    },
    {
      name: "ハイブリッド継続（移行しないものを残す判断）",
      when: "専用ハードやライセンス制約のあるシステム、移行効果の薄いレガシーが残る場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "onpremise", label: "社内拠点", from: [0, 0], to: [0, 1] },
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [5, 0], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "office", icon: "resources/office", label: "基幹システム\n（残す）", col: 0, row: 0 },
          { id: "users", icon: "resources/users", label: "社員PC", col: 0, row: 1 },
          { id: "vpn", icon: "services/site-to-site-vpn", label: "Site-to-Site\nVPN", col: 3, row: 0 },
          { id: "ec2", icon: "services/ec2", label: "EC2\n移行済みアプリ", col: 4, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\n業務DB", col: 5, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\nファイル共有", col: 5, row: 1 }
        ],
        edges: [
          { from: "users", to: "office", noArrow: true, dashed: true },
          { from: "office", to: "vpn", label: "IPsec VPN", dashed: true },
          { from: "vpn", to: "ec2", label: "日次データ連携" },
          { from: "ec2", to: "rds", label: "SQL" },
          { from: "ec2", to: "s3", label: "ファイル共有" }
        ]
      },
      flow: [
        "移行効果の高いシステムだけをEC2/RDSへ移し、専用ハード依存やライセンス制約のある基幹システムはオンプレに残す",
        "残した基幹システムとAWS側はVPN経由で日次のデータ連携を行う",
        "共有ファイルはS3に置き、両環境から参照できるようにする"
      ],
      services: [
        { icon: "services/site-to-site-vpn", name: "AWS Site-to-Site VPN", role: "残したオンプレと移行済みのAWSをつなぐ恒久的な閉域接続" },
        { icon: "services/ec2", name: "Amazon EC2", role: "移行効果が高いと判断したシステムの移行先" },
        { icon: "services/rds", name: "Amazon RDS", role: "移行したシステムのDB" },
        { icon: "services/s3", name: "Amazon S3", role: "オンプレとAWS双方から使う共有データの置き場所" }
      ],
      points: [
        "「全部移行」が常に正解ではない。移行のコスト・リスクと得られる効果を比べて残す判断も戦略のうち（7Rでいうリテイン）",
        "残すと決めたシステムにも「次のハード更改時に再判断」など見直し期限を付けておくと、なし崩しの塩漬けを防げる",
        "接続が恒久化するなら、VPNからDirect Connect（ケース33参照）への増強や回線冗長化を検討する"
      ],
      pros: [
        "リスクの高い移行を無理に行わず、投資対効果の高い順に進められる",
        "現場業務への影響を抑えながらクラウド化を進められる"
      ],
      cons: [
        "オンプレの運用・保守体制が残り続ける",
        "2つの環境を管理する状態が恒久化し、全体の複雑さは増す"
      ],
      cost: "<strong>AWS側は月2万円〜4万円程度</strong>（EC2+RDS+S3+VPN）に加えて、残したオンプレの維持費用が継続する",
      references: [
        { title: "移行戦略（7R）", url: "https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html", note: "リテイン（残す）を含む判断基準" },
        { title: "AWS Site-to-Site VPNとは", url: "https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/VPC_VPN.html" },
        { title: "Amazon S3とは", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/Welcome.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（リフト&シフト）は<strong>月3万円〜6万円程度</strong>で、移行期間中はオンプレ費用と二重になる。リプラットフォーム案は移行後<strong>月2.5万円〜5万円程度</strong>と運用費は下がるが、コンテナ化の初期工数が大きい。ハイブリッド継続はAWS側<strong>月2万円〜4万円程度</strong>+オンプレ維持費が続く。</p>",
  summary: "<p>リフト&シフトは<strong>「期限内に確実に移す」ことを最優先にした戦略</strong>です。改修なしで速い代わりにクラウドの利点は後回しになるため、「移行」と「最適化」を分けて考え、移行後にECS化やマネージド化を進めるのが現実的です。判断に迷ったら7R（リホスト・リプラットフォーム・リテインなど）の枠組みで「このシステムはどれか」を仕分けしましょう。DBだけRDSに載せ替える、効果の薄いものは残す、といった混ぜ方ができるようになると、移行計画の説得力が一気に上がります。</p>",
  quiz: [
    {
      q: "切替はDNSの向き先変更で行いますが、切り戻しは「DNSを戻すだけ」では済みません。何が問題になるのでしょうか。",
      a: "切替後にAWS側へ書き込まれた注文や更新はオンプレのDBに存在しないため、DNSだけ戻すとデータが欠けた状態で業務が再開してしまいます。切り戻しに備えるならDMSなどでAWSからオンプレへの逆方向レプリケーションを用意します。あわせて「何時までに問題が出たら戻すか」というリミット時刻と、切り戻しで失われてよいデータの範囲を業務部門と事前に合意しておくことが必要です。"
    },
    {
      q: "アプリを改修しないリフト&シフトなのに、DBだけはEC2ではなくRDSへ載せ替えています。この判断が割に合うのはなぜでしょうか。",
      a: "DBは多くの場合アプリを改修せず接続先を変えるだけで移せる一方、移した効果としてバックアップとパッチ適用の自動化がすぐ手に入るからです。EC2に載せたままではOSとDBの管理が移行後も残り続けます。<strong>リフトの中の小さなシフト</strong>として、費用対効果が最も高い部分だけ最適化するという考え方の実例です。"
    },
    {
      q: "移行対象を洗い出したところ、専用ハードに依存する基幹システムが1つ残ることが判明しました。あなたならどう扱うでしょうか。",
      a: "無理に移さず残す判断（7Rでいうリテイン）を取り、代替2のハイブリッド継続の形にします。移行効果の高いシステムだけをAWSへ移し、残した基幹とはVPN経由で日次連携すればよいからです。ただし「次のハード更改時に再判断する」といった見直し期限を付けておかないと、なし崩しに塩漬けになります。接続が恒久化するならケース33のDirect Connect化や回線冗長化も検討対象になります。"
    }
  ]
});
