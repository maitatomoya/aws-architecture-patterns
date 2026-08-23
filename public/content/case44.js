// ケース44：IaCと環境分離（dev/stg/prod）
registerCase({
  id: 44,
  category: "運用・セキュリティ・信頼性",
  title: "IaCと環境分離（dev/stg/prod）",
  scenario: "<p>Webサービスの開発環境（dev）・検証環境（stg）・本番環境（prod）を運用している。これまで各環境をコンソールから手作業で作ってきたため、「stgでは動くのにprodで動かない」という環境差異のトラブルが頻発し、検証環境の意味が薄れてきた。3環境を同じ構成で確実に揃え、環境ごとの設定値の違い（DB接続先など）だけを安全に管理したい。誤ってdev作業のつもりでprodを触ってしまう事故も防ぎたい。</p>",
  requirements: [
    "dev/stg/prodを同じ構成で作り、環境差異をなくしたい",
    "インフラの変更はコードレビューを通してから反映したい",
    "環境ごとに異なる設定値（接続先・サイズ等）を安全に管理したい",
    "本番環境を誤操作から守りたい（devのつもりでprodを触る事故の防止）",
    "新しい環境（負荷試験用など）を短時間で複製できるようにしたい"
  ],
  main: {
    name: "CloudFormation + Organizations + Systems Manager（環境別アカウント分離）",
    diagram: {
      cols: 5, rows: 3,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 2] },
        { type: "account", label: "管理アカウント", from: [2, 0], to: [2, 2], depth: 1 },
        { type: "account", label: "devアカウント", from: [4, 0], to: [4, 0], depth: 1 },
        { type: "account", label: "stgアカウント", from: [4, 1], to: [4, 1], depth: 1 },
        { type: "account", label: "prodアカウント", from: [4, 2], to: [4, 2], depth: 1 }
      ],
      nodes: [
        { id: "dev", icon: "resources/client", label: "開発者\nテンプレート管理", col: 0, row: 1 },
        { id: "org", icon: "services/organizations", label: "Organizations\nアカウント統制", col: 2, row: 0 },
        { id: "cfn", icon: "services/cloudformation", label: "CloudFormation\nStackSets", col: 2, row: 1 },
        { id: "ssm", icon: "services/systems-manager", label: "Systems Manager\nParameter Store", col: 2, row: 2 },
        { id: "stkdev", icon: "services/cloudformation", label: "dev環境\nスタック", col: 4, row: 0 },
        { id: "stkstg", icon: "services/cloudformation", label: "stg環境\nスタック", col: 4, row: 1 },
        { id: "stkprd", icon: "services/cloudformation", label: "prod環境\nスタック", col: 4, row: 2 }
      ],
      edges: [
        { from: "dev", to: "cfn", label: "テンプレート" },
        { from: "org", to: "cfn", label: "組織連携", dashed: true, noArrow: true },
        { from: "cfn", to: "stkdev", label: "dev展開" },
        { from: "cfn", to: "stkstg", label: "stg展開" },
        { from: "cfn", to: "stkprd", label: "prod展開" },
        { from: "cfn", to: "ssm", label: "パラメータ参照", dashed: true }
      ]
    },
    flow: [
      "開発者はインフラ構成を1つのCloudFormationテンプレート（インフラの設計図となるコード）としてGitで管理し、変更はコードレビューを経て反映する",
      "Organizationsでdev/stg/prodを別々のAWSアカウントとして管理する。アカウント自体が壁になるため、devの操作がprodに届くことは構造的にない",
      "CloudFormation StackSets（複数アカウントへスタックを一括配布するしくみ）が、同じテンプレートを3アカウントへ展開する",
      "環境ごとに異なる値（インスタンスサイズ・接続先など）はSystems ManagerのParameter Storeに環境別の名前で保存し、テンプレートから動的参照で読み込む",
      "各アカウントには同一構成のスタックができあがり、「環境差異」はパラメータの差だけに閉じ込められる"
    ],
    services: [
      { icon: "services/cloudformation", name: "AWS CloudFormation", role: "インフラをコードで宣言的に管理。StackSetsで複数アカウントへの一括展開とロールバックを担う" },
      { icon: "services/organizations", name: "AWS Organizations", role: "複数アカウントの一元管理。請求をまとめ、SCP（組織全体の禁止ルール）でガードレールも敷ける" },
      { icon: "services/systems-manager", name: "AWS Systems Manager", role: "Parameter Storeに環境別の設定値を階層的に保存。テンプレートやアプリから名前で参照する" },
      { icon: "services/iam", name: "AWS IAM", role: "環境アカウントへのアクセス権を役割別に制御。prodは閲覧のみ、など環境ごとに権限を変えられる" }
    ],
    points: [
      "環境分離の最強の壁は「アカウント分離」。IAMポリシーの書き分けで守るより、そもそも別アカウントにする方が誤操作・侵害の波及を構造的に断てる。請求も環境別に自動で分かれる",
      "テンプレートは1つ、差分はパラメータのみ、という規律が本質。環境ごとにテンプレートを分けると手作業時代と同じ差異問題が再発する",
      "パラメータは/myapp/prod/db-endpointのような階層名で管理すると、環境の取り違えに気づきやすくIAMでの読み取り制限もかけやすい。秘密値はSecrets Managerとの使い分けを検討する",
      "図では代表して管理アカウントにParameter Storeを1つ描いているが、実務では各環境アカウントに置き、その環境のスタックだけが読める形にするのが基本"
    ],
    pros: [
      "環境差異がパラメータだけに限定され、「stgで動けばprodでも動く」に近づく",
      "アカウント境界により誤操作・セキュリティ侵害の影響範囲が環境内に閉じる",
      "負荷試験用環境などの複製がテンプレートの再展開だけで済む",
      "インフラ変更に履歴とレビューが残り、監査対応にも強くなる"
    ],
    cons: [
      "アカウントが増えるぶん、ログインの切り替えや権限設計など管理の手間が増える",
      "CloudFormationとマルチアカウント運用の学習コストが高く、少人数だと導入負荷が大きい",
      "既存の手作業環境をテンプレートに起こす初期移行が大変（一度に全部やらず段階的に進めるのが現実的）"
    ],
    cost: "<strong>月0円〜数百円程度</strong>（管理のしくみ自体の費用）。CloudFormation・Organizations・IAMは追加料金なし、Parameter Storeも標準パラメータは無料。費用はテンプレートが作る各環境のリソース（EC2・RDS等）に対してのみ発生する。つまりこの構成の導入コストは「お金」ではなく「学習と移行の手間」。",
    references: [
      { title: "CloudFormation StackSetsとは", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/what-is-cfnstacksets.html", note: "複数アカウントへの一括展開のしくみ" },
      { title: "AWS Organizationsとは", url: "https://docs.aws.amazon.com/ja_jp/organizations/latest/userguide/orgs_introduction.html" },
      { title: "AWS Systems Manager Parameter Store", url: "https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/systems-manager-parameter-store.html" },
      { title: "AWS環境の組織化（ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html", note: "マルチアカウント設計の公式指針" }
    ]
  },
  alternatives: [
    {
      name: "単一アカウント内で環境分離（タグ・命名規則）",
      when: "個人開発や小規模チームで、マルチアカウント管理の手間をまだかけられない場合",
      diagram: {
        cols: 4, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 2] },
          { type: "account", label: "単一アカウント", from: [2, 0], to: [3, 2], depth: 1 },
          { type: "generic", label: "dev環境", from: [3, 0], to: [3, 0], depth: 2 },
          { type: "generic", label: "stg環境", from: [3, 1], to: [3, 1], depth: 2 },
          { type: "generic", label: "prod環境", from: [3, 2], to: [3, 2], depth: 2 }
        ],
        nodes: [
          { id: "dev", icon: "resources/client", label: "開発者\nテンプレート管理", col: 0, row: 1 },
          { id: "ssm", icon: "services/systems-manager", label: "Parameter Store\n環境別の名前空間", col: 2, row: 0 },
          { id: "cfn", icon: "services/cloudformation", label: "CloudFormation\n環境別スタック", col: 2, row: 1 },
          { id: "stkdev", icon: "services/cloudformation", label: "dev用\nスタック", col: 3, row: 0 },
          { id: "stkstg", icon: "services/cloudformation", label: "stg用\nスタック", col: 3, row: 1 },
          { id: "stkprd", icon: "services/cloudformation", label: "prod用\nスタック", col: 3, row: 2 }
        ],
        edges: [
          { from: "dev", to: "cfn", label: "デプロイ" },
          { from: "cfn", to: "ssm", dashed: true, noArrow: true },
          { from: "cfn", to: "stkdev", label: "dev展開" },
          { from: "cfn", to: "stkstg", label: "stg展開" },
          { from: "cfn", to: "stkprd", label: "prod展開" }
        ]
      },
      flow: [
        "1つのAWSアカウントの中に、同じテンプレートからdev用・stg用・prod用の3スタックを作る",
        "リソース名は「myapp-prod-db」のように環境名を含む命名規則で統一し、全リソースにEnvironment=prodのようなタグを付ける",
        "環境別の設定値はParameter Storeの名前空間（/myapp/dev/…、/myapp/prod/…）で分離する",
        "IAMポリシーでタグや名前のプレフィックスを条件にした権限制御を行い、開発者がprodリソースを変更できないよう制限する"
      ],
      services: [
        { icon: "services/cloudformation", name: "AWS CloudFormation", role: "同一テンプレートから環境別スタックを作成。構成を揃える役割はマルチアカウント構成と同じ" },
        { icon: "services/systems-manager", name: "AWS Systems Manager", role: "Parameter Storeの階層名で環境別の設定値を分離する" },
        { icon: "services/iam", name: "AWS IAM", role: "タグ・命名規則を条件にしたポリシーで環境ごとのアクセスを制御する（ここが最も難しい）" }
      ],
      points: [
        "命名規則とタグは「規約による分離」であり、技術的な壁ではない。ポリシーの書き漏れが1つあればdev権限でprodを消せてしまうことは正直に認識しておく",
        "それでも「同じテンプレートで3環境を作る」だけで手作業構築より大幅に前進する。IaCの習慣づけの第一歩として価値が高い",
        "サービスクォータ（アカウントごとの上限）を3環境で分け合うため、devの負荷試験がprodのリソース作成を妨げる、といった思わぬ干渉が起こり得る",
        "チームや監査要件が育ってきたら推奨構成（アカウント分離）へ移行する。テンプレートを1つに保っていれば移行は展開先を変えるだけで済む"
      ],
      pros: [
        "アカウント管理の手間がなく、すぐ始められる",
        "請求・ログイン・権限の管理が1か所で完結する",
        "テンプレートを維持していれば、後からマルチアカウントへ移行しやすい"
      ],
      cons: [
        "環境の壁がIAMポリシー頼みで、設定ミスがそのまま事故につながる",
        "請求の環境別把握がタグ集計頼みになり、漏れが出やすい",
        "サービスクォータや障害の影響範囲を環境間で分離できない"
      ],
      cost: "<strong>月0円</strong>（分離のしくみ自体は無料）。タグ・命名規則・Parameter Store標準パラメータ・IAMはいずれも追加費用がない。各環境のリソース費用のみが発生する。",
      references: [
        { title: "タグ付けのベストプラクティス（ホワイトペーパー）", url: "https://docs.aws.amazon.com/ja_jp/whitepapers/latest/tagging-best-practices/tagging-best-practices.html", note: "環境タグの設計指針" },
        { title: "AWS Systems Managerとは", url: "https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/what-is-systems-manager.html" },
        { title: "AWS CloudFormationとは", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/Welcome.html" }
      ]
    },
    {
      name: "手動構築の継続（アンチパターンとしての理解）",
      when: "選ぶべき構成ではないが、現状がこれである現場は多い。何が起きるかを知るために学ぶ",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 1] },
          { type: "vpc", label: "dev環境VPC", from: [2, 0], to: [2, 0], depth: 1 },
          { type: "vpc", label: "prod環境VPC", from: [2, 1], to: [2, 1], depth: 1 }
        ],
        nodes: [
          { id: "ops", icon: "resources/user", label: "担当者\nコンソール操作", col: 0, row: 0 },
          { id: "doc", icon: "resources/documents", label: "秘伝の手順書\n（更新漏れあり）", col: 0, row: 1 },
          { id: "envdev", icon: "services/ec2", label: "dev環境\nEC2一式", col: 2, row: 0 },
          { id: "envprd", icon: "services/ec2", label: "prod環境\nEC2一式", col: 2, row: 1 }
        ],
        edges: [
          { from: "doc", to: "ops", label: "参照", dashed: true },
          { from: "ops", to: "envdev", label: "手作業構築" },
          { from: "ops", to: "envprd", label: "手作業構築" },
          { from: "envdev", to: "envprd", label: "設定乖離", dashed: true, noArrow: true }
        ]
      },
      flow: [
        "担当者が手順書を見ながらマネジメントコンソールで各環境を構築・変更する",
        "急ぎの障害対応などで「とりあえずprodだけ直す」変更が入り、手順書への反映が漏れる",
        "数か月後、devとprodの設定が静かに乖離し、「stgで検証したのにprodで動かない」が起きる",
        "環境を再現できるのは担当者の記憶だけになり、その人の退職・異動が事業リスクになる"
      ],
      services: [
        { icon: "services/ec2", name: "各環境のリソース", role: "コンソールから手作業で作られたEC2等の一式。作った時点の意図がどこにも記録されていない" },
        { icon: "services/cloudformation", name: "（不在の）IaC", role: "この構成に欠けているもの。ドリフト検出機能を使えば手作業変更との差異を検出する第一歩になる" }
      ],
      points: [
        "手動構築の本当のコストは構築時間ではなく「再現できないこと」。障害復旧・環境複製・監査対応のすべてが人の記憶頼みになる",
        "最も危険なのは中途半端な状態。IaC導入後もコンソール手作業を併用すると、テンプレートと実環境がずれて（ドリフト）、IaCへの信頼自体が崩壊する",
        "脱出の現実解は「新規リソースからIaC化」。既存を一気に置き換えず、変更が入るタイミングで少しずつテンプレートに取り込む",
        "個人の学習や使い捨ての検証ならコンソール操作は悪ではない。「複数人で長く運用する環境」に手作業を持ち込むことが問題の本質"
      ],
      pros: [
        "学習コストゼロで今すぐ始められる（だから広まってしまう）",
        "1回きりの検証・学習用途なら最速で目的を達せられる"
      ],
      cons: [
        "環境を再現できず、災害復旧や環境複製が事実上不可能になる",
        "変更の履歴・レビューがなく、障害の原因調査が難航する",
        "環境差異が蓄積し、検証環境の存在意義が失われる",
        "構成知識が属人化し、担当者の異動が事業リスクに直結する"
      ],
      cost: "<strong>ツール費用は月0円だが、実質コストは最も高い</strong>。環境差異による障害対応・再構築の人件費が継続的に発生し、事故1回の損失でIaC導入の学習コストを軽く上回ることが多い。「無料に見えて一番高い」構成。",
      references: [
        { title: "スタックのドリフト検出", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html", note: "手作業変更との乖離を可視化する脱出の第一歩" },
        { title: "AWS CloudFormationとは", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/Welcome.html", note: "移行先となるIaCの基本" }
      ]
    }
  ],
  cost: "<p>3案とも分離のしくみ自体はほぼ<strong>月0円</strong>で、費用が発生するのは各環境の中身（EC2・RDS等）だけ。つまりこのケースは費用ではなく「事故の起きにくさ」と「管理の手間」のトレードオフで選ぶ。アカウント分離は手間が最大だが壁も最強、単一アカウント分離は手軽だが壁はIAM頼み、手動構築はツール費ゼロでも障害・人件費という形で最も高くつく。</p>",
  summary: "<p>環境分離の要点は2つ。<strong>「構成はコードで1つに保ち、環境差はパラメータに閉じ込める」「壁は規約よりアカウント境界のほうが強い」</strong>です。理想はOrganizations+StackSetsによるアカウント分離ですが、小規模なら単一アカウント+タグ分離から始めて、テンプレートさえ維持していれば後から移行できます。逆に手動構築の継続だけは、無料に見えて再現不能・属人化という最も高い代償を払う選択だと覚えておきましょう。</p>"
});
