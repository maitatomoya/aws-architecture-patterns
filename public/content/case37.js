// ケース37：マルチアカウント統制
registerCase({
  id: 37,
  category: "社内・閉域・ハイブリッド",
  title: "マルチアカウント統制",
  scenario: "<p>事業拡大でAWSの利用が複数チーム・複数環境に広がってきた企業。今は1つのアカウントに本番・開発・検証が同居しており、開発中の事故が本番に波及しかけたり、「誰がこの設定を変えたのか」が追えなくなってきた。アカウントを分割して統制を効かせたいが、情シス担当は2名。アカウントが増えても運用が破綻しない仕組みにしたい。</p>",
  requirements: [
    "本番・開発など環境ごとに事故の影響範囲を分離したい",
    "全アカウントの操作履歴（証跡）を1か所に改ざんされない形で保管したい",
    "全アカウントの脅威検知を1つの画面で監視したい",
    "会社として禁止したい操作（ガードレール）を全アカウントに強制したい",
    "請求は会社でまとめて把握したい",
    "少人数でも回る運用にしたい"
  ],
  main: {
    name: "Organizationsによるマルチアカウント統制",
    diagram: {
      cols: 7, rows: 3,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [6, 2] },
        { type: "account", label: "管理アカウント", from: [2, 0], to: [4, 0], depth: 1 },
        { type: "account", label: "ログアカウント", from: [6, 0], to: [6, 0], depth: 1 },
        { type: "account", label: "監査アカウント", from: [6, 1], to: [6, 1], depth: 1 },
        { type: "account", label: "本番アカウント", from: [2, 2], to: [2, 2], depth: 1 },
        { type: "account", label: "開発アカウント", from: [4, 2], to: [4, 2], depth: 1 }
      ],
      nodes: [
        { id: "admin", icon: "resources/user", label: "管理者", col: 0, row: 1 },
        { id: "org", icon: "services/organizations", label: "Organizations\nOU・SCP統制", col: 2, row: 0 },
        { id: "iam", icon: "services/iam", label: "IAM\n権限の統制", col: 3, row: 0 },
        { id: "ct", icon: "services/cloudtrail", label: "CloudTrail\n組織証跡", col: 4, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n証跡ログ集約", col: 6, row: 0 },
        { id: "gd", icon: "services/guardduty", label: "GuardDuty\n脅威検知集約", col: 6, row: 1 },
        { id: "prod", icon: "services/ec2", label: "本番環境\nワークロード", col: 2, row: 2 },
        { id: "dev", icon: "services/ec2", label: "開発環境\nワークロード", col: 4, row: 2 }
      ],
      edges: [
        { from: "admin", to: "org", label: "統制ルール定義" },
        { from: "iam", to: "org", noArrow: true, dashed: true },
        { from: "org", to: "prod", label: "SCP適用", dashed: true },
        { from: "org", to: "dev", dashed: true },
        { from: "prod", to: "ct", label: "操作を記録", dashed: true },
        { from: "dev", to: "ct", dashed: true },
        { from: "ct", to: "s3", label: "ログを保管" },
        { from: "prod", to: "gd", label: "脅威を検知", dashed: true },
        { from: "dev", to: "gd", dashed: true }
      ]
    },
    flow: [
      "管理者は管理アカウントのOrganizationsで、本番・開発などのアカウントをOU（組織単位＝アカウントをまとめるフォルダ）に整理し、SCP（サービスコントロールポリシー）でガードレールを定義する",
      "SCPは配下の全アカウントに自動適用され、禁止した操作（例：証跡の停止、未許可リージョンの利用）は各アカウントの管理者権限でも実行できなくなる",
      "各アカウントでのAPI操作はCloudTrailの組織証跡として自動記録され、ログ専用アカウントのS3バケットに集約保管される",
      "GuardDutyが各アカウントの脅威（不審なAPI呼び出しや漏えいした認証情報の悪用など）を検知し、結果は監査アカウントに集約されて1画面で監視できる"
    ],
    services: [
      { icon: "services/organizations", name: "AWS Organizations", role: "複数アカウントを1つの組織として管理。OUによる階層化・SCPによるガードレール・請求の一元化を提供" },
      { icon: "services/iam", name: "AWS IAM", role: "各アカウント内の権限管理。SCPが「してよいことの上限」、IAMが「実際に誰へ何を許可するか」という役割分担" },
      { icon: "services/cloudtrail", name: "AWS CloudTrail", role: "誰がいつどのAPIを呼んだかの証跡。組織証跡を1つ作れば全アカウント分がまとめて記録される" },
      { icon: "services/s3", name: "Amazon S3", role: "証跡ログの集約保管先。ログ専用アカウントに置き、他アカウントからは消せないようにする" },
      { icon: "services/guardduty", name: "Amazon GuardDuty", role: "機械学習ベースの脅威検知。委任管理者アカウントに全アカウントの検知結果を集約する" }
    ],
    points: [
      "環境の分離は「アカウント分離」が最も強い。IAMやタグによる分離は設定ミス1つで破れるが、アカウント境界は明示的に許可しない限りデフォルトで遮断される",
      "証跡ログはワークロードと別の「ログアカウント」に置く。本番アカウントが侵害されても、攻撃者は自分の痕跡（ログ）を消せない",
      "SCPは権限を与えるものではなく上限を切るガードレール。実際の権限は各アカウントのIAMで付与する、という二段構えを理解するのがこのパターンの肝",
      "この構成（Landing Zoneと呼ばれる）を自動セットアップするAWS Control Towerというサービスもあり、新規に始めるならまず検討するとよい"
    ],
    pros: [
      "事故・侵害の影響範囲（爆発半径）がアカウント単位に閉じ込められ、開発の事故が本番に波及しない",
      "ガードレールが全アカウントに自動で効き、統制が人力チェックに依存しない",
      "証跡と脅威検知が一元化され、監査対応・インシデント調査が速い",
      "アカウント単位で請求が自然に分かれ、コストの持ち主が明確になる"
    ],
    cons: [
      "OU設計・アカウント間ネットワークなど初期設計の論点が多く、学習コストが高い",
      "アカウントをまたぐアクセス（クロスアカウントロール）の理解が必須になる",
      "GuardDutyなどセキュリティサービスの費用がアカウント数に比例して増える"
    ],
    cost: "<strong>月1,000円〜1万円程度</strong>（アカウント5個の想定。Organizations・SCP・一括請求は無料。CloudTrail組織証跡はS3保管料が月数百円規模から、GuardDutyは各アカウントの分析対象イベント量に応じてアカウントあたり月数百円〜数千円）。",
    references: [
      { title: "AWS Organizationsとは", url: "https://docs.aws.amazon.com/ja_jp/organizations/latest/userguide/orgs_introduction.html", note: "Organizations公式ユーザーガイド" },
      { title: "サービスコントロールポリシー（SCP）", url: "https://docs.aws.amazon.com/ja_jp/organizations/latest/userguide/orgs_manage_policies_scps.html", note: "ガードレールの中心機能" },
      { title: "組織の証跡を作成する", url: "https://docs.aws.amazon.com/ja_jp/awscloudtrail/latest/userguide/creating-trail-organization.html", note: "CloudTrail組織証跡の公式手順" },
      { title: "GuardDutyの複数アカウント管理", url: "https://docs.aws.amazon.com/ja_jp/guardduty/latest/ug/guardduty_accounts.html", note: "委任管理者への集約方法" },
      { title: "Organizing Your AWS Environment Using Multiple Accounts", url: "https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html", note: "OU設計の公式ホワイトペーパー（英語）" }
    ]
  },
  alternatives: [
    {
      name: "単一アカウント＋タグ・IAMで論理分離",
      when: "利用者が数人規模で、アカウントを増やす管理の手間をかけられない・まず小さく始めたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "account", label: "単一アカウント", from: [2, 0], to: [4, 1], depth: 1 }
        ],
        nodes: [
          { id: "admin", icon: "resources/user", label: "管理者・開発者", col: 0, row: 0 },
          { id: "iam", icon: "services/iam", label: "IAM\nタグ条件で制御", col: 2, row: 0 },
          { id: "ct", icon: "services/cloudtrail", label: "CloudTrail\n操作証跡", col: 4, row: 0 },
          { id: "prod", icon: "services/ec2", label: "本番リソース\nenv=prod", col: 3, row: 1 },
          { id: "dev", icon: "services/ec2", label: "開発リソース\nenv=dev", col: 4, row: 1 }
        ],
        edges: [
          { from: "admin", to: "iam", label: "ログイン" },
          { from: "iam", to: "prod", label: "タグで許可判定", dashed: true },
          { from: "iam", to: "dev", dashed: true },
          { from: "prod", to: "ct", label: "操作を記録", dashed: true },
          { from: "dev", to: "ct", dashed: true }
        ]
      },
      flow: [
        "すべてのリソースを1アカウントに置き、env=prod／env=devのようなタグで環境を区別する",
        "IAMポリシーの条件（Condition）でタグを参照し、「開発者はenv=devのリソースだけ操作できる」のように制御する（ABAC＝属性ベースアクセス制御と呼ぶ）",
        "CloudTrailで全操作を記録し、問題が起きたときに誰の操作かを追跡する"
      ],
      services: [
        { icon: "services/iam", name: "AWS IAM", role: "タグ条件付きポリシーで環境別のアクセス制御を実現する。この案の統制の要" },
        { icon: "services/cloudtrail", name: "AWS CloudTrail", role: "操作証跡の記録。単一アカウントでも必ず有効化する" },
        { icon: "services/ec2", name: "タグ付きリソース群", role: "EC2などの各リソースにenvタグを付け、環境の所属を表す" }
      ],
      points: [
        "タグの付け忘れ・誤りがそのままセキュリティホールになる。IaC（インフラのコード管理）やタグポリシーでタグ付けを強制する仕組みが前提",
        "請求もコスト配分タグで環境別に集計できるが、集計の正しさはタグ運用の徹底度に依存する",
        "人数・リソースが増えるとポリシーが複雑化して限界が来る。その時のアカウント分離に備え、リソースをIaC化しておくと移行が楽になる"
      ],
      pros: [
        "管理対象が1アカウントで、クロスアカウントの知識が不要",
        "追加費用がほぼゼロで今日から始められる",
        "小規模のうちは把握しやすい"
      ],
      cons: [
        "分離の強度がIAM設定の正しさに依存し、設定ミス1つで本番に触れてしまう",
        "サービスクォータ（アカウント単位の上限）を本番と開発で食い合う",
        "証跡はあっても「開発の事故が本番に波及しない」保証はない"
      ],
      cost: "<strong>月数十円〜数百円程度</strong>（CloudTrailの1つ目の証跡は管理イベントの記録が無料でS3保管料のみ。GuardDutyを有効化しても小規模なら月数百円規模から）。",
      references: [
        { title: "ABAC（属性ベースのアクセス制御）とは", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/introduction_attribute-based-access-control.html", note: "タグ条件による制御の公式解説" },
        { title: "タグ付けのベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/tagging-best-practices/tagging-best-practices.html", note: "公式ホワイトペーパー" },
        { title: "CloudTrailとは", url: "https://docs.aws.amazon.com/ja_jp/awscloudtrail/latest/userguide/cloudtrail-user-guide.html" }
      ]
    },
    {
      name: "一括請求だけの軽量マルチアカウント",
      when: "統制よりもまず請求と環境の分離だけを実現したい・ガードレール整備は後回しでよい場合",
      diagram: {
        cols: 4, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 2] },
          { type: "account", label: "管理アカウント", from: [1, 1], to: [1, 1], depth: 1 },
          { type: "account", label: "本番アカウント", from: [3, 0], to: [3, 0], depth: 1 },
          { type: "account", label: "開発アカウント", from: [3, 2], to: [3, 2], depth: 1 }
        ],
        nodes: [
          { id: "admin", icon: "resources/user", label: "経理・管理者", col: 0, row: 1 },
          { id: "org", icon: "services/organizations", label: "Organizations\n一括請求のみ", col: 1, row: 1 },
          { id: "prod", icon: "services/ec2", label: "本番環境", col: 3, row: 0 },
          { id: "dev", icon: "services/ec2", label: "開発環境", col: 3, row: 2 }
        ],
        edges: [
          { from: "admin", to: "org", label: "請求を確認" },
          { from: "org", to: "prod", label: "請求を集約", dashed: true },
          { from: "org", to: "dev", dashed: true }
        ]
      },
      flow: [
        "アカウント自体は本番・開発で分けるが、Organizationsは一括請求（コンソリデーティッドビリング）の機能だけを使う",
        "各アカウントの利用料は管理アカウントに合算され、ボリューム割引や無料枠の集計も組織単位でまとまる",
        "権限管理・証跡・脅威検知は各アカウントが個別に設定・運用する"
      ],
      services: [
        { icon: "services/organizations", name: "AWS Organizations（一括請求モード）", role: "請求の合算とアカウント作成だけを担う。SCPなどの統制機能は使わない" },
        { icon: "services/ec2", name: "各アカウントのワークロード", role: "本番・開発をアカウント単位で分離。中身の設定は各アカウント任せ" }
      ],
      points: [
        "アカウントを分けるだけでも「事故の影響範囲の分離」という最大の効果は得られる。統制なしでも同居よりはるかに安全",
        "後からOrganizationsの「すべての機能」を有効化すれば、SCP・組織証跡ありの推奨構成へ段階的に進化できる",
        "各アカウントの設定品質がバラつきやすいので、最低限CloudTrailの有効化だけは全アカウントのルールにしておく"
      ],
      pros: [
        "導入が最も簡単で、既存アカウントの招待だけでも始められる",
        "請求がアカウント別に自動で分かれ、割引・無料枠は組織で共有できる",
        "将来の本格統制（推奨構成）への足がかりになる"
      ],
      cons: [
        "ガードレール（SCP）がなく、危険な操作を仕組みで止められない",
        "証跡・脅威検知がアカウント個別のままで、監査時に全アカウントを回る羽目になる",
        "アカウントが増えるほど「統制なしの分散」の管理コストが膨らむ"
      ],
      cost: "<strong>月0円〜</strong>（Organizationsと一括請求は無料。各アカウントで使ったリソースの費用のみ。統制系サービスを使わないぶん推奨構成より安いが、安全性とのトレードオフ）。",
      references: [
        { title: "組織の一括請求（コンソリデーティッドビリング）", url: "https://docs.aws.amazon.com/ja_jp/awsaccountbilling/latest/aboutv2/consolidated-billing.html", note: "請求合算の公式解説" },
        { title: "AWS Organizationsとは", url: "https://docs.aws.amazon.com/ja_jp/organizations/latest/userguide/orgs_introduction.html", note: "一括請求のみ／すべての機能、の2モードの説明" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1,000円〜1万円程度</strong>（アカウント5個・組織証跡＋GuardDuty集約）。統制系サービスは従量課金なので、アカウントを分けること自体に固定費はほぼかからない。単一アカウント＋タグ運用は<strong>月数十円〜数百円</strong>と最安だが、分離の強度が運用の正しさ頼みになる。一括請求のみの案は<strong>月0円〜</strong>で、費用よりも「統制がない」ことのリスクを理解して選ぶ。</p>",
  summary: "<p>マルチアカウントの本質は「<strong>分けること自体が最強のセキュリティ境界</strong>」という点です。Organizations＋SCP＋組織証跡＋GuardDuty集約は、AWSが公式に推奨するLanding Zone型の標準構成で、Control Towerを使えば自動構築もできます。一方で少人数・小規模ならタグ＋IAMの論理分離や一括請求のみの軽量案から始める判断も現実的です。「いつアカウントを分けるべきか」の目安は、本番と開発の同居が怖くなったとき・監査要件が出たとき、と覚えておきましょう。</p>"
});
