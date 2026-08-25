// ケース23：ログ収集・分析基盤
registerCase({
  id: 23,
  category: "データ・分析",
  title: "ログ収集・分析基盤",
  scenario: "<p>複数のWebサービスを運用する企業。アプリログ・アクセスログ・AWS各サービスのログがサーバーやサービスごとに散らばっており、障害調査のたびに各所へログインして探し回っている。さらに情報セキュリティ監査で「操作ログを3年保管すること」が求められた。ログを1か所に集め、調査しやすく、かつ長期保管しても破産しない基盤を作りたい。</p>",
  requirements: [
    "複数システムのログを1か所に集約したい",
    "障害調査で期間・キーワードを指定して横断検索したい",
    "監査要件（3年保管）に低コストで対応したい",
    "ログ量の増加（現在月100GB前後）に自動で追従したい",
    "収集の仕組み自体の運用負荷を小さくしたい"
  ],
  main: {
    name: "CloudWatch Logs+Firehose+S3+Athenaのログ基盤",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "src", icon: "resources/documents", label: "アプリ/AWSの\n各種ログ", col: 0, row: 0 },
        { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nLogs", col: 1, row: 0 },
        { id: "fh", icon: "services/data-firehose", label: "Data\nFirehose", col: 2, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\nログ保管", col: 3, row: 0 },
        { id: "athena", icon: "services/athena", label: "Athena\nSQL検索", col: 3, row: 1 },
        { id: "op", icon: "resources/user", label: "調査担当", col: 4, row: 1 }
      ],
      edges: [
        { from: "src", to: "cw", label: "ログ出力" },
        { from: "cw", to: "fh", label: "購読で転送" },
        { from: "fh", to: "s3", label: "まとめて保存" },
        { from: "athena", to: "s3", label: "スキャン" },
        { from: "op", to: "athena", label: "SQLで調査" }
      ]
    },
    flow: [
      "各アプリ・AWSサービスのログをまずCloudWatch Logsに集める。EC2はエージェント経由、LambdaやECSは標準機能でそのまま送れる",
      "サブスクリプションフィルター（ログを他サービスへ流し込む仕組み）でData Firehoseに転送する",
      "Firehoseがログをバッファリングしてまとめ、圧縮・日付フォルダ分けをしながらS3へ自動で書き込む",
      "調査時はAthenaでS3上のログにSQLを実行し、期間やキーワードで絞り込む",
      "直近ログの簡易調査はCloudWatch Logs Insights、過去分の本格調査はAthena、と使い分ける"
    ],
    services: [
      { icon: "services/cloudwatch", name: "Amazon CloudWatch Logs", role: "ログの受け口。各サービスからの収集と直近分のクイック検索（Logs Insights）を担当" },
      { icon: "services/data-firehose", name: "Amazon Data Firehose", role: "ログをまとめてS3へ配送するサーバーレスの配送係。圧縮とフォルダ分けもここで行う" },
      { icon: "services/s3", name: "Amazon S3", role: "長期保管の主役。保存単価が安く、ライフサイクルでさらに下げられる" },
      { icon: "services/athena", name: "Amazon Athena", role: "S3上のログへ直接SQLを実行する検索エンジン。使ったスキャン量だけの課金" }
    ],
    points: [
      "保管の主役をS3にするのがコストの要。CloudWatch Logsに長期保管するより保存単価が1桁安く、ライフサイクルでGlacier層に落とせばさらに下がる",
      "CloudWatch Logs側の保持期間は短め（例：30日）に設定して二重保管をやめる。「直近はCloudWatch、過去はS3」と置き場を分ける",
      "Firehoseの段階で圧縮と日付パーティション（year=2026/month=08/…のフォルダ分け）をかけておくと、Athenaのスキャン量＝調査のたびの費用が大幅に減る",
      "秒単位の検索応答やダッシュボード常時監視が主目的なら、この構成ではなくOpenSearch案（代替1）に寄せる"
    ],
    pros: [
      "全コンポーネントがサーバーレスで、ログ量が増えても自動で追従する",
      "長期保管コストが安く、監査要件と両立できる",
      "SQLという汎用スキルで調査でき、ツール固有の学習が少ない"
    ],
    cons: [
      "Athenaの検索は数秒〜数十秒かかり、リアルタイム監視には不向き",
      "サブスクリプションフィルター等の初期配線にひと通りの手数がかかる",
      "SQLを書けないメンバーには調査のハードルがある"
    ],
    cost: "<strong>月数千円〜3万円程度</strong>（ログ月100GBの前提）。費用の中心はCloudWatch Logsの取り込み料（約0.76USD/GB）で、S3保存とAthenaスキャンは少額。ログ量に完全に比例するため、出力しっぱなしのデバッグログを削ることが最大の節約になる。",
    references: [
      { title: "Amazon CloudWatch Logsとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html" },
      { title: "サブスクリプションフィルターの使用", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/SubscriptionFilters.html", note: "ログをFirehoseへ流す仕組み" },
      { title: "Amazon Data Firehoseとは", url: "https://docs.aws.amazon.com/ja_jp/firehose/latest/dev/what-is-this-service.html" },
      { title: "CloudWatch Logs Insightsによるログ分析", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/AnalyzingLogData.html", note: "直近ログのクイック調査に使う" },
      { title: "パーティション射影を使用したスキャン削減", url: "https://docs.aws.amazon.com/ja_jp/athena/latest/ug/partition-projection.html" }
    ]
  },
  alternatives: [
    {
      name: "OpenSearch Service（全文検索・ダッシュボード）",
      when: "エラーログの全文検索や、ダッシュボードでの常時監視・アラートが主目的の場合",
      diagram: {
        cols: 4, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 0] }
        ],
        nodes: [
          { id: "src", icon: "resources/documents", label: "アプリ/AWSの\n各種ログ", col: 0, row: 0 },
          { id: "cw", icon: "services/cloudwatch", label: "CloudWatch\nLogs", col: 1, row: 0 },
          { id: "os", icon: "services/opensearch", label: "OpenSearch\nService", col: 2, row: 0 },
          { id: "op", icon: "resources/users", label: "開発者・\n運用者", col: 3, row: 0 }
        ],
        edges: [
          { from: "src", to: "cw", label: "ログ出力" },
          { from: "cw", to: "os", label: "ログを配信" },
          { from: "op", to: "os", label: "検索・可視化" }
        ]
      },
      flow: [
        "CloudWatch Logsへの集約までは推奨構成と同じ",
        "サブスクリプションでOpenSearch Serviceへほぼリアルタイムにストリーミング配信し、検索インデックスを作る",
        "OpenSearch Dashboards（付属の画面）でキーワード検索・グラフ化・しきい値アラートを行う"
      ],
      services: [
        { icon: "services/cloudwatch", name: "Amazon CloudWatch Logs", role: "ログの受け口。OpenSearchへの配信元になる" },
        { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "全文検索エンジン＋可視化ダッシュボード。秒単位の検索応答とアラートを提供する" }
      ],
      points: [
        "OpenSearch Dashboardsの画面操作で検索・グラフ化できるため、SQLを書けないメンバーも調査に参加できる",
        "検索インデックスを常時持つ構成のため、費用はログ量よりノードの常時起動費が支配的。古いログはインデックスから削除し、長期保管はS3側に寄せる（保持期間の分離）のが定石",
        "「たまにしか調査しない」ならこの常時起動費は割に合わない。調査頻度が低いならAthena案が安い"
      ],
      pros: [
        "秒単位の検索応答と日本語含む全文検索",
        "ダッシュボード・アラートが標準装備で、監視基盤を兼ねられる"
      ],
      cons: [
        "常時起動費用が高い。最小構成でも月1万円前後、冗長化した実用構成なら数万円〜",
        "インデックス設計・ノードサイジングなど運用に専門知識が必要"
      ],
      cost: "<strong>月6,500円〜10万円程度</strong>。検証用の最小ノード（t3.small.search 1台+ストレージ20GB）で月6,500円前後、データノード3台の冗長構成なら月5万円前後が目安。ログ量が少なくても固定費が下がらない点は、採用前に正直に見積もっておくべき費目。",
      references: [
        { title: "Amazon OpenSearch Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/what-is.html" },
        { title: "CloudWatch LogsからOpenSearchへのストリーミング", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/CWL_OpenSearch_Stream.html" }
      ]
    },
    {
      name: "S3直接保存＋ライフサイクル（監査用の最安保管）",
      when: "検索はほとんど不要で、監査のために安く確実に残すことが目的の場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "auditor", icon: "resources/user", label: "監査担当", col: 0, row: 0 },
          { id: "src", icon: "resources/documents", label: "各システムの\nログ", col: 0, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nログ保管", col: 1, row: 1 },
          { id: "glacier", icon: "services/s3-glacier", label: "Glacier\n長期保管", col: 2, row: 1 }
        ],
        edges: [
          { from: "src", to: "s3", label: "直接保存" },
          { from: "s3", to: "glacier", label: "90日で移行" },
          { from: "auditor", to: "s3", label: "必要時に取り出し", dashed: true }
        ]
      },
      flow: [
        "各システムからS3へログを直接保存する（CLI/SDKやFirehose経由。中間の分析コンポーネントを置かない）",
        "ライフサイクルルール（保存日数に応じてストレージ層を自動で切り替える設定）で、90日後にGlacierなどの低頻度アクセス層へ移す",
        "監査などで必要になったときだけ取り出して確認する"
      ],
      services: [
        { icon: "services/s3", name: "Amazon S3", role: "ログの受け皿。書き込みは安く、耐久性99.999999999%で保全できる" },
        { icon: "services/s3-glacier", name: "Amazon S3 Glacier", role: "長期アーカイブ用の超低単価ストレージ層。読まないデータの置き場に特化" }
      ],
      points: [
        "Glacier Deep Archiveなら標準ストレージの約20分の1の保存単価で、「ほぼ読まないが消せない」データの置き場として最安クラス",
        "アーカイブ層は取り出しに数時間かかるものがある。監査対応の期限（例：翌営業日まで）と取り出し所要時間を必ず突き合わせてから層を選ぶ",
        "改ざん防止が要件ならS3 Object Lock（一定期間、削除・上書きを不可にする機能）を有効化する。後から検索が必要になれば、同じS3にAthenaを後付けできる"
      ],
      pros: [
        "保管費用が圧倒的に安く、仕組みが単純で壊れにくい",
        "後からAthena等を足して推奨構成へ育てられる"
      ],
      cons: [
        "検索性はほぼない（調査のたびに取り出し・整形が必要）",
        "アーカイブ層からの取り出しには時間と別途費用がかかる"
      ],
      cost: "<strong>月数百円〜数千円</strong>（月100GB・Glacier Deep Archive中心の前提）。3案の中で保管だけなら最安。ただし取り出し時に転送・復元の費用が別途かかることは覚えておく。",
      references: [
        { title: "S3ライフサイクルによるオブジェクト管理", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/object-lifecycle-mgmt.html" },
        { title: "Amazon S3ストレージクラスの概要", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/storage-class-intro.html", note: "Glacier各層の取り出し時間と単価" },
        { title: "S3 Object Lockの使用", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/object-lock.html", note: "改ざん防止（WORM）要件向け" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数千円〜3万円程度</strong>（ログ月100GB前提）で、費用はほぼログ量に比例する。OpenSearch案は<strong>月1万円〜10万円程度</strong>とノードの常時起動費が固定でかかり、検索の快適さと引き換えになる。S3直接保存案は<strong>月数百円〜数千円</strong>と最安だが検索性を捨てる。「どのくらいの頻度で、誰が検索するか」が3案を分ける軸。</p>",
  summary: "<p>ログ基盤の設計は「集める・保管する・検索する」の3工程に分けて考えると整理できます。集約はCloudWatch Logs、長期保管はS3という役割分担が現在の定石で、<strong>検索の頻度と応答要件だけが構成を分ける変数</strong>です。月数回の調査ならAthenaのスキャン課金で十分、毎日使う監視ダッシュボードが欲しければOpenSearchの固定費を払う価値があります。また、保持期間を「CloudWatch短期・S3長期」と分ける二層構えは、コスト事故を防ぐ実務の必須テクニックです。</p>",
  quiz: [
    {
      q: "ログの長期保管先をCloudWatch LogsではなくS3にしています。CloudWatch Logsに3年分置き続けると何が問題になるでしょうか。",
      a: "CloudWatch Logsの保存単価はS3より1桁高く、監査要件の3年分を溜め続けると保管費がじわじわと膨らみます。CloudWatch Logs側の保持期間は30日などに短く設定し、それ以降はFirehose経由でS3へ流して保管する二層構えにすれば、監査要件とコストを両立できます。S3側でさらにGlacier層へ落とせば単価はもう一段下がります。"
    },
    {
      q: "この構成で費用の中心になるのはどこでしょうか。最も効く節約策もあわせて考えてみましょう。",
      a: "費用の中心はCloudWatch Logsの取り込み料で、ログ量にほぼ完全に比例します。S3の保存料とAthenaのスキャン量は相対的に少額です。つまり最大の節約策は、構成の工夫ではなく<strong>出しっぱなしのデバッグログを減らす</strong>というアプリ側の見直しになります。基盤を作り込む前に、そもそも何を出力しているかを点検するのが順序です。"
    },
    {
      q: "障害対応チームから「毎日ダッシュボードでエラーを監視し、しきい値でアラートも出したい」と要望が来ました。あなたなら構成をどう変えるでしょうか。",
      a: "代替1のOpenSearch Serviceへ寄せます。秒単位の検索応答とダッシュボード・アラートが標準で備わり、SQLを書けないメンバーも画面操作で調査に参加できるためです。ただし常時起動費が月1万円前後から固定でかかるので、長期保管はS3のまま残し、OpenSearchのインデックスは直近30日などに限定して費用を抑えるのが定石です。"
    }
  ]
});
