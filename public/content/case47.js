// ケース47：セキュリティ監視・脅威検知
registerCase({
  id: 47,
  category: "運用・セキュリティ・信頼性",
  title: "セキュリティ監視・脅威検知",
  scenario: "<p>ECサイトを運営する中堅企業。AWS上に本番環境があるが、セキュリティ対策は「WAFを入れた」程度で、不正アクセスや設定ミスに気づく仕組みがない。先日、退職者のアクセスキーが数か月放置されていたことが発覚し、経営層から「怪しい動きを検知して即座に通知される体制を作れ」と指示が出た。専任のセキュリティエンジニアはおらず、開発チーム（3名）が兼任で運用する前提で、できるだけマネージドサービスに任せたい。</p>",
  requirements: [
    "不正アクセスや異常なAPI操作を自動で検知したい",
    "検知したらメールやチャットに即時通知したい（毎日ダッシュボードを見張る運用は不可）",
    "「いつ・誰が・何をしたか」の操作記録を監査用に残したい",
    "EC2の脆弱性（OSやライブラリの穴）も継続的にチェックしたい",
    "専任者なしで回る運用負荷にしたい",
    "追加のサーバーを立てたくない"
  ],
  main: {
    name: "GuardDuty+CloudTrail+Inspector（検知から通知までの自動化）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 1] },
        { type: "vpc", label: "VPC", from: [0, 1], to: [0, 1], depth: 1 }
      ],
      nodes: [
        { id: "ct", icon: "services/cloudtrail", label: "CloudTrail\nAPI操作の記録", col: 0, row: 0 },
        { id: "gd", icon: "services/guardduty", label: "GuardDuty\n脅威検知", col: 1, row: 0 },
        { id: "eb", icon: "services/eventbridge", label: "EventBridge\nイベント振り分け", col: 2, row: 0 },
        { id: "sns", icon: "services/sns", label: "SNS\n通知配信", col: 3, row: 0 },
        { id: "ops", icon: "resources/user", label: "運用担当者", col: 4, row: 0 },
        { id: "ec2", icon: "services/ec2", label: "EC2\n本番サーバー", col: 0, row: 1 },
        { id: "insp", icon: "services/inspector", label: "Inspector\n脆弱性診断", col: 1, row: 1 }
      ],
      edges: [
        { from: "ec2", to: "ct", label: "操作ログ", dashed: true },
        { from: "insp", to: "ec2", label: "脆弱性スキャン" },
        { from: "ct", to: "gd", label: "証跡を分析" },
        { from: "gd", to: "eb", label: "検知イベント" },
        { from: "insp", to: "eb", label: "検出イベント" },
        { from: "eb", to: "sns", label: "ルールで通知へ" },
        { from: "sns", to: "ops", label: "メール/チャット" }
      ]
    },
    flow: [
      "CloudTrailがAWSアカウント内のすべてのAPI操作（コンソール操作・CLI・SDK）を記録し続ける",
      "GuardDutyがCloudTrailの証跡・VPCフローログ・DNSログを機械学習で分析し、「普段と違う怪しい動き」（不正ログイン試行、仮想通貨マイニング通信など）を検知する",
      "InspectorがEC2を継続的にスキャンし、OSやソフトウェアの既知の脆弱性（CVE）を検出する",
      "GuardDutyとInspectorの検知結果はEventBridgeにイベントとして流れ、ルール（重要度が高いものだけ等）に一致したらSNSへ振り分けられる",
      "SNSが運用担当者へメールやチャット連携で即時通知する。人は通知が来たときだけ動けばよい"
    ],
    services: [
      { icon: "services/cloudtrail", name: "AWS CloudTrail", role: "「いつ・誰が・何をしたか」の操作証跡を記録する監査の土台。全ケースの前提となるサービス" },
      { icon: "services/guardduty", name: "Amazon GuardDuty", role: "ログを機械学習で分析する脅威検知サービス。有効化するだけで動き、エージェント導入も不要" },
      { icon: "services/inspector", name: "Amazon Inspector", role: "EC2やコンテナイメージの脆弱性（CVE：公開されている既知のセキュリティ欠陥）を継続診断する" },
      { icon: "services/eventbridge", name: "Amazon EventBridge", role: "検知イベントを受け取り、ルールに従って通知先へ振り分けるイベントバス（イベントの交換台）" },
      { icon: "services/sns", name: "Amazon SNS", role: "メールやチャットツール連携への通知配信。プッシュ型なので見張り不要" },
      { icon: "services/ec2", name: "Amazon EC2", role: "守る対象の本番サーバー。監視サービス群はこの外側から見守る" }
    ],
    points: [
      "GuardDuty・CloudTrail・Inspector・EventBridge・SNSはすべてVPCの外にあるマネージドサービス。監視のためのサーバーを1台も持たないので、監視基盤自体の運用負荷がほぼゼロになる",
      "この図にインターネットゲートウェイが無いのは、ユーザー向け通信ではなく監視の流れだけを描いているため。実際のEC2にはWebアクセス経路（別ケース参照）が別途ある",
      "EventBridgeのルールで「重要度High以上のみ通知」と絞るのが実運用のコツ。全部通知すると狼少年化（通知疲れで誰も見なくなる状態）して形骸化する",
      "CloudTrailの証跡はS3に保管し、削除できない設定（MFA削除保護やログ用アカウント分離）にすると、攻撃者による証拠隠滅にも備えられる"
    ],
    pros: [
      "全サービスが有効化するだけで動くマネージド型。専任者なしでも回る",
      "検知から通知まで自動化され、人は「通知が来たら対応」だけでよい",
      "サーバーレスなので監視基盤自体の保守・スケーリングが不要",
      "後からSecurity HubやSlack連携など段階的に拡張できる"
    ],
    cons: [
      "GuardDutyは「検知」まで。遮断や修復は人または別途自動化（Lambda等）が必要",
      "料金がログ分析量に比例するため、大規模環境では事前見積もりが必要",
      "検知ルールはAWSまかせで、自社固有の業務ルール（深夜の特定操作を禁止等）の検知は苦手"
    ],
    cost: "<strong>月3,000円〜1万円程度</strong>（中小規模の目安。GuardDutyは分析対象ログ量、InspectorはスキャンするEC2台数、CloudTrailは管理イベント1系統無料＋S3保管料の従量課金。EC2数台＋通常のログ量なら数千円に収まることが多い。30日間の無料トライアルで実額を確認してから本採用できる）",
    references: [
      { title: "Amazon GuardDutyとは", url: "https://docs.aws.amazon.com/ja_jp/guardduty/latest/ug/what-is-guardduty.html", note: "脅威検知の仕組みと検知対象の一覧" },
      { title: "AWS CloudTrailとは", url: "https://docs.aws.amazon.com/ja_jp/awscloudtrail/latest/userguide/cloudtrail-user-guide.html", note: "操作証跡の記録の基本" },
      { title: "Amazon Inspectorとは", url: "https://docs.aws.amazon.com/ja_jp/inspector/latest/user/what-is-inspector.html", note: "脆弱性診断の対象と仕組み" },
      { title: "EventBridgeでGuardDutyの検知結果を通知する", url: "https://docs.aws.amazon.com/ja_jp/guardduty/latest/ug/guardduty_findings_cloudwatch.html", note: "検知→通知の自動化はこのページの構成そのもの" },
      { title: "Amazon SNSとは", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "OpenSearchで自前SIEM（ログ横断検索基盤）",
      when: "複数のログを横断検索して調査したい・監査部門から検索可能なログ保管を求められている場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "ct", icon: "services/cloudtrail", label: "CloudTrail", col: 0, row: 0 },
          { id: "gd", icon: "services/guardduty", label: "GuardDuty", col: 0, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nログ集約", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n整形・転送", col: 2, row: 0 },
          { id: "os", icon: "services/opensearch", label: "OpenSearch\n検索・可視化", col: 3, row: 0 },
          { id: "analyst", icon: "resources/user", label: "分析担当者", col: 4, row: 1 }
        ],
        edges: [
          { from: "ct", to: "s3", label: "証跡を出力" },
          { from: "gd", to: "s3", label: "検知結果を出力" },
          { from: "s3", to: "lambda", label: "取り込み" },
          { from: "lambda", to: "os", label: "整形して投入" },
          { from: "analyst", to: "os", label: "横断検索" }
        ]
      },
      flow: [
        "CloudTrailの証跡とGuardDutyの検知結果を、ログ集約用のS3バケットに出力する",
        "S3への到着をきっかけにLambdaが起動し、ログを検索しやすい形に整形してOpenSearchへ投入する",
        "分析担当者はOpenSearchのダッシュボードで「このIPは他に何をしたか」のような横断検索・可視化を行う"
      ],
      services: [
        { icon: "services/s3", name: "Amazon S3", role: "各種ログの集約先。安価に長期保管でき、SIEMの元データ置き場になる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "ログを検索用に整形してOpenSearchに流し込む変換係。サーバーレスで動く" },
        { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "全文検索・可視化エンジン。SIEM（ログを集めて相関分析するセキュリティ基盤）の中核になる" },
        { icon: "services/cloudtrail", name: "AWS CloudTrail", role: "操作証跡の供給元。推奨構成と同じく記録の土台" },
        { icon: "services/guardduty", name: "Amazon GuardDuty", role: "脅威検知の結果もS3経由で集約し、他のログと突き合わせる" }
      ],
      points: [
        "SIEM（Security Information and Event Management）とは、複数のログを1か所に集めて横断検索・相関分析する仕組みのこと。推奨構成の「検知して通知」に対し、こちらは「深掘り調査」に強い",
        "OpenSearchのドメイン（クラスター）は常時起動でサイズ設計・バージョン更新などの運用が発生する。推奨構成より明確に手がかかる点は覚悟する",
        "検索対象期間を直近90日などに絞り、古いログはS3側に残す設計にすると、OpenSearchのストレージ費用を大きく抑えられる",
        "まず推奨構成を入れて、調査業務が増えてきたらこの構成を「追加」するのが現実的な順序。両者は排他ではなく併用が普通"
      ],
      pros: [
        "複数ログの横断検索・可視化ができ、インシデント調査が速くなる",
        "監査要件（ログを検索可能な状態で保管せよ）に応えやすい",
        "検知ルールを自社の業務に合わせて自由に作り込める"
      ],
      cons: [
        "OpenSearchクラスターの設計・運用（サイズ・更新・監視）という新しい仕事が生まれる",
        "常時起動のため月数万円からの固定費がかかる",
        "検索の仕組みを作っただけでは検知は強くならない。ルール整備という継続作業が必要"
      ],
      cost: "<strong>月2万円〜10万円程度</strong>（OpenSearchの小規模ドメイン常時起動＋ストレージが中心。ログ量と保持期間に比例して増える。t3.small.search複数台の最小構成でも月2万円前後は見込む）",
      references: [
        { title: "Amazon OpenSearch Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/what-is.html", note: "検索・可視化基盤の公式ガイド" },
        { title: "GuardDutyの検知結果をS3へエクスポートする", url: "https://docs.aws.amazon.com/ja_jp/guardduty/latest/ug/guardduty_exportfindings.html", note: "検知結果をログ集約に乗せる設定" },
        { title: "Amazon EventBridgeとは", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-what-is.html", note: "取り込みのきっかけ作りにも使える" }
      ]
    },
    {
      name: "最小構成（CloudTrail+IAM強化だけをまずやる）",
      when: "予算も人手も最小で始めたい・まず監査証跡と権限管理という土台を固めたい場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 0] }
        ],
        nodes: [
          { id: "admin", icon: "resources/user", label: "管理者・開発者", col: 0, row: 0 },
          { id: "iam", icon: "services/iam", label: "IAM\nMFA・最小権限", col: 1, row: 0 },
          { id: "ct", icon: "services/cloudtrail", label: "CloudTrail\n全操作を記録", col: 2, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n証跡の保管", col: 3, row: 0 }
        ],
        edges: [
          { from: "admin", to: "iam", label: "MFAで認証" },
          { from: "iam", to: "ct", label: "操作を記録", dashed: true },
          { from: "ct", to: "s3", label: "証跡を保管" }
        ]
      },
      flow: [
        "全利用者にIAMでMFA（多要素認証：パスワードに加えてスマホ等で本人確認する仕組み）を必須化し、権限は業務に必要な最小限だけ与える",
        "CloudTrailの証跡を有効化し、アカウント内の全API操作を記録する",
        "証跡はS3に保管し、事故や不審な挙動があったときに「誰が何をしたか」を遡れる状態を作る"
      ],
      services: [
        { icon: "services/iam", name: "AWS IAM", role: "ユーザー・権限管理。MFA必須化・最小権限・アクセスキーの棚卸しがこの構成の主役" },
        { icon: "services/cloudtrail", name: "AWS CloudTrail", role: "全API操作の証跡記録。無料の管理イベント記録だけでも監査の土台になる" },
        { icon: "services/s3", name: "Amazon S3", role: "証跡の保管先。ライフサイクル設定で保管費用を抑えられる" }
      ],
      points: [
        "セキュリティ事故の多くは高度な攻撃ではなく、漏れたアクセスキーや過剰な権限が原因。まず「入口（認証）と権限」を固めるのは順序として正しい",
        "ルートユーザーは普段使いせず、MFAをかけて金庫にしまう。日常操作はIAMユーザー（またはIAM Identity Center）で行う",
        "この構成は「記録は残るが、誰も監視していない」状態。事故に気づくのは請求書やユーザー報告からになりがち、という限界を理解した上で採用する",
        "GuardDutyの追加は有効化1クリックで済むため、この構成で土台を固めたら早めに推奨構成へ育てるのが現実的なロードマップ"
      ],
      pros: [
        "追加費用ほぼゼロで今日から始められる（CloudTrailの管理イベント1系統は無料）",
        "権限管理の整備は、後からどんな監視を足す場合でも必ず活きる土台になる",
        "覚えるサービスが少なく、初学者チームでも運用できる"
      ],
      cons: [
        "自動検知がないため、不正利用に気づくのが遅れる（記録を見るのは事後）",
        "脆弱性診断がなく、パッチ漏れを検出できない",
        "「検知して通知」の要件そのものは満たせない。あくまで第一歩"
      ],
      cost: "<strong>月0円〜数百円程度</strong>（IAMは無料。CloudTrailは管理イベントの証跡1系統が無料で、S3の証跡保管料が数十円〜数百円かかる程度）",
      references: [
        { title: "IAMのセキュリティベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/best-practices.html", note: "MFA・最小権限・キー管理の公式指針" },
        { title: "CloudTrailのセキュリティベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/awscloudtrail/latest/userguide/best-practices-security.html", note: "証跡の保護・改ざん対策" }
      ]
    }
  ],
  cost: "<p>推奨構成（GuardDuty+Inspector+CloudTrail+通知）は<strong>月3,000円〜1万円程度</strong>から。自前SIEM（OpenSearch）は<strong>月2万円〜10万円程度</strong>と1桁上がり、さらに運用人件費もかかる。最小構成（CloudTrail+IAM強化）は<strong>月0円〜数百円</strong>。「まず最小構成で土台→推奨構成で自動検知→調査需要が増えたらSIEMを併設」と段階的に育てると、費用と効果のバランスが取りやすい。</p>",
  summary: "<p>セキュリティ監視の第一歩は「記録（CloudTrail）と権限（IAM）」、第二歩が「自動検知と通知（GuardDuty+Inspector+EventBridge+SNS）」です。<strong>検知系はすべてVPC外のマネージドサービスで、サーバーを1台も増やさずに有効化だけで始められる</strong>のがAWSの強みです。SIEMのような重い仕組みは、調査・監査の需要が明確になってから足せば遅くありません。「通知が多すぎて誰も見ない」が最大の失敗パターンなので、EventBridgeのルールで重要度を絞ることまで含めて設計と覚えておきましょう。</p>"
});
