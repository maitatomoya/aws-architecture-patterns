// ケース48：バックアップ・アーカイブ基盤
registerCase({
  id: 48,
  category: "運用・セキュリティ・信頼性",
  title: "バックアップ・アーカイブ基盤",
  scenario: "<p>受注管理システムをAWSで運用する製造業の情報システム部。EC2のアプリサーバーとRDSのデータベース、S3の帳票ファイルがあるが、バックアップは「担当者が思い出したときにスナップショットを手動取得」という危うい状態。先日、誤操作でテーブルを消してしまい、3日前のデータしか戻せなかった。さらに監査対応で「帳票は7年保管」という要件も判明した。取得漏れが起きない自動バックアップと、安価な長期アーカイブの仕組みを整えたい。</p>",
  requirements: [
    "EC2・RDS・S3のバックアップを自動で確実に取得したい（手動運用を廃止）",
    "バックアップの取得状況を一元管理し、漏れに気づけるようにしたい",
    "誤操作・障害時に前日以前の状態へ復元できること",
    "帳票類は法令・監査対応で7年保管したい（アクセス頻度はほぼゼロ）",
    "長期保管のストレージ費用はできるだけ安くしたい",
    "ランサムウェア対策として、バックアップ自体を消されにくくしたい"
  ],
  main: {
    name: "AWS Backupによる一元バックアップ+Glacierで長期アーカイブ",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [4, 1] },
        { type: "vpc", label: "VPC", from: [0, 1], to: [2, 1], depth: 1 }
      ],
      nodes: [
        { id: "backup", icon: "services/backup", label: "AWS Backup\n計画と保管庫", col: 2, row: 0 },
        { id: "glacier", icon: "services/s3-glacier", label: "低頻度層\n長期アーカイブ", col: 4, row: 0 },
        { id: "ec2", icon: "services/ec2", label: "EC2\nアプリサーバー", col: 0, row: 1 },
        { id: "rds", icon: "services/rds", label: "RDS\nデータベース", col: 2, row: 1 },
        { id: "s3", icon: "services/s3", label: "S3\n帳票ファイル", col: 4, row: 1 }
      ],
      edges: [
        { from: "ec2", to: "backup", label: "EBSを取得" },
        { from: "rds", to: "backup", label: "スナップショット" },
        { from: "s3", to: "backup", label: "バケットを保護" },
        { from: "backup", to: "glacier", label: "低頻度層へ移行" }
      ]
    },
    flow: [
      "AWS Backupにバックアッププラン（毎日2時に取得・35日保持のようなルール）を定義し、タグでEC2・RDS・S3を対象に割り当てる",
      "プランに従ってEC2（EBSボリューム）・RDS・S3のバックアップが自動取得され、バックアップボールト（保管庫）に集まる",
      "取得の成否はAWS Backupのダッシュボードで一覧でき、取りこぼしにすぐ気づける",
      "ライフサイクル設定で、古いバックアップは低頻度アクセスのコールドストレージ層（Glacier相当の安価な保管層）へ自動移行する",
      "復元もAWS Backupの画面から実行する。「どの時点に戻すか」を選ぶだけでよい"
    ],
    services: [
      { icon: "services/backup", name: "AWS Backup", role: "バックアップの計画・実行・保管・復元を一元管理するサービス。サービスごとにバラバラだった運用を1画面に集約する" },
      { icon: "services/ec2", name: "Amazon EC2", role: "保護対象のアプリサーバー。実体はEBSボリュームのスナップショットとして取得される" },
      { icon: "services/rds", name: "Amazon RDS", role: "保護対象のデータベース。スナップショットに加え、直前の時点へ戻すポイントインタイム復元も使える" },
      { icon: "services/s3", name: "Amazon S3", role: "保護対象の帳票ファイル置き場。S3もAWS Backupの保護対象にできる" },
      { icon: "services/s3-glacier", name: "S3 Glacier（コールドストレージ層）", role: "めったに取り出さないデータ向けの超低価格保管層。7年保管のような長期アーカイブの主役" }
    ],
    points: [
      "バックアップ運用の失敗の大半は「取得漏れ」と「復元試験をしていない」の2つ。AWS Backupは前者を仕組みで防ぐ。後者は四半期に1回の復元訓練をカレンダーに入れて防ぐ",
      "AWS BackupはVPCの外のマネージドサービス。バックアップ用のサーバーやスクリプトを一切持たなくてよい。図にインターネットゲートウェイが無いのは、ユーザー向け通信ではなくバックアップの流れだけを描いているため",
      "ボールトロック機能を使うと、指定期間はバックアップを誰も（管理者でも）削除できなくなる。ランサムウェア（データを人質に身代金を要求する攻撃）がバックアップごと消しに来る手口への対策になる",
      "Glacier層は保管が激安な代わりに取り出しに時間と費用がかかる。「毎月見るデータ」を入れる場所ではなく、頻度で保管先を分けるのが設計の肝"
    ],
    pros: [
      "EC2・RDS・S3のバックアップをタグ付けだけで自動化でき、取得漏れがなくなる",
      "取得状況・保持期間・復元を1画面で管理でき、監査説明もしやすい",
      "コールド層への自動移行で長期保管コストを大幅に下げられる",
      "ボールトロックでバックアップ自体を改ざん・削除から守れる"
    ],
    cons: [
      "バックアップストレージ容量に応じた費用が継続的にかかる",
      "細かい制御（アプリの静止点を取ってから取得等）は前後処理の作り込みが必要",
      "復元の所要時間はデータ量次第。RTO（目標復旧時間）が厳しい場合はDR設計（ケース49）が別途必要"
    ],
    cost: "<strong>月3,000円〜1.5万円程度</strong>（EC2数台＋RDS数百GB＋S3帳票の中小規模想定。費用の中心はバックアップストレージ容量で、EBSスナップショット約0.05USD/GB月、コールド層は約0.01USD/GB月以下。世代数と保持期間を欲張るほど増えるため、「日次35日＋月次7年」のように層を分けるのが節約の定石）",
    references: [
      { title: "AWS Backupとは", url: "https://docs.aws.amazon.com/ja_jp/aws-backup/latest/devguide/whatisbackup.html", note: "対応サービスと全体像" },
      { title: "バックアッププランの作成", url: "https://docs.aws.amazon.com/ja_jp/aws-backup/latest/devguide/creating-a-backup-plan.html", note: "スケジュール・保持期間・コールド層移行の設定" },
      { title: "AWS Backup Vault Lock", url: "https://docs.aws.amazon.com/ja_jp/aws-backup/latest/devguide/vault-lock.html", note: "バックアップの削除防止（ランサムウェア対策）" },
      { title: "Amazon EBSスナップショット", url: "https://docs.aws.amazon.com/ja_jp/ebs/latest/userguide/ebs-snapshots.html", note: "EC2バックアップの実体を理解する" },
      { title: "RDSの自動バックアップ", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html", note: "ポイントインタイム復元の仕組み" }
    ]
  },
  alternatives: [
    {
      name: "S3ライフサイクル+クロスリージョンレプリケーション",
      when: "守る対象がほぼS3のファイルだけ・リージョン障害にも備えたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "region", label: "東京リージョン", from: [2, 0], to: [3, 1], depth: 1 },
          { type: "region", label: "大阪リージョン", from: [4, 0], to: [4, 1], depth: 1 }
        ],
        nodes: [
          { id: "app", icon: "resources/client", label: "業務システム", col: 0, row: 0 },
          { id: "s3a", icon: "services/s3", label: "S3\n本体バケット", col: 2, row: 0 },
          { id: "glacier", icon: "services/s3-glacier", label: "Glacier層\n7年アーカイブ", col: 3, row: 1 },
          { id: "s3b", icon: "services/s3", label: "S3\n複製バケット", col: 4, row: 0 }
        ],
        edges: [
          { from: "app", to: "s3a", label: "データ保存" },
          { from: "s3a", to: "glacier", label: "ライフサイクル移行" },
          { from: "s3a", to: "s3b", label: "リージョン間複製" }
        ]
      },
      flow: [
        "業務システムは東京リージョンのS3バケットにファイルを保存する。バージョニングを有効にして、上書き・削除しても旧版を残す",
        "ライフサイクルルールで「90日経過したらGlacier層へ、7年経過したら削除」のように保管層の移行と廃棄を自動化する",
        "クロスリージョンレプリケーションで大阪リージョンのバケットへ自動複製し、リージョン全体の障害や誤削除に備える"
      ],
      services: [
        { icon: "services/s3", name: "Amazon S3（バージョニング）", role: "本体の保管先。バージョニングは「上書き・削除の取り消し」ができる実質的なバックアップ機能" },
        { icon: "services/s3-glacier", name: "S3 Glacierストレージクラス", role: "ライフサイクルの移行先。アクセスしない古いデータの保管費用を約5分の1以下にする" },
        { icon: "services/s3", name: "Amazon S3（複製先バケット）", role: "別リージョンの複製。災害・誤操作の同時被害を避ける物理的に離れたコピー" }
      ],
      points: [
        "S3は標準で高耐久（イレブンナイン）だが、それは「壊れない」であって「消し間違いから守ってくれる」ではない。バージョニングと別リージョン複製が人為ミス対策になる",
        "レプリケーションは削除も伝播し得るため、複製先でもバージョニングを有効にし、オブジェクトロック（一定期間削除不可にする機能）を併用すると安全度が上がる",
        "この構成はS3だけで完結する分シンプルだが、EC2・RDSは守れない。サーバーやDBがあるなら推奨構成と組み合わせる",
        "ライフサイクルの「何日でどの層へ」は取り出し頻度で決める。取り出しが多いのに深い層へ入れると、取り出し料金で逆に高くつく"
      ],
      pros: [
        "S3の標準機能だけで完結し、追加のサービス学習が最小で済む",
        "リージョン障害という最大級の災害にも備えられる",
        "ライフサイクルで保管費用の最適化と廃棄（保持期限管理）まで自動化できる"
      ],
      cons: [
        "EC2・RDSのバックアップは別途必要（この構成だけでは片手落ち）",
        "複製はほぼリアルタイムのため、壊れたデータも即複製される。世代を持つバージョニングとの併用が前提",
        "複製先ストレージとリージョン間転送の費用が二重にかかる"
      ],
      cost: "<strong>月1,000円〜1万円程度</strong>（帳票数百GB想定。本体＋複製先の保管料と、リージョン間転送約0.09USD/GBが主。Glacier層へ落とした分は約0.0045USD/GB月まで下がるため、古いデータが多いほど効果が大きい）",
      references: [
        { title: "S3ライフサイクルによるストレージ管理", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/object-lifecycle-mgmt.html", note: "保管層の自動移行と有効期限の設定" },
        { title: "S3オブジェクトのレプリケーション", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/replication.html", note: "クロスリージョンレプリケーションの公式ガイド" },
        { title: "S3 Glacierストレージクラス", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/glacier-storage-classes.html", note: "3種類のGlacier層と取り出し時間の違い" }
      ]
    },
    {
      name: "自前スクリプトによるバックアップ運用（アンチパターン気味）",
      when: "歴史的にcron運用が残っている場合。新規採用は非推奨だが、なぜ壊れやすいかは知っておく価値がある",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 1], depth: 1 }
        ],
        nodes: [
          { id: "admin", icon: "resources/user", label: "担当者", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "job", icon: "services/ec2", label: "EC2\ncron+スクリプト", col: 3, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nバックアップ対象", col: 3, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nダンプ保管", col: 1, row: 1 }
        ],
        edges: [
          { from: "admin", to: "igw", label: "SSHで保守" },
          { from: "igw", to: "job" },
          { from: "job", to: "rds", label: "ダンプ取得" },
          { from: "job", to: "s3", label: "S3へ転送" }
        ]
      },
      flow: [
        "EC2上のcron（指定時刻にコマンドを自動実行する仕組み）が毎晩バックアップスクリプトを起動する",
        "スクリプトがRDSからダンプ（データベース内容のファイル書き出し）を取得し、S3へ転送する",
        "担当者はインターネットゲートウェイ経由でSSH接続し、スクリプトの保守やエラー時の再実行を行う"
      ],
      services: [
        { icon: "services/ec2", name: "Amazon EC2（cronサーバー）", role: "スクリプトの実行基盤。このサーバー自体が新たな管理対象かつ単一障害点になる" },
        { icon: "services/rds", name: "Amazon RDS", role: "バックアップ対象。ダンプ取得中はDBに負荷がかかる" },
        { icon: "services/s3", name: "Amazon S3", role: "ダンプファイルの保管先。世代管理・暗号化・削除防止はすべて自作になる" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "担当者が保守用にVPCへ入るための入口。管理経路が増えること自体もリスク" }
      ],
      points: [
        "壊れやすい理由1：失敗に気づけない。cronは失敗しても黙って翌日を待つ。通知の作り込みを忘れると「数か月間バックアップが取れていなかった」が起きる（現場で最も多い事故）",
        "壊れやすい理由2：cronサーバー自体が単一障害点で、そのサーバーのバックアップは誰も取っていないことが多い",
        "壊れやすい理由3：スクリプトが属人化する。書いた人の退職後、誰も直せない秘伝のタレになりやすい",
        "既にこの運用がある場合は、まずAWS Backupへ「取得」を移し、スクリプトは廃止していくのが安全な移行順序"
      ],
      pros: [
        "取得タイミングや形式（論理ダンプ等）を完全に自由に制御できる",
        "特定テーブルだけ・アプリ静止後に取得など、特殊要件には対応しやすい",
        "既存のオンプレ運用ノウハウをそのまま持ち込める"
      ],
      cons: [
        "失敗検知・リトライ・世代管理・削除防止をすべて自作・保守し続ける必要がある",
        "cronサーバーの常時起動費と保守（OS更新・監視）が追加でかかる",
        "属人化しやすく、監査に「確実に取得されている根拠」を示しにくい",
        "復元手順もスクリプト依存になり、いざという時に動かないリスクが高い"
      ],
      cost: "<strong>月2,000円〜8,000円程度</strong>（t3.small相当のcronサーバー常時起動＋S3保管料。金額自体は安く見えるが、スクリプト保守と障害対応の人件費が隠れコストとして乗る点に注意）",
      references: [
        { title: "AWS Backupとは", url: "https://docs.aws.amazon.com/ja_jp/aws-backup/latest/devguide/whatisbackup.html", note: "自前運用からの移行先として比較する" },
        { title: "RDSの自動バックアップ", url: "https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html", note: "ダンプ自作より先に検討すべき標準機能" }
      ]
    }
  ],
  cost: "<p>推奨構成（AWS Backup+コールド層）は中小規模で<strong>月3,000円〜1.5万円程度</strong>。S3中心のライフサイクル+複製案は<strong>月1,000円〜1万円程度</strong>だがS3しか守れない。自前スクリプト案は<strong>月2,000円〜8,000円程度</strong>と一見安いが、保守・障害対応の人件費と「取れていなかった」事故のリスクが隠れコストになる。どの案でもストレージ費用は保持世代数に比例するため、「何日分・何年分を残すか」を先に決めることが最大のコスト設計になる。</p>",
  summary: "<p>バックアップ設計の本質は「自動で取る・漏れに気づく・戻せることを確認する」の3点です。<strong>AWS Backupを使えば取得と一元管理を仕組みに任せられ、手動・cron運用の最大の敵である「静かな失敗」を排除できます</strong>。長期保管はアクセス頻度で層を分け、Glacier系のコールドストレージで費用を1桁下げるのが定石です。忘れがちですが、バックアップは「復元できて初めて意味がある」もの。復元訓練を定期イベントにすること、そしてリージョン障害まで想定するなら次のケース49（災害対策）へ進むこと、がこのケースの次の一歩です。</p>",
  quiz: [
    {
      q: "バックアップ運用の失敗は主に2つに集約されるとされています。それぞれ何で、どう防ぐのでしょうか。",
      a: "「取得漏れ」と「復元を試していないこと」の2つです。前者はAWS Backupのプランとタグ割り当てで自動化し、ダッシュボードで成否を一覧できるようにして仕組みで防ぎます。後者は仕組みでは防げないため、四半期に1回など復元訓練を定期イベントとしてカレンダーに入れます。バックアップは復元できて初めて意味があり、取得の自動化だけでは半分しか終わっていません。"
    },
    {
      q: "ボールトロックのように「管理者でも消せない」設定をわざわざ入れるのは、どんな事態を想定しているからでしょうか。",
      a: "ランサムウェアのように、バックアップごと消しに来る攻撃を想定しているためです。管理者権限を奪われた場合、通常の権限設計では復旧の最後の砦であるバックアップまで削除されてしまいます。指定した期間は誰も削除できない状態にしておけば、侵害されても戻れる地点が残ります。証跡をログ専用アカウントに置くケース37の設計と同じ発想です。"
    },
    {
      q: "現場にはすでにcronでダンプを取るスクリプト運用があります。あなたなら何から手をつけますか。",
      a: "まず取得の部分をAWS Backupへ移し、スクリプトは段階的に廃止します。cron運用で最も多い事故は、失敗しても黙って翌日を待つ静かな失敗で、数か月バックアップが取れていなかったと後から判明する類のものだからです。取得を仕組みに載せ替えれば成否が一覧でき、cronサーバーという単一障害点と属人化したスクリプトも同時に減らせます。アプリの静止点を取るなどの特殊要件だけ、前後処理として残す形が現実的です。"
    }
  ]
});
