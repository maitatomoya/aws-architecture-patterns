// ケース50：秘密情報・鍵管理
registerCase({
  id: 50,
  category: "運用・セキュリティ・信頼性",
  title: "秘密情報・鍵管理",
  scenario: "<p>BtoB向けWebサービスを運用するスタートアップ。データベースのパスワードや外部決済APIのキーが、ソースコード内の設定ファイルやEC2の環境変数に平文（暗号化されていないそのままの文字列）で書かれている。先日、社内勉強会用に公開したリポジトリに本番DBのパスワードが混入しかけてヒヤリとした。セキュリティ診断でも「秘密情報の管理不備」を最重要指摘として受けており、パスワードの定期変更も「怖くて誰もやっていない」状態。秘密情報を安全に保管し、ローテーション（定期的な変更）まで自動化する仕組みを整えたい。</p>",
  requirements: [
    "DBパスワードやAPIキーをコード・設定ファイルから排除したい",
    "秘密情報は暗号化して保管し、取得できる人・プログラムを権限で制御したい",
    "DBパスワードの定期ローテーションを自動化したい（手作業の変更は事故のもと）",
    "アプリ（ECSやLambda）は実行時に安全に秘密情報を取得できること",
    "「誰がいつ秘密情報にアクセスしたか」を監査できること",
    "開発者が本番パスワードの値そのものを知らなくても運用できる状態にしたい"
  ],
  main: {
    name: "Secrets Manager+KMS（DB認証情報の自動ローテーション）",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 1] },
        { type: "vpc", label: "VPC", from: [0, 1], to: [1, 1], depth: 1 }
      ],
      nodes: [
        { id: "iam", icon: "services/iam", label: "IAM\n取得権限の制御", col: 0, row: 0 },
        { id: "sm", icon: "services/secrets-manager", label: "Secrets Manager\n秘密情報の保管", col: 2, row: 0 },
        { id: "kms", icon: "services/kms", label: "KMS\n暗号化キー", col: 3, row: 0 },
        { id: "ecs", icon: "services/ecs", label: "ECS\nアプリ", col: 0, row: 1 },
        { id: "rds", icon: "services/rds", label: "RDS\nデータベース", col: 1, row: 1 },
        { id: "rot", icon: "services/lambda", label: "Lambda\nローテーション", col: 3, row: 1 }
      ],
      edges: [
        { from: "iam", to: "ecs", label: "ロールで許可", dashed: true },
        { from: "ecs", to: "sm", label: "認証情報を取得" },
        { from: "ecs", to: "rds", label: "接続" },
        { from: "sm", to: "kms", label: "暗号化", dashed: true },
        { from: "sm", to: "rot", label: "定期的に起動" },
        { from: "rot", to: "rds", label: "新パスワード設定" }
      ]
    },
    flow: [
      "DBパスワードをSecrets Managerに登録する。保管時はKMSの暗号化キーで自動的に暗号化される",
      "ECSのアプリはIAMロール（サーバーに紐づく権限。キー配布が不要）の権限で、起動時や接続時にSecrets Managerから認証情報を取得してRDSへ接続する",
      "Secrets Managerが設定スケジュール（例：30日ごと）でローテーション用Lambdaを起動する",
      "LambdaがRDSに新しいパスワードを設定し、Secrets Managerの値も新しい値に更新する。アプリは次回取得時から自動的に新パスワードを使う",
      "誰が（どのロールが）いつ秘密情報を取得したかはCloudTrailに記録され、監査に使える"
    ],
    services: [
      { icon: "services/secrets-manager", name: "AWS Secrets Manager", role: "秘密情報の保管庫。暗号化保管・取得API・自動ローテーションまでを一体で提供する" },
      { icon: "services/kms", name: "AWS KMS", role: "暗号化キーの管理サービス。Secrets Managerの保管データはKMSのキーで暗号化される。キー自体もAWSが安全に保管する" },
      { icon: "services/lambda", name: "AWS Lambda（ローテーション関数）", role: "パスワード変更の実働部隊。RDS用はテンプレートが用意されており、ほぼ設定だけで動く" },
      { icon: "services/iam", name: "AWS IAM", role: "「どのアプリがどの秘密情報を取得できるか」を最小権限で制御する。人ではなくロールに権限を与えるのが要点" },
      { icon: "services/ecs", name: "Amazon ECS", role: "秘密情報を利用する側のアプリ実行基盤。タスク定義でSecrets Managerの値を安全に注入できる" },
      { icon: "services/rds", name: "Amazon RDS", role: "守る対象の認証情報を持つデータベース。ローテーションの適用先" }
    ],
    points: [
      "この構成の本質は「秘密の値を人が知らない・触らない状態」を作ること。登録後はアプリもローテーションもすべて機械同士のやり取りになり、漏えい経路が激減する",
      "Secrets Manager・KMS・IAMはVPC外のマネージドサービス。VPC内のECSからの取得は、NAT経由でも可能だがVPCエンドポイント（AWS内部の専用出入口）経由にするのが定石。通信がインターネットに出なくなる",
      "ローテーションは「変更中もアプリが切れないこと」が難所。Secrets Managerは新旧2版（AWSCURRENT/AWSPREVIOUS）を管理し、切り替え中の取りこぼしを防ぐ仕組みを持つ",
      "アプリ側は秘密情報を毎リクエスト取得せずキャッシュするのが実装の定石（公式のキャッシュライブラリがある）。API呼び出し料金と遅延を抑えられる"
    ],
    pros: [
      "コード・設定ファイルから秘密情報を完全に排除できる",
      "パスワードの定期変更が全自動になり、「怖くて変えられない」問題が解消する",
      "取得権限をIAMで最小化し、アクセス履歴をCloudTrailで監査できる",
      "RDS用ローテーションはテンプレート提供済みで、作り込みが小さい"
    ],
    cons: [
      "シークレット1件あたり月0.40USDと取得10,000回あたり0.05USDの費用がかかる（件数が多いと積み上がる）",
      "ローテーション対応にはアプリが「接続失敗時に再取得する」等の作法を守る必要がある",
      "独自ミドルウェアのローテーションはLambdaを自作する必要がある"
    ],
    cost: "<strong>月数百円〜3,000円程度</strong>（シークレット10〜30件＋通常のAPI取得量の想定。1件月0.40USD＋取得1万回0.05USDの従量課金。VPCエンドポイントを追加する場合は1つあたり月1,000円前後が加わる）",
    references: [
      { title: "AWS Secrets Managerとは", url: "https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/intro.html", note: "秘密情報管理の全体像" },
      { title: "シークレットのローテーション", url: "https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/rotating-secrets.html", note: "RDS等の自動ローテーション設定" },
      { title: "AWS KMSとは", url: "https://docs.aws.amazon.com/ja_jp/kms/latest/developerguide/overview.html", note: "暗号化キー管理の基礎" },
      { title: "ECSタスクへの機密データの受け渡し", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/specifying-sensitive-data.html", note: "アプリ側（取得側）の実装方法" },
      { title: "Secrets ManagerのVPCエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/vpc-endpoint-overview.html", note: "工夫点で触れた閉域経路の作り方" }
    ]
  },
  alternatives: [
    {
      name: "Systems Manager Parameter Store（無料枠でスモールスタート）",
      when: "自動ローテーションまでは不要で、まず設定値と秘密情報をコードから追い出したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "lambda", icon: "services/lambda", label: "Lambda\nアプリ", col: 0, row: 0 },
          { id: "ssm", icon: "services/systems-manager", label: "Parameter Store\n設定値と秘密情報", col: 2, row: 0 },
          { id: "kms", icon: "services/kms", label: "KMS\n暗号化キー", col: 3, row: 0 },
          { id: "iam", icon: "services/iam", label: "IAM\n権限制御", col: 1, row: 1 }
        ],
        edges: [
          { from: "lambda", to: "ssm", label: "起動時に取得" },
          { from: "ssm", to: "kms", label: "暗号化", dashed: true },
          { from: "iam", to: "lambda", label: "実行ロール", dashed: true },
          { from: "iam", to: "ssm", label: "アクセス制御", dashed: true }
        ]
      },
      flow: [
        "APIキーや設定値をParameter Storeに登録する。秘密情報はSecureString型にするとKMSのキーで暗号化保管される",
        "アプリ（ここではLambda）は実行ロールの権限で、起動時にパラメータを取得して使う",
        "値の変更はコンソールやCLIから行い、アプリは再起動または次回取得で新しい値を読む（ローテーションは手動）"
      ],
      services: [
        { icon: "services/systems-manager", name: "AWS Systems Manager Parameter Store", role: "設定値・秘密情報の保管庫。スタンダード層は1万件まで無料で使える" },
        { icon: "services/kms", name: "AWS KMS", role: "SecureString型パラメータの暗号化を担う。ここはSecrets Managerと同じ仕組み" },
        { icon: "services/iam", name: "AWS IAM", role: "パラメータ単位・階層単位で取得権限を絞る。/prod/と/dev/でパスを分けて権限も分けるのが定石" },
        { icon: "services/lambda", name: "AWS Lambda", role: "取得側アプリの例。環境変数に直接書かず、実行時に取得する形にする" }
      ],
      points: [
        "Secrets Managerとの最大の違いは「自動ローテーションの有無」と「料金」。保管が無料なので、まず秘密情報をコードから追い出す第一歩として最適",
        "パラメータは/myapp/prod/db-passwordのような階層名で整理する。環境ごとの取り違え事故を防ぎ、IAMでの権限分離もしやすくなる",
        "SecureString型を使わず平文のString型に秘密情報を入れてしまうのがよくある事故。秘密情報は必ずSecureStringにする",
        "後からSecrets Managerへ移行するのは容易（取得先のARNを差し替える程度）なので、「まずParameter Store、ローテーション要件が出たらSecrets Manager」という育て方ができる"
      ],
      pros: [
        "スタンダード層は保管無料で、ほぼゼロコストで始められる",
        "秘密情報だけでなく一般の設定値も一元管理でき、環境差分の管理が楽になる",
        "IAM・KMS・CloudTrailとの連携はSecrets Managerと同等に使える"
      ],
      cons: [
        "自動ローテーション機能がなく、パスワード変更は手動または自作になる",
        "リージョン間レプリケーションなどSecrets Manager固有の機能はない",
        "高スループット・大きめのパラメータ（アドバンスド層）は有料になる"
      ],
      cost: "<strong>月0円〜数百円程度</strong>（スタンダード層はパラメータ1万件まで保管無料。標準スループットのAPI取得も無料。アドバンスド層を使う場合のみ1件月0.05USD＋取得課金が発生）",
      references: [
        { title: "AWS Systems Manager Parameter Store", url: "https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/systems-manager-parameter-store.html", note: "SecureStringと階層管理の公式ガイド" },
        { title: "AWS KMSとは", url: "https://docs.aws.amazon.com/ja_jp/kms/latest/developerguide/overview.html", note: "SecureStringの暗号化の仕組み" },
        { title: "IAMのセキュリティベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/best-practices.html", note: "最小権限でのアクセス制御" }
      ]
    },
    {
      name: "環境変数直書き運用（アンチパターン：現状の姿）",
      when: "選ぶべき構成ではなく、脱出すべき現在地。何が危険かを正しく言語化するために載せる",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [4, 0] },
          { type: "vpc", label: "VPC", from: [3, 0], to: [4, 0], depth: 1 }
        ],
        nodes: [
          { id: "dev", icon: "resources/user", label: "開発者", col: 0, row: 0 },
          { id: "repo", icon: "resources/documents", label: "コード・設定\nファイル", col: 1, row: 0 },
          { id: "app", icon: "services/ec2", label: "EC2\n環境変数に平文", col: 3, row: 0 },
          { id: "rds", icon: "services/rds", label: "RDS\nデータベース", col: 4, row: 0 }
        ],
        edges: [
          { from: "dev", to: "repo", label: "平文で記載" },
          { from: "repo", to: "app", label: "デプロイで配布", dashed: true },
          { from: "app", to: "rds", label: "接続" }
        ]
      },
      flow: [
        "開発者がDBパスワードを設定ファイルや起動スクリプトに平文で書き、リポジトリにコミットする",
        "デプロイのたびに平文のパスワードがEC2の環境変数として配布される",
        "アプリは環境変数を読んでRDSに接続する。動きはするが、秘密の値が「コード・リポジトリ・サーバー・開発者の頭の中」の全部に散らばった状態になる"
      ],
      services: [
        { icon: "services/ec2", name: "Amazon EC2（環境変数）", role: "環境変数はプロセス情報やログ・エラー画面から漏れることがあり、サーバーに入れる人全員が読める" },
        { icon: "resources/documents", name: "コード・設定ファイル", role: "リポジトリに入った秘密情報は履歴に永久に残る。公開・共有した瞬間に全世界へ漏れる導火線" },
        { icon: "services/rds", name: "Amazon RDS", role: "漏れたパスワード1つで全データにアクセスされる。被害の最終到達点" }
      ],
      points: [
        "危険な理由1：漏えい経路が多すぎる。Gitの履歴・CIのログ・エラー画面・スクリーンショット・退職者の記憶と、守るべき場所が無限に増える",
        "危険な理由2：ローテーションが事実上不可能になる。変更には全サーバー・全設定の書き換えが必要で、「怖くて変えられない」まま数年放置される",
        "危険な理由3：漏れたことに気づけない。Secrets Managerなら取得履歴が監査できるが、環境変数を誰が見たかは記録に残らない",
        "一度でもコミットした秘密情報は「漏れたもの」として扱い、履歴の削除ではなく必ず値そのものを変更（無効化）する。これが移行の最初の一歩"
      ],
      pros: [
        "実装が最も手軽で、追加費用もゼロ（だから広まってしまう）",
        "依存サービスがなく、ローカル開発と同じ感覚で動かせる"
      ],
      cons: [
        "リポジトリ経由の漏えい事故と隣り合わせ（公開設定ミス1回で終わる）",
        "パスワード変更のコストが高く、ローテーションされなくなる",
        "アクセスの監査ができず、漏えい時の影響範囲も特定できない",
        "セキュリティ診断・監査で確実に指摘され、取引要件を満たせないことがある"
      ],
      cost: "<strong>月0円</strong>（追加費用はないが、漏えい時の損害・信用失墜・全パスワード緊急変更の対応コストという最大級の潜在コストを抱える。Parameter Storeも月0円で始められるため、費用面の言い訳は成立しない）",
      references: [
        { title: "Lambdaの環境変数とセキュリティ", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-envvars.html", note: "公式も機密情報はSecrets Manager等の利用を案内している" },
        { title: "AWS Secrets Managerとは", url: "https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/intro.html", note: "脱出先の全体像" },
        { title: "IAMのセキュリティベストプラクティス", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/best-practices.html", note: "ハードコードされた認証情報を避ける公式指針" }
      ]
    }
  ],
  cost: "<p>推奨構成（Secrets Manager+KMS）は<strong>月数百円〜3,000円程度</strong>（1件月0.40USD×件数＋取得料。VPCエンドポイント追加で月1,000円前後増）。Parameter Store案は<strong>月0円〜数百円</strong>で、自動ローテーションがない代わりに保管無料。環境変数直書きは費用0円だが、漏えい時の損害という最大の潜在コストを持つ。「まずParameter Storeで無料で始め、DBパスワードのような自動ローテーションが欲しいものだけSecrets Managerに置く」という併用が、費用と安全のバランスが良い現実解。</p>",
  summary: "<p>秘密情報管理のゴールは「暗号化して保管する」ことではなく、<strong>秘密の値を人が知らなくても・触らなくてもシステムが回る状態</strong>を作ることです。Secrets Manager+KMS+IAMの組み合わせは、保管・取得・ローテーション・監査という一連の流れを機械同士で完結させます。KMSは今回のように単独で意識せずとも、S3・RDS・EBSなどAWSのあらゆる暗号化の土台として裏で働いている重要サービスです。環境変数直書きからの脱出は「コミットされた値は漏れたものとして変更する」ことから始まります。無料のParameter Storeでも第一歩は今日踏み出せるので、コストは言い訳になりません。</p>",
  quiz: [
    {
      q: "秘密情報管理のゴールは「暗号化して保管すること」ではないとされています。では何がゴールでしょうか。",
      a: "秘密の値を人が知らなくても、触らなくてもシステムが回る状態を作ることです。登録後はアプリの取得もローテーションも機械同士のやり取りになるため、値が人の手を経る場面そのものが消え、漏えい経路が激減します。暗号化はそのための手段のひとつにすぎず、暗号化された値を人が復号して設定ファイルに書き写しているなら、リスクはほとんど減っていません。"
    },
    {
      q: "環境変数への直書きが「無料なのに一番高くつく」と言えるのはなぜでしょうか。",
      a: "追加費用はゼロでも、漏えい経路が無数に増え、ローテーションが事実上不可能になり、誰が値を見たかの監査もできなくなるからです。リポジトリの履歴・ビルドログ・エラー画面・退職者の記憶と守るべき場所が広がり、変更には全サーバーの書き換えが必要なので、怖くて変えられないまま放置されます。しかもParameter Storeなら同じく月0円で始められるため、費用を理由にした先送りは成立しません。"
    },
    {
      q: "過去に一度、本番DBのパスワードをリポジトリにコミットしていたことが分かりました。あなたならまず何をしますか。",
      a: "履歴からの削除ではなく、パスワードの値そのものを変更して無効化します。一度コミットされた秘密情報は、クローンやフォーク、ビルドのキャッシュなど手の届かない場所に残っている前提で、漏れたものとして扱うべきだからです。値を無効化したうえでSecrets ManagerかParameter Storeへ移し、以降はアプリがIAMロールの権限で実行時に取得する形にします。自動ローテーションまで必要ならSecrets Manager、まず追い出すだけならParameter Storeという段階の踏み方ができます。"
    }
  ]
});
