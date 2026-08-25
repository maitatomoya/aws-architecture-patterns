// ケース43：CI/CDパイプライン
registerCase({
  id: 43,
  category: "運用・セキュリティ・信頼性",
  title: "CI/CDパイプライン",
  scenario: "<p>ECS上で動くWebアプリを5人のチームで開発している。現在はエンジニアが手元でDockerイメージをビルドし、手順書を見ながら手作業でデプロイしているため、リリースに毎回1時間かかり、手順ミスによる障害も月1回は起きている。コードをpushしたらテスト→ビルド→デプロイまで自動で流れるパイプラインを作り、リリースを「怖い作業」から「日常の作業」に変えたい。</p>",
  requirements: [
    "git pushをきっかけにテスト→ビルド→デプロイまで自動で実行したい",
    "テストが失敗したらデプロイを止めたい（壊れたコードを本番に出さない）",
    "Dockerイメージをバージョン管理し、いつでも前のバージョンに戻せるようにしたい",
    "デプロイ手順を属人化させない（手順書と手作業をなくす）",
    "本番デプロイの直前に人の承認を挟めるようにしたい"
  ],
  main: {
    name: "CodePipeline + CodeBuild + ECR + ECS（AWS完結のCI/CD）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
        { type: "vpc", label: "VPC", from: [3, 1], to: [4, 1], depth: 1 },
        { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
      ],
      nodes: [
        { id: "dev", icon: "resources/client", label: "開発者\ngit push", col: 0, row: 0 },
        { id: "pipeline", icon: "services/codepipeline", label: "CodePipeline\n工程の司令塔", col: 1, row: 0 },
        { id: "build", icon: "services/codebuild", label: "CodeBuild\nテスト・ビルド", col: 2, row: 0 },
        { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 3, row: 0 },
        { id: "ecs", icon: "services/ecs", label: "ECS\n本番アプリ", col: 4, row: 1 }
      ],
      edges: [
        { from: "dev", to: "pipeline", label: "push検知" },
        { from: "pipeline", to: "build", label: "テスト・ビルド" },
        { from: "build", to: "ecr", label: "イメージpush" },
        { from: "pipeline", to: "ecs", label: "デプロイ" },
        { from: "ecr", to: "ecs", label: "イメージ取得" }
      ]
    },
    flow: [
      "開発者がリポジトリにpushすると、CodePipelineが変更を検知してパイプラインを開始する。ソースリポジトリはGitHub等の外部サービスをAWS CodeConnections（外部リポジトリとAWSをつなぐ接続機能）で接続する形が現在の標準（AWS製リポジトリのCodeCommitは新規利用の受付を終了している）",
      "CodeBuildがテストとDockerイメージのビルドを実行する。テストが失敗すればここで停止し、壊れたコードは先に進まない",
      "ビルドされたイメージはECR（Dockerイメージ置き場）にバージョンタグつきで保存される",
      "CodePipelineのデプロイステージがECSのサービスを新イメージに更新する。ECSは新旧タスクを入れ替えるローリング更新で無停止デプロイする",
      "ECSタスクはECRから該当バージョンのイメージを取得して起動する"
    ],
    services: [
      { icon: "services/codepipeline", name: "AWS CodePipeline", role: "ソース取得→ビルド→デプロイの工程全体を定義・実行する司令塔。承認ステージも挟める" },
      { icon: "services/codebuild", name: "AWS CodeBuild", role: "テストとビルドを実行する使い捨てのビルド環境。実行した分だけの課金でビルドサーバーの常時運用が不要" },
      { icon: "services/ecr", name: "Amazon ECR", role: "Dockerイメージのレジストリ。タグでバージョン管理し、脆弱性スキャンも組み込める" },
      { icon: "services/ecs", name: "Amazon ECS", role: "アプリの実行基盤。デプロイ時は新旧タスクを段階的に入れ替えて無停止で更新する" }
    ],
    points: [
      "パイプラインの価値は自動化そのものより「壊れたコードが本番に到達する経路を塞ぐこと」。テスト失敗＝デプロイ停止を機械的に保証するのが核心",
      "本番ステージの直前に承認アクションを入れると、「自動化はするが最後は人が判断する」運用にできる。慣れてきたら承認を外して完全自動化に進めばよい",
      "イメージタグにGitのコミットIDを使うと「本番で動いているコードはどのコミットか」が即答でき、ロールバックも前のタグを指定するだけになる",
      "ECSタスクをプライベートサブネットに置く場合、ECRからのイメージ取得はVPCエンドポイント（AWS内部への専用出口）経由にするとNATゲートウェイの転送費用を節約できる"
    ],
    pros: [
      "ビルド環境含めてフルマネージドで、CIサーバー（Jenkins等）の運用が不要",
      "IAMでAWSリソースへの権限管理が完結し、外部サービスへの認証情報の持ち出しがない",
      "承認ステージ・ロールバックなどリリース統制のしくみを標準機能で組める",
      "実行した分だけの従量課金で、小規模チームでも導入しやすい"
    ],
    cons: [
      "GitHub ActionsなどのモダンなCIに比べ、設定の記述性やエコシステムの豊富さで見劣りする面がある",
      "パイプラインの定義自体が手作業だと属人化するため、IaC（代替パターン2参照）とセットで管理したい",
      "モノレポや複雑なワークフロー（並列マトリクスビルド等）の表現は苦手"
    ],
    cost: "<strong>月数百円〜2,000円程度</strong>（1日10ビルドの場合）。CodePipelineはV2タイプがアクション実行分数課金、CodeBuildは小型インスタンスで1分あたり約0.005USD、ECRは保存1GBあたり月約0.1USD。パイプライン自体の費用は小さく、大半はアプリ実行側（ECS）の費用になる。",
    references: [
      { title: "AWS CodePipelineとは", url: "https://docs.aws.amazon.com/ja_jp/codepipeline/latest/userguide/welcome.html" },
      { title: "AWS CodeBuildとは", url: "https://docs.aws.amazon.com/ja_jp/codebuild/latest/userguide/welcome.html" },
      { title: "Amazon ECRとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/what-is-ecr.html" },
      { title: "チュートリアル：ECRソースとECS間でパイプラインを作成する", url: "https://docs.aws.amazon.com/ja_jp/codepipeline/latest/userguide/tutorials-ecs-ecr-codedeploy.html", note: "この構成に近い公式ハンズオン" },
      { title: "ECRのVPCエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/AmazonECR/latest/userguide/vpc-endpoints.html", note: "工夫点で触れたイメージ取得経路" }
    ]
  },
  alternatives: [
    {
      name: "GitHub Actions + ECR + ECS（外部CIとの組み合わせ）",
      when: "コードがGitHubにあり、PRチェックなど開発フローをGitHub上で完結させたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 1], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "dev", icon: "resources/client", label: "開発者\ngit push", col: 0, row: 0 },
          { id: "gha", icon: "resources/internet", label: "GitHub Actions\n（外部CI）", col: 1, row: 0 },
          { id: "ecr", icon: "services/ecr", label: "ECR\nイメージ保管", col: 3, row: 0 },
          { id: "iam", icon: "services/iam", label: "IAM\nOIDC連携", col: 2, row: 1 },
          { id: "ecs", icon: "services/ecs", label: "ECS\n本番アプリ", col: 4, row: 1 }
        ],
        edges: [
          { from: "dev", to: "gha", label: "git push" },
          { from: "gha", to: "iam", label: "OIDC認証", dashed: true },
          { from: "gha", to: "ecr", label: "イメージpush" },
          { from: "gha", to: "ecs", label: "デプロイ指示" },
          { from: "ecr", to: "ecs", label: "イメージ取得" }
        ]
      },
      flow: [
        "開発者がGitHubへpushすると、GitHub Actions（GitHubに内蔵された外部CIサービス）がテストとイメージビルドを実行する",
        "ActionsはIAMのOIDC連携（IDトークンによる一時認証。アクセスキーの保存が不要になるしくみ）でAWSの一時権限を取得する",
        "取得した権限でイメージをECRへpushし、続けてECSのサービス更新APIを呼んでデプロイする",
        "ECSタスクがECRから新イメージを取得して起動し、ローリング更新が完了する"
      ],
      services: [
        { icon: "services/iam", name: "AWS IAM", role: "GitHub ActionsとのOIDC連携の受け口。長期アクセスキーを発行せず一時権限だけを渡す" },
        { icon: "services/ecr", name: "Amazon ECR", role: "外部CIからpushされたイメージの保管とバージョン管理" },
        { icon: "services/ecs", name: "Amazon ECS", role: "アプリの実行基盤。デプロイの受け側という役割は推奨構成と同じ" }
      ],
      points: [
        "最重要ポイントはOIDC連携。AWSのアクセスキーをGitHubのシークレットに保存する方式は漏えい事故の定番なので、キーレスの一時認証を最初から採用する",
        "PRごとのテスト・レビューコメント連携・豊富な共有アクションなど、開発者体験はCodePipelineより優れる場面が多い",
        "CI環境がAWSの外にあるため、デプロイの監査ログをAWS側（CloudTrail）とGitHub側の両方で追う必要がある点は運用上意識しておく",
        "図のGitHubはAWS外のサービスなので、AWS Cloud枠の外にインターネット上のリソースとして描いている"
      ],
      pros: [
        "PRチェックからデプロイまでGitHub上で完結し、開発者体験が良い",
        "公開されている再利用可能なアクションが豊富で、記述量が少なく済む",
        "OSSや複数クラウドを扱うチームでもCIのしくみを統一できる"
      ],
      cons: [
        "AWS外のサービスに依存するため、GitHub障害時はデプロイもできなくなる",
        "OIDC・IAMロールの設定を誤ると過剰な権限を外部に渡すリスクがある",
        "プライベートリポジトリのビルド時間が多いと課金が積み上がる"
      ],
      cost: "<strong>月0円〜数千円程度</strong>。GitHub Actionsはパブリックリポジトリ無料、プライベートも無料枠（Freeプランで2,000分/月）があり、超過分は1分あたり約0.008USD。AWS側はECR保存料とECS実行費のみ。",
      references: [
        { title: "OpenID Connect IDプロバイダーの作成", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_roles_providers_create_oidc.html", note: "GitHub ActionsとのOIDC連携の土台" },
        { title: "OpenID Connectフェデレーション", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_roles_providers_oidc.html" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" }
      ]
    },
    {
      name: "CloudFormationを組み込んだインフラ込みCI/CD",
      when: "アプリだけでなくインフラ構成の変更もコードレビューとパイプラインに乗せたい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] },
          { type: "vpc", label: "VPC", from: [3, 1], to: [4, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "dev", icon: "resources/client", label: "開発者\ncode+IaC push", col: 0, row: 0 },
          { id: "pipeline", icon: "services/codepipeline", label: "CodePipeline\n工程の司令塔", col: 1, row: 0 },
          { id: "build", icon: "services/codebuild", label: "CodeBuild\n検証・ビルド", col: 2, row: 0 },
          { id: "cfn", icon: "services/cloudformation", label: "CloudFormation\n変更セット実行", col: 3, row: 0 },
          { id: "ecs", icon: "services/ecs", label: "ECS等\nインフラ+アプリ", col: 4, row: 1 }
        ],
        edges: [
          { from: "dev", to: "pipeline", label: "push検知" },
          { from: "pipeline", to: "build", label: "ビルド・検証" },
          { from: "build", to: "cfn", label: "テンプレート" },
          { from: "cfn", to: "ecs", label: "リソース更新" }
        ]
      },
      flow: [
        "開発者はアプリのコードとインフラ定義（CloudFormationテンプレート）を同じリポジトリで管理し、pushする",
        "CodeBuildがアプリのテストに加えてテンプレートの構文検証・静的チェックを行う",
        "パイプラインがCloudFormationの変更セット（適用前に「何がどう変わるか」を一覧できる差分）を作成し、内容を確認してから実行する",
        "CloudFormationがECSサービスやタスク定義などのリソースを宣言どおりに作成・更新し、アプリとインフラが同時にデプロイされる"
      ],
      services: [
        { icon: "services/cloudformation", name: "AWS CloudFormation", role: "インフラをテンプレート（コード）で宣言的に管理し、差分適用とロールバックを担う" },
        { icon: "services/codepipeline", name: "AWS CodePipeline", role: "アプリとインフラの変更を同じ工程で流す司令塔" },
        { icon: "services/codebuild", name: "AWS CodeBuild", role: "テスト・ビルドに加え、テンプレートの検証も実行する" },
        { icon: "services/ecs", name: "Amazon ECS", role: "CloudFormation経由で構成変更されるアプリ実行基盤の例" }
      ],
      points: [
        "「環境変数を1つ足す」「メモリを増やす」といったインフラ変更もPRレビュー＋パイプライン経由になり、コンソール手作業による構成ドリフト（意図しない差異）を防げる",
        "変更セットを挟むのが安全運用の鍵。「実行したら何が置き換わるか」を適用前に確認でき、意図しないリソース再作成（＝瞬断やデータ消失）を事前に検知できる",
        "アプリだけの変更が大半のチームでは、アプリ用の高速なパイプラインとインフラ用のパイプラインを分ける設計も現実的",
        "この構成は次のケース44（IaCと環境分離）の土台になる。dev/stg/prodへ同じテンプレートを配ることで環境差異をなくせる"
      ],
      pros: [
        "インフラ変更に履歴・レビュー・ロールバックが効くようになる",
        "環境の再現が可能になり、検証環境や災害対策環境を短時間で複製できる",
        "アプリとインフラの変更が同じコミットに紐づき、障害調査がしやすい"
      ],
      cons: [
        "テンプレートの学習コストがあり、導入初期は開発速度が落ちる",
        "パイプラインに広いリソース操作権限を与えるため、IAM設計を慎重に行う必要がある",
        "既存の手作業構築環境をテンプレート化する初期移行に手間がかかる"
      ],
      cost: "<strong>月数百円〜2,000円程度</strong>。CloudFormation自体は追加料金なし（作成されるリソースの費用のみ）。パイプライン部分の費用は推奨構成と同じ水準で、インフラ管理が加わっても費用はほぼ増えない。",
      references: [
        { title: "AWS CloudFormationとは", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/Welcome.html" },
        { title: "ECSの標準デプロイとCI/CD", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/ecs-cd-pipeline.html", note: "ECSデプロイの自動化の公式解説" },
        { title: "スタックのドリフト検出", url: "https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html", note: "手作業変更との差異を検出するしくみ" }
      ]
    }
  ],
  cost: "<p>パイプライン自体の費用は3案とも<strong>月数百円〜数千円</strong>で大差なく、費用で選ぶ構成ではない。CodePipeline案はAWS内で完結する統制のしやすさ、GitHub Actions案は開発者体験と無料枠の大きさ、CloudFormation組み込み案は追加費用ほぼゼロでインフラ変更まで統制できる点がそれぞれの持ち味。いずれもアプリ実行側（ECS等）の費用が支配的になる。</p>",
  summary: "<p>CI/CDの本質は自動化による時短ではなく、<strong>「テストを通らないものは本番に出られない」という経路の強制</strong>にあります。AWS完結ならCodePipeline、GitHub中心の開発ならActions+OIDCが第一候補で、外部CIにアクセスキーを渡さないキーレス認証は必修事項です。さらにインフラ定義もパイプラインに乗せると手作業由来の構成ドリフトが消え、次のテーマである環境分離（ケース44）へ自然につながります。</p>",
  quiz: [
    {
      q: "CI/CDの価値は「デプロイ時間の短縮」と語られがちですが、このケースが本当の価値としているのは何でしょうか。",
      a: "壊れたコードが本番に到達する経路を塞ぐことです。テストが失敗したらデプロイが止まる、という状態を機械的に保証できるのが核心で、時短はその副産物にすぎません。手作業のままでは「急いでいたのでテストを飛ばした」が可能ですが、パイプラインを通る経路しか用意しなければそれができなくなります。リリースを怖い作業から日常の作業へ変えるのは、この強制力です。"
    },
    {
      q: "GitHub Actionsから使う場合に、アクセスキーをシークレットに保存する方式ではなくOIDC連携を選ぶべきなのはなぜでしょうか。",
      a: "長期のアクセスキーは、保存した場所すべてが漏えい経路になるためです。外部サービスの設定画面、ビルドログ、開発者の手元と、守るべき場所が際限なく増えていきます。OIDC連携ならGitHubが提示するIDトークンと引き換えにAWS側が一時的な権限を発行するので、そもそも保存すべき鍵が存在しません。秘密の値を人やサービスに持たせない、というケース50と同じ発想です。"
    },
    {
      q: "「環境変数を1つ足すだけ」の変更のたびに本番コンソールで手作業する運用が続いています。あなたならどう変えますか。",
      a: "代替2のように、インフラ定義もリポジトリに置いてパイプラインに乗せます。小さな変更でもレビューと履歴が残り、コンソール手作業によって設計図と実環境がずれる構成ドリフトを防げるためです。CloudFormationの変更セットを挟めば、実行したら何が置き換わるかを適用前に確認でき、意図しないリソース再作成による瞬断も事前に検知できます。アプリの変更が大半のチームなら、アプリ用とインフラ用でパイプラインを分けて速度を保つのも現実的です。"
    }
  ]
});
