// ケース49：災害対策（DR）・マルチリージョン
registerCase({
  id: 49,
  category: "運用・セキュリティ・信頼性",
  title: "災害対策（DR）・マルチリージョン",
  scenario: "<p>全国の店舗で使われる在庫・受発注SaaSを東京リージョンで運用している。ある日、経営層から「大地震などで東京リージョン全体が止まったら業務はどうなるのか」と問われ、答えられなかった。顧客との契約更改でも事業継続計画（BCP）の提出を求められている。そこで、大阪リージョンを使った災害対策（DR：Disaster Recovery）を設計することになった。前提として、<strong>RTO（Recovery Time Objective：障害発生から復旧までの目標時間）とRPO（Recovery Point Objective：どの時点のデータまで戻れるかの目標、つまり許容できるデータ損失量）</strong>を決め、それに見合うコストの方式を選ぶ必要がある。</p>",
  requirements: [
    "東京リージョン全体の障害時にも、大阪リージョンでサービスを再開できること",
    "RTO（復旧目標時間）は1時間以内、RPO（データ損失の許容）は数秒〜数分が理想",
    "DNSの切り替えは自動化し、深夜でも人手なしでフェイルオーバーしたい",
    "データベースとファイルは常に別リージョンへ複製しておきたい",
    "平常時の待機コストは効果に見合う範囲に抑えたい",
    "年1回はDR訓練（切り替えテスト）を実施できる構成にしたい"
  ],
  main: {
    name: "Route 53フェイルオーバー+Auroraグローバルデータベース（ウォームスタンバイ）",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 2] },
        { type: "region", label: "東京リージョン", from: [1, 1], to: [2, 2], depth: 1 },
        { type: "region", label: "大阪リージョン", from: [3, 1], to: [4, 2], depth: 1 }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "利用企業", col: 0, row: 0 },
        { id: "r53", icon: "services/route53", label: "Route 53\nフェイルオーバー", col: 3, row: 0 },
        { id: "alba", icon: "services/elb", label: "ALB\nアプリの入口", col: 1, row: 1 },
        { id: "s3a", icon: "services/s3", label: "S3\n帳票・画像", col: 2, row: 1 },
        { id: "aua", icon: "services/aurora", label: "Aurora\nプライマリ", col: 1, row: 2 },
        { id: "albb", icon: "services/elb", label: "ALB\n待機系の入口", col: 4, row: 1 },
        { id: "aub", icon: "services/aurora", label: "Aurora\nセカンダリ", col: 3, row: 2 },
        { id: "s3b", icon: "services/s3", label: "S3\n複製バケット", col: 4, row: 2 }
      ],
      edges: [
        { from: "users", to: "r53", label: "名前解決", dashed: true },
        { from: "users", to: "alba", label: "通常時" },
        { from: "users", to: "albb", label: "障害時", dashed: true },
        { from: "alba", to: "s3a", label: "画像を保存" },
        { from: "alba", to: "aua", label: "読み書き" },
        { from: "aua", to: "aub", label: "グローバルDB複製" },
        { from: "albb", to: "aub", dashed: true },
        { from: "s3a", to: "s3b", label: "リージョン間複製" }
      ]
    },
    flow: [
      "利用企業のアクセスはRoute 53が名前解決し、ヘルスチェックが正常な間は東京リージョンのALBへ誘導する",
      "アプリはAuroraプライマリに読み書きし、帳票・画像はS3に保存する（ALBの背後のアプリサーバー群は図では省略）",
      "AuroraグローバルデータベースがセカンダリリージョンへRPO数秒未満（通常1秒未満の遅延）でデータを複製し続け、S3もクロスリージョンレプリケーションで大阪へ複製する",
      "東京の障害をRoute 53のヘルスチェックが検知すると、DNSの向き先が自動で大阪のALBに切り替わる",
      "大阪側ではAuroraセカンダリをプライマリへ昇格し、縮小構成で待機していたアプリをスケールアップしてサービスを再開する"
    ],
    services: [
      { icon: "services/route53", name: "Amazon Route 53", role: "DNSフェイルオーバーの司令塔。ヘルスチェックで障害を検知し、向き先を自動で切り替える" },
      { icon: "services/aurora", name: "Amazon Auroraグローバルデータベース", role: "リージョン間をまたぐDB複製。RPO数秒・昇格1分程度という、DRの最難関であるDB切り替えを担う" },
      { icon: "services/s3", name: "Amazon S3（クロスリージョンレプリケーション）", role: "帳票・画像を大阪へ自動複製。ファイル側のRPOを最小化する" },
      { icon: "services/elb", name: "Application Load Balancer", role: "各リージョンのアプリの入口。この背後に本来EC2/ECSなどのアプリ層とVPCがある（図ではDRの構造に集中するため省略）" }
    ],
    points: [
      "この方式は「ウォームスタンバイ」と呼ばれ、待機側にも縮小版のシステムを常時動かしておく。RTO1時間以内の要件は、ゼロから作り直す方式（バックアップ&リストア）では満たせないため、この方式を選んだ",
      "DRの最難関はDBの切り替え。Auroraグローバルデータベースは複製遅延が通常1秒未満で、昇格も分単位のため、RPO数秒・RTO1時間の要件に現実的に届く",
      "図はDRの構造に焦点を当てるため、各リージョン内のVPC・インターネットゲートウェイ・アプリサーバー群を省略している。実物は各リージョンにWeb3層構成（別ケース参照）が丸ごと入る",
      "フェイルオーバーは「切り替わること」より「切り戻しと訓練」が難しい。年1回のDR訓練を要件に入れたのは、訓練していないDRは本番で高確率で失敗するため"
    ],
    pros: [
      "RTO分単位〜1時間・RPO数秒という高い目標を現実的なコストで達成できる",
      "Route 53のヘルスチェックにより、深夜でも人手なしで切り替えが始まる",
      "待機系が常時動いているため、DR訓練や切り替えテストがやりやすい",
      "Auroraの昇格・S3の複製などリージョン間連携がマネージドで、自作の複製機構が不要"
    ],
    cons: [
      "待機側のAurora・ALB・縮小版アプリの常時費用がかかり、片リージョン構成の1.3〜1.7倍程度になる",
      "DNS切り替えはクライアント側のキャッシュ（TTL）の影響を受け、全利用者の切り替わりには数分かかる",
      "アプリ・設定・デプロイを2リージョンで同期し続ける運用規律が必要（片方だけ更新される事故が起きがち）"
    ],
    cost: "<strong>月8万円〜30万円程度</strong>（本番が月10万円規模のWeb3層構成の場合の目安。内訳は大阪側のAuroraセカンダリ＋縮小アプリ＋ALBの常時費用、S3複製ストレージ、リージョン間転送約0.09USD/GB。RTO/RPO要件を緩められるなら代替パターンで大幅に下げられる）",
    references: [
      { title: "Route 53のDNSフェイルオーバー", url: "https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/dns-failover.html", note: "ヘルスチェックと自動切り替えの設定" },
      { title: "Amazon Auroraグローバルデータベース", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html", note: "リージョン間複製と昇格の公式ガイド" },
      { title: "S3オブジェクトのレプリケーション", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/replication.html", note: "クロスリージョンレプリケーションの設定" },
      { title: "クラウドにおける災害対策の選択肢（公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html", note: "4つのDR方式とRTO/RPOの整理。このケース全体の元ネタ" },
      { title: "Route 53ヘルスチェックの仕組み", url: "https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/welcome-health-checks.html" }
    ]
  },
  alternatives: [
    {
      name: "バックアップ&リストア方式（コールドスタンバイ・最安）",
      when: "RTOが半日〜数日でも許される社内システム等で、DR費用を最小にしたい場合",
      diagram: {
        cols: 4, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 2] },
          { type: "region", label: "東京リージョン", from: [0, 1], to: [1, 2], depth: 1 },
          { type: "vpc", label: "VPC", from: [0, 2], to: [1, 2], depth: 2 },
          { type: "region", label: "大阪リージョン", from: [2, 1], to: [3, 2], depth: 1 }
        ],
        nodes: [
          { id: "bka", icon: "services/backup", label: "AWS Backup\n日次取得", col: 1, row: 1 },
          { id: "ec2", icon: "services/ec2", label: "EC2\nアプリ", col: 0, row: 2 },
          { id: "rds", icon: "services/rds", label: "RDS\nデータベース", col: 1, row: 2 },
          { id: "bkb", icon: "services/backup", label: "バックアップ\nコピー保管", col: 2, row: 1 },
          { id: "cfn", icon: "services/cloudformation", label: "CloudFormation\n復旧テンプレート", col: 3, row: 1 }
        ],
        edges: [
          { from: "ec2", to: "bka" },
          { from: "rds", to: "bka", label: "日次バックアップ" },
          { from: "bka", to: "bkb", label: "大阪へコピー" },
          { from: "cfn", to: "bkb", label: "被災時に復元", dashed: true }
        ]
      },
      flow: [
        "平常時は東京リージョンだけでシステムを運用し、AWS BackupがEC2・RDSの日次バックアップを取得する",
        "バックアップは大阪リージョンのボールトへ自動コピーされる。大阪に常時動くものは何もない（だからコールド＝冷えている、と呼ぶ）",
        "被災時はCloudFormation（インフラをコードから自動構築するサービス）で大阪にVPCやサーバー一式を作り、バックアップからデータを復元してDNSを切り替える"
      ],
      services: [
        { icon: "services/backup", name: "AWS Backup（リージョン間コピー）", role: "日次バックアップの取得と大阪への自動コピー。この方式の生命線" },
        { icon: "services/cloudformation", name: "AWS CloudFormation", role: "被災時に大阪でインフラ一式を再現するテンプレート。手順書の代わりにコードで持つ" },
        { icon: "services/ec2", name: "Amazon EC2", role: "平常時は東京のみで稼働。大阪では被災時に初めて作られる" },
        { icon: "services/rds", name: "Amazon RDS", role: "バックアップからの復元対象。復元時間がRTOの大部分を占める" }
      ],
      points: [
        "RTOは半日〜数日、RPOは最終バックアップ時点（日次なら最大24時間ぶんの損失）。この数字を経営層と合意してから選ぶことが何より重要",
        "大阪側の平常時費用はバックアップ保管料だけなので、DR方式の中で圧倒的に安い",
        "「バックアップがあるのに復元手順が動かない」が典型的な失敗。インフラをCloudFormation化して、復元をコマンド実行に落とし込んでおくのが成功の鍵",
        "図はバックアップの流れに焦点を当てており、ユーザー向けの通信経路（IGWやALB）は省略している"
      ],
      pros: [
        "平常時の追加費用がバックアップ保管料程度で、DR方式の中で最安",
        "構成が単純で、バックアップ運用（ケース48）の延長として始められる",
        "テンプレート化しておけば、リージョン障害以外の環境再構築にも流用できる"
      ],
      cons: [
        "RTOが半日〜数日と長く、対外サービスのBCPとしては不十分なことが多い",
        "RPOがバックアップ間隔に依存し、日次なら最大24時間のデータを失う",
        "復元手順を定期的に試していないと、本番でテンプレートが動かないリスクが高い"
      ],
      cost: "<strong>月数千円〜2万円程度</strong>（大阪側はバックアップ保管料＋リージョン間コピー転送のみ。本番側の費用は変わらない。被災して復旧環境を立ち上げた期間だけ、通常運用と同等の費用が発生する）",
      references: [
        { title: "リージョン間バックアップコピーの作成", url: "https://docs.aws.amazon.com/ja_jp/aws-backup/latest/devguide/cross-region-backup.html", note: "この方式の中核設定" },
        { title: "AWS CloudFormationとは", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/Welcome.html", note: "復旧環境をコードで再現する" },
        { title: "クラウドにおける災害対策の選択肢（公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html", note: "バックアップ&リストア方式の位置づけ" }
      ]
    },
    {
      name: "パイロットライト方式（最小限だけ常時起動）",
      when: "RTO数十分〜数時間・RPO数分程度を、ウォームスタンバイより安く実現したい場合",
      diagram: {
        cols: 7, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 2] },
          { type: "region", label: "東京リージョン", from: [1, 1], to: [3, 2], depth: 1 },
          { type: "vpc", label: "VPC", from: [2, 1], to: [3, 2], depth: 2 },
          { type: "region", label: "大阪リージョン", from: [4, 1], to: [6, 2], depth: 1 },
          { type: "vpc", label: "VPC", from: [5, 1], to: [6, 2], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "利用企業", col: 0, row: 0 },
          { id: "r53", icon: "services/route53", label: "Route 53\n切り替え", col: 4, row: 0 },
          { id: "igwa", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 1 },
          { id: "ec2a", icon: "services/ec2", label: "EC2\n本番アプリ", col: 3, row: 1 },
          { id: "rdsa", icon: "services/rds", label: "RDS\nプライマリ", col: 3, row: 2 },
          { id: "igwb", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 6, row: 1 },
          { id: "ec2b", icon: "services/ec2", label: "EC2\n停止中(AMI)", col: 5, row: 1 },
          { id: "rdsb", icon: "services/rds", label: "RDS\nレプリカ稼働", col: 5, row: 2 }
        ],
        edges: [
          { from: "users", to: "r53", label: "名前解決" },
          { from: "r53", to: "igwa", label: "通常時" },
          { from: "r53", to: "igwb", label: "障害時に切替", dashed: true },
          { from: "igwa", to: "ec2a" },
          { from: "ec2a", to: "rdsa", label: "読み書き" },
          { from: "rdsa", to: "rdsb", label: "常時複製" },
          { from: "igwb", to: "ec2b", label: "被災時に起動", dashed: true },
          { from: "ec2b", to: "rdsb", dashed: true }
        ]
      },
      flow: [
        "平常時、大阪では「消してはいけない種火」だけを動かす。具体的にはRDSのリージョン間リードレプリカ（読み取り専用の複製）だけを常時稼働させる",
        "アプリサーバーはAMI（サーバーの起動イメージ）として準備だけしておき、EC2は停止状態＝費用ゼロで待機する",
        "被災時はレプリカを書き込み可能なプライマリへ昇格し、AMIからEC2を起動してRoute 53の向き先を大阪へ切り替える",
        "データはレプリケーションで常時同期されているため、RPOは数分以内に収まる"
      ],
      services: [
        { icon: "services/rds", name: "Amazon RDS（リージョン間リードレプリカ)", role: "常時起動する唯一の種火。データを同期し続け、被災時に昇格して本番DBになる" },
        { icon: "services/ec2", name: "Amazon EC2＋AMI", role: "アプリはイメージとして準備し、平常時は停止。起動時間の数分〜数十分がRTOに乗る" },
        { icon: "services/route53", name: "Amazon Route 53", role: "被災時にDNSを大阪へ切り替える。自動・手動どちらの切り替えも設計できる" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "各リージョンのVPCの入口。VPC・サブネットは両リージョンに事前作成しておく" }
      ],
      points: [
        "パイロットライトとはガス給湯器の「種火」のこと。すぐ点火できる最小限（DB複製とネットワーク）だけを温めておき、大物（アプリサーバー）は消しておくという比喩",
        "費用はレプリカDB1台分が中心で、ウォームスタンバイの半分以下に抑えられることが多い。RTOは起動作業の分だけ延びて数十分〜数時間になる",
        "VPC・サブネット・セキュリティグループは事前に大阪へ作成しておく。「起動するだけ」の状態まで準備してあるかどうかがRTOを決める",
        "昇格後の切り戻し（東京復旧後に元へ戻す手順）まで訓練しておかないと、片肺運転が長期化しがち"
      ],
      pros: [
        "DBが常時同期されるため、RPO数分以内とコールドスタンバイより桁違いに良い",
        "待機費用はレプリカDB中心で、ウォームスタンバイより大幅に安い",
        "AMIとテンプレートの整備が進むため、平常時の環境複製にも役立つ"
      ],
      cons: [
        "アプリ起動と昇格の作業時間がRTOに乗る（自動化の作り込み次第で数十分〜数時間）",
        "AMIやアプリ設定を最新に保つ運用を怠ると、起動しても動かない「錆びた種火」になる",
        "切り替え・切り戻しの手順が推奨構成より複雑で、訓練必須"
      ],
      cost: "<strong>月2万円〜8万円程度</strong>（大阪側のレプリカDB常時稼働＋リージョン間転送＋スナップショット保管が中心。本番が月10万円規模の場合の目安。EC2は停止中ならEBS保管料のみ）",
      references: [
        { title: "クラウドにおける災害対策の選択肢（公式ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html", note: "パイロットライト方式の定義と比較" },
        { title: "Route 53のDNSフェイルオーバー", url: "https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/dns-failover.html", note: "切り替えの自動化" },
        { title: "RDSの自動バックアップとレプリカ", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html", note: "レプリカ運用の基礎" }
      ]
    }
  ],
  cost: "<p>DRのコストはRTO/RPOとの交換で決まる。バックアップ&リストア方式は<strong>月数千円〜2万円程度</strong>（RTO半日〜数日・RPO最大24時間）、パイロットライト方式は<strong>月2万円〜8万円程度</strong>（RTO数十分〜数時間・RPO数分）、推奨のウォームスタンバイは<strong>月8万円〜30万円程度</strong>（RTO分単位〜1時間・RPO数秒）が目安（いずれも本番が月10万円規模の場合）。「RTOを1桁縮めると費用も1桁近く上がる」という関係を経営層に示し、業務ごとに方式を使い分けるのが実務の落としどころ。</p>",
  summary: "<p>DR設計は技術選定の前に<strong>RTO（どれだけ早く復旧するか）とRPO（どれだけのデータ損失を許すか）を決める</strong>ことがすべての出発点です。この2つの数字が決まれば、方式はほぼ自動的に決まります。バックアップ&リストア→パイロットライト→ウォームスタンバイ（→さらに上のマルチサイト・アクティブ/アクティブ）の順にRTO/RPOが良くなり、費用も上がる階段構造をまず覚えましょう。そして最重要の教訓は「訓練していないDRは動かない」。年1回の切り替え訓練までを含めて初めてDRは完成します。全ワークロード一律ではなく、業務の重要度ごとに方式を混ぜるのが現実的な設計です。</p>"
});
