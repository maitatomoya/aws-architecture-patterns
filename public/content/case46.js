// ケース46：監視・オブザーバビリティ基盤
registerCase({
  id: 46,
  category: "運用・セキュリティ・信頼性",
  title: "監視・オブザーバビリティ基盤",
  scenario: "<p>複数のサービス（API・バッチ・フロントエンド）で構成されるWebサービスを運用している。現在は障害が起きるとユーザーからの問い合わせで初めて気づき、原因調査もサーバーに入ってログをgrepする職人芸に頼っている。「ユーザーより先に異常に気づく」「どのサービスのどこが遅いのかを短時間で特定する」を実現する監視基盤を整えたい。運用担当は2人で、監視のためだけに大きな工数は割けない。</p>",
  requirements: [
    "エラー率やレイテンシの異常を自動検知して通知したい（ユーザーより先に気づく）",
    "複数サービスをまたぐリクエストの「どこが遅いか」を特定したい",
    "ログを1か所に集約して検索できるようにしたい",
    "ダッシュボードでサービス全体の健康状態を一目で把握したい",
    "監視基盤自体の運用工数は最小にしたい"
  ],
  main: {
    name: "CloudWatch + X-Ray + SNS（AWS標準の監視3点セット）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "app", icon: "services/lambda", label: "監視対象\nアプリ（例）", col: 1, row: 0 },
        { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nメトリクス・ログ", col: 2, row: 0 },
        { id: "sns", icon: "services/sns", label: "SNS\nアラーム通知", col: 3, row: 0 },
        { id: "email", icon: "resources/email", label: "メール・\nチャット通知", col: 4, row: 0 },
        { id: "xray", icon: "services/x-ray", label: "X-Ray\n分散トレース", col: 2, row: 1 },
        { id: "user", icon: "resources/user", label: "運用担当者", col: 4, row: 1 }
      ],
      edges: [
        { from: "app", to: "cw", label: "ログ・メトリクス" },
        { from: "app", to: "xray", label: "トレース送信" },
        { from: "cw", to: "sns", label: "アラーム発火" },
        { from: "sns", to: "email", label: "通知" },
        { from: "cw", to: "xray", dashed: true, noArrow: true },
        { from: "user", to: "cw", label: "ダッシュボード" }
      ]
    },
    flow: [
      "各サービスがメトリクス（CPU・エラー数などの数値）とログをCloudWatchへ送る。AWSのマネージドサービスなら多くが自動で送ってくれる",
      "同時にX-Ray SDKがリクエストにトレースID（処理の追跡番号）を付け、サービスをまたいだ処理の流れと所要時間をX-Rayへ記録する",
      "CloudWatchアラームが「5分間のエラー率が1%超」などのしきい値を監視し、超えたらSNSへ発火する",
      "SNSがメールやチャット（Lambda連携でSlack等）へ通知し、運用者はユーザーより先に異常を知る",
      "運用者はCloudWatchダッシュボードで全体を把握し、X-Rayのサービスマップで「どのサービスのどこが遅いか」を特定する"
    ],
    services: [
      { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "メトリクス・ログ・アラーム・ダッシュボードを担う監視の中核。AWSサービスとの統合が自動的で導入の手間が最小" },
      { icon: "services/x-ray", name: "AWS X-Ray", role: "分散トレーシング。複数サービスを流れる1リクエストを追跡し、遅延やエラーの発生箇所を可視化する" },
      { icon: "services/sns", name: "Amazon SNS", role: "アラームの通知ハブ。メール・Lambda・チャット連携など複数の宛先へ同時に配れる" },
      { icon: "services/lambda", name: "監視対象のアプリ", role: "図では代表としてLambdaを描いているが、ECS・EC2・API Gatewayなど何でも同じ形で監視できる" }
    ],
    points: [
      "監視の3本柱は「メトリクス（数値の傾向）・ログ（個別の記録）・トレース（リクエストの流れ）」。この3つが揃って初めて「気づく→どこかを絞る→原因を読む」の流れが成立する",
      "アラームは最初から増やしすぎない。通知が多すぎると人が無視するようになる（アラート疲れ）ため、「ユーザー影響に直結する指標」（エラー率・レイテンシ・死活）から始めるのが定石",
      "ログは最初から構造化（JSON形式）で出すと、CloudWatch Logs Insightsでの検索・集計が桁違いに楽になる。printデバッグの延長の平文ログから早めに卒業する",
      "X-Rayは全リクエストではなくサンプリング（一部を抽出して記録）で動くため、負荷とコストを抑えつつ傾向を掴める。導入はSDKの組み込みだけで始められる"
    ],
    pros: [
      "監視基盤自体の構築・運用がほぼ不要（フルマネージド）で、2人の運用体制でも回る",
      "AWSサービスからのメトリクス・ログ収集が自動的に統合され、導入が速い",
      "従量課金で小さく始められ、監視対象の成長に合わせて自然に拡張できる",
      "アラーム→SNS→自動復旧処理（Lambda）のような対応の自動化にも発展できる"
    ],
    cons: [
      "ログの高度な全文検索・長期間の横断分析はCloudWatch Logs Insightsだけでは物足りなくなることがある",
      "AWS外のリソース（他クラウド・SaaS）の監視は苦手で、対象が広がると統合監視が必要になる",
      "ダッシュボードの表現力や分析UIは専業の監視SaaSに一歩譲る"
    ],
    cost: "<strong>月1,000円〜5,000円程度</strong>（中小規模の場合）。主な内訳はログ取り込み（1GBあたり約0.76USD）・カスタムメトリクス（1個あたり月約0.3USD）・アラーム（1個あたり月約0.1USD）。X-Rayは記録100万トレースあたり約5USDで、サンプリングにより小規模なら無料枠内も狙える。ログの保持期間を無期限にしないことが節約の第一歩。",
    references: [
      { title: "Amazon CloudWatchとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html" },
      { title: "CloudWatchアラームの作成", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html", note: "SNS通知つきアラームの作り方" },
      { title: "AWS X-Rayとは", url: "https://docs.aws.amazon.com/ja_jp/xray/latest/devguide/aws-xray.html" },
      { title: "CloudWatch Logsとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html" },
      { title: "Amazon SNSとは", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "OpenSearchによるログ集約・可視化基盤",
      when: "大量ログの全文検索・長期分析・柔軟な可視化が主目的の場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "app", icon: "services/lambda", label: "各サービス\nログ出力", col: 1, row: 0 },
          { id: "cwl", icon: "services/cloudwatch", label: "CloudWatch Logs\nログ受け口", col: 2, row: 0 },
          { id: "fh", icon: "services/data-firehose", label: "Data Firehose\nストリーム転送", col: 3, row: 0 },
          { id: "os", icon: "services/opensearch", label: "OpenSearch\n検索・可視化", col: 4, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n生ログ保管", col: 3, row: 1 },
          { id: "user", icon: "resources/user", label: "運用担当者", col: 5, row: 0 }
        ],
        edges: [
          { from: "app", to: "cwl", label: "ログ出力" },
          { from: "cwl", to: "fh", label: "購読フィルタ" },
          { from: "fh", to: "os", label: "投入" },
          { from: "fh", to: "s3", label: "生ログ退避" },
          { from: "user", to: "os", label: "検索・分析" }
        ]
      },
      flow: [
        "各サービスのログはいったんCloudWatch Logsに集まる（ここまでは推奨構成と同じ）",
        "サブスクリプションフィルタ（ログを別サービスへ流す購読のしくみ）がログをData Firehoseへストリーム転送する",
        "FirehoseがログをまとめてOpenSearch（検索エンジンのマネージドサービス）へ投入し、同時に生データをS3へも保管する",
        "運用者はOpenSearch Dashboardsで全文検索・集計・可視化を行う。長期の分析はS3側のデータをAthena等で照会する"
      ],
      services: [
        { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "ログの全文検索・集計・可視化エンジン。Kibana由来のDashboardsで柔軟なグラフが作れる" },
        { icon: "services/data-firehose", name: "Amazon Data Firehose", role: "ログをバッファリングしてOpenSearchとS3へ配送する転送路。詰まりや流量変動を吸収する" },
        { icon: "services/cloudwatch", name: "Amazon CloudWatch Logs", role: "ログの受け口。サブスクリプションフィルタで下流へ流す" },
        { icon: "services/s3", name: "Amazon S3", role: "生ログの長期保管先。OpenSearchの保持期間を短くしてコストを抑えるための逃がし先" }
      ],
      points: [
        "OpenSearchは「検索の速さと柔軟さ」を買うための追加投資。エラーメッセージの全文検索や、ユーザーID横断の調査が日常的にあるなら効果が大きい",
        "OpenSearchのストレージは高いので、検索対象は直近数週間に絞り、全期間の生ログはS3に置くのが費用設計の定石（ホット・コールドの分離）",
        "クラスターのサイズ設計・インデックス管理という「監視基盤自体の運用」が発生する点が推奨構成との最大の違い。サーバーレスのOpenSearch Serverlessで軽くする選択もある",
        "メトリクス・アラームはCloudWatchのまま使い、ログ検索だけOpenSearchに任せる併用構成が現実的"
      ],
      pros: [
        "大量ログの全文検索・複雑な集計が高速にできる",
        "ダッシュボードの表現力が高く、調査の生産性が上がる",
        "S3併用で長期保管と検索コストを両立できる"
      ],
      cons: [
        "クラスター運用（サイズ・インデックス管理）という新たな仕事が増える",
        "常時起動のため小規模でも月数千円〜数万円の固定費がかかる",
        "監視の主目的（異常検知・通知）には別途CloudWatchアラームが必要"
      ],
      cost: "<strong>月1万円〜5万円程度〜</strong>。OpenSearchの小型ドメイン（t3.small.search+ストレージ）で月約30USD〜、実用的なサイズでは月100USD超になりやすい。Firehoseは取り込み1GBあたり約0.03USDと安い。ログ量と保持期間がコストを支配する。",
      references: [
        { title: "Amazon OpenSearch Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/what-is.html" },
        { title: "CloudWatch Logsサブスクリプションフィルタ", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/SubscriptionFilters.html", note: "ログを下流へ流すしくみ" },
        { title: "Amazon Data Firehoseとは", url: "https://docs.aws.amazon.com/ja_jp/firehose/latest/dev/what-is-this-service.html" }
      ]
    },
    {
      name: "外部SaaS（Datadog等）による統合監視",
      when: "複数クラウド・多数のサービスを一元監視したい・監視ツールの作り込みに工数を割けない場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "app", icon: "services/lambda", label: "監視対象\nアプリ（例）", col: 1, row: 0 },
          { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nメトリクス・ログ", col: 2, row: 0 },
          { id: "iam", icon: "services/iam", label: "IAMロール\n連携権限", col: 2, row: 1 },
          { id: "saas", icon: "resources/internet", label: "監視SaaS\n（Datadog等）", col: 4, row: 0 },
          { id: "user", icon: "resources/user", label: "運用担当者", col: 4, row: 1 }
        ],
        edges: [
          { from: "app", to: "cw", label: "メトリクス送信" },
          { from: "saas", to: "cw", label: "API取得" },
          { from: "iam", to: "saas", label: "権限付与", dashed: true },
          { from: "user", to: "saas", label: "閲覧・分析" }
        ]
      },
      flow: [
        "AWS側のメトリクス・ログはこれまで同様CloudWatchに集まる",
        "監視SaaSに読み取り専用のIAMロールを渡し、SaaSがCloudWatchのAPIから定期的にデータを取得する（エージェント常駐やMetric Streamsによるプッシュ型連携もある）",
        "SaaS側でAWS内外のメトリクス・ログ・トレースが統合され、ダッシュボード・アラート・APM（アプリ性能監視）として提供される",
        "運用者は普段SaaSの画面だけを見ればよくなり、通知もSaaSからチャットへ直接届く"
      ],
      services: [
        { icon: "services/cloudwatch", name: "Amazon CloudWatch", role: "AWS側のデータ収集口。SaaS連携後も一次データはここに集まる" },
        { icon: "services/iam", name: "AWS IAM", role: "SaaSに渡す読み取り専用ロール。外部にアクセスキーを渡さずロールの引き受けで連携するのが安全な作法" },
        { icon: "resources/internet", name: "監視SaaS（Datadog等）", role: "AWS外のサービス。メトリクス・ログ・トレースの統合、高機能なダッシュボードとアラートを提供する" }
      ],
      points: [
        "SaaSの価値は「統合」。複数クラウド・SaaS・オンプレが混在する環境の監視画面を1つにでき、監視ツール自体の運用も手放せる",
        "連携用のIAMロールは読み取り専用の最小権限にし、アクセスキーの発行ではなくロールの引き受け（AssumeRole）方式にする。外部に渡す権限の設計はセキュリティレビューの対象にすべき",
        "コストはホスト数・取り込みログ量に応じた課金で、規模が大きくなると月数十万円級になり得る。CloudWatch側の取得API呼び出し料金も意外な追加費用になる点に注意",
        "小規模のうちは推奨構成（CloudWatch）で十分なことが多い。「監視対象がAWSの外に広がったとき」「専任なしで高度なAPMが欲しくなったとき」がSaaS移行の判断タイミング"
      ],
      pros: [
        "AWS内外を問わない統合監視と高機能なUI・APMが手に入る",
        "監視基盤自体の構築・運用がゼロで、ノウハウもSaaSベンダーから得られる",
        "異常検知（機械学習ベース）など自前では作りにくい機能を使える"
      ],
      cons: [
        "ホスト数・ログ量に応じた利用料が高額になりやすい",
        "監視データを外部事業者に預けるため、契約・セキュリティの確認が必要",
        "SaaS障害時は監視も止まる（監視の依存先が増える）"
      ],
      cost: "<strong>月数万円〜数十万円</strong>（規模による）。例としてインフラ監視はホストあたり月15〜23USD程度+ログ・APMの従量課金が一般的な価格帯。加えてCloudWatch API呼び出しやMetric Streams（更新100万件あたり約0.3USD）などAWS側の連携費用も発生する。",
      references: [
        { title: "CloudWatch Metric Streams", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/CloudWatch-Metric-Streams.html", note: "外部SaaSへメトリクスをプッシュ配信するしくみ" },
        { title: "サードパーティーへのアクセス権限の付与", url: "https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html", note: "外部サービスへ安全に権限を渡すIAMロールの作法" },
        { title: "Amazon CloudWatchとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html" }
      ]
    }
  ],
  cost: "<p>CloudWatch+X-Ray+SNSの標準構成は<strong>月1,000円〜5,000円程度</strong>と最安で、監視対象の規模に素直に比例する。OpenSearch追加はログ検索力と引き換えに<strong>月1万円〜</strong>の固定費、外部SaaSは統合と高機能の対価として<strong>月数万円〜数十万円</strong>。「まずCloudWatchで始め、ログ検索が辛くなったらOpenSearch、対象がAWS外へ広がったらSaaS」と、課題が現れたタイミングで投資を増やすのが費用効率のよい進め方。</p>",
  summary: "<p>オブザーバビリティは<strong>メトリクス・ログ・トレースの3本柱</strong>で考えます。AWSだけで完結するならCloudWatch+X-Ray+SNSが最小工数・最小費用の出発点で、「ユーザー影響に直結する少数のアラームから始める」のが運用を破綻させないコツです。ログの本格検索が必要ならOpenSearchを足し、監視対象が複数クラウドへ広がったらSaaSへ、と段階的に育てましょう。どの構成でも、外部やSaaSへ渡す権限を読み取り専用のIAMロールに絞る作法は共通の必修事項です。</p>"
});
