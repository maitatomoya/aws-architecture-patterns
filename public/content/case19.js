// ケース19：マイクロサービスのイベント連携
registerCase({
  id: 19,
  category: "サーバーレス・イベント駆動",
  title: "マイクロサービスのイベント連携",
  scenario: "<p>ECサイトを注文・配送・通知などのマイクロサービス（機能ごとに独立した小さなサービス）に分割して開発している。現在は注文サービスが配送・通知サービスのAPIを直接呼んでおり、通知サービスが落ちると注文まで失敗する。呼び先が増えるたびに注文サービスの改修も必要になってきた。「注文が確定した」という事実をイベントとして流し、興味のあるサービスが各自で受け取る疎結合な連携に変えたい。</p>",
  requirements: [
    "サービス間の直接依存をなくしたい（呼び先の障害に巻き込まれない）",
    "受け手のサービスを追加しても、送り手の改修を不要にしたい",
    "受け手が一時停止していてもイベントを取りこぼしたくない",
    "イベントの種類・内容に応じて配信先を振り分けたい",
    "運用するインフラは最小限にしたい"
  ],
  main: {
    name: "EventBridge + SQS + Lambda（疎結合化）",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "order", icon: "services/lambda", label: "注文サービス", col: 0, row: 0 },
        { id: "eb", icon: "services/eventbridge", label: "EventBridge\nイベントバス", col: 1, row: 0 },
        { id: "sqs1", icon: "services/sqs", label: "SQS\n配送用", col: 2, row: 0 },
        { id: "sqs2", icon: "services/sqs", label: "SQS\n通知用", col: 2, row: 1 },
        { id: "ship", icon: "services/lambda", label: "配送サービス", col: 3, row: 0 },
        { id: "notify", icon: "services/lambda", label: "通知サービス", col: 3, row: 1 }
      ],
      edges: [
        { from: "order", to: "eb", label: "イベント発行" },
        { from: "eb", to: "sqs1", label: "ルール配信" },
        { from: "eb", to: "sqs2", label: "ルール配信" },
        { from: "sqs1", to: "ship", label: "ポーリング" },
        { from: "sqs2", to: "notify", label: "ポーリング" }
      ]
    },
    flow: [
      "注文サービスは「注文確定」イベントをEventBridgeのイベントバスへ発行するだけで仕事を終える。誰が受け取るかは知らない",
      "EventBridgeのルール（イベント内容に対する振り分け条件）に一致したイベントが、受け手ごとに用意したSQSキューへ配信される",
      "各サービスのLambdaが自分のキューをポーリングし、自分のペースでイベントを処理する",
      "受け手を増やしたいときは、新しいルールとキューを追加するだけ。注文サービスのコードは1行も変わらない"
    ],
    services: [
      { icon: "services/eventbridge", name: "Amazon EventBridge", role: "イベントの受付と振り分けを行うイベントバス。送り手と受け手の間の共通の掲示板の役割" },
      { icon: "services/sqs", name: "Amazon SQS", role: "受け手ごとのバッファ。受け手が停止中でもイベントを溜めて取りこぼしを防ぐ" },
      { icon: "services/lambda", name: "AWS Lambda", role: "各マイクロサービスの実行環境。この図では発行側・受信側ともLambdaで表現" }
    ],
    points: [
      "EventBridgeから各サービスへ直接配信せず、必ず受け手ごとのSQSを1枚挟む。受け手が落ちている間のイベントはキューに残り、復旧後に処理を再開できる。リトライとDLQも受け手単位で管理できる",
      "イベントには「注文が確定した」という過去の事実を載せ、「配送せよ」という命令は載せない。命令にすると送り手が受け手を知っている状態に戻ってしまい、疎結合が崩れる",
      "ルールはイベントのJSON内容でフィルタできるため「合計金額1万円以上の注文だけギフト処理へ」のような振り分けを設定だけで実現できる",
      "イベントは重複して届き得るため、受け手側でイベントIDによる冪等化（同じイベントを2回処理しても結果が変わらない工夫）を行う。イベント連携全般の共通作法"
    ],
    pros: [
      "送り手と受け手が互いを知らない疎結合になり、障害の巻き込みが消える",
      "受け手の追加がルールとキューの追加だけで済み、拡張が速い",
      "内容ベースの柔軟なルーティングを設定だけで書ける",
      "フルマネージドでサーバー運用ゼロ、従量課金"
    ],
    cons: [
      "処理の全体像がコードから読み取れなくなり、イベントの流れを追う仕組み（命名規則・ドキュメント・トレーシング）が必要",
      "非同期になるため「注文APIの応答時点で配送手配済み」のような同期的な保証はできない",
      "EventBridgeの配信レイテンシーは数百ミリ秒程度あり、ミリ秒単位の即時性が必要な連携には不向き"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（月1,000万イベント前提でEventBridge約1,500円+SQS・Lambdaの従量分。イベント数が少なければ無料枠内に収まる）。",
    references: [
      { title: "Amazon EventBridgeとは", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-what-is.html", note: "イベントバス・ルールの公式解説" },
      { title: "Amazon SQSとは", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html" },
      { title: "LambdaとAmazon SQSの連携", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-sqs.html", note: "キュー消化側の実装の一次情報" },
      { title: "SQSデッドレターキュー", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html", note: "受け手単位の失敗管理" }
    ]
  },
  alternatives: [
    {
      name: "SNS + SQSファンアウト",
      when: "内容による振り分けが不要で「1つのイベントを全員に同報する」だけの単純な連携を最安・最小遅延で作りたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "order", icon: "services/lambda", label: "注文サービス", col: 0, row: 0 },
          { id: "sns", icon: "services/sns", label: "SNS\nトピック", col: 1, row: 0 },
          { id: "sqs1", icon: "services/sqs", label: "SQS\n配送用", col: 2, row: 0 },
          { id: "sqs2", icon: "services/sqs", label: "SQS\n通知用", col: 2, row: 1 },
          { id: "ship", icon: "services/lambda", label: "配送サービス", col: 3, row: 0 },
          { id: "notify", icon: "services/lambda", label: "通知サービス", col: 3, row: 1 }
        ],
        edges: [
          { from: "order", to: "sns", label: "Publish" },
          { from: "sns", to: "sqs1", label: "ファンアウト" },
          { from: "sns", to: "sqs2", label: "ファンアウト" },
          { from: "sqs1", to: "ship", label: "ポーリング" },
          { from: "sqs2", to: "notify", label: "ポーリング" }
        ]
      },
      flow: [
        "注文サービスがSNSトピック（配信先リストを束ねる宛先）へイベントをPublishする",
        "SNSは購読しているすべてのSQSキューへ同じメッセージを即時に複製配信する（ファンアウト＝扇状に広げる配信）",
        "各サービスのLambdaが自分のキューを消化する。受け手の追加はキューを購読させるだけ",
        "細かい振り分けが必要な場合はフィルタポリシーで属性ベースの絞り込みもできる"
      ],
      services: [
        { icon: "services/sns", name: "Amazon SNS", role: "1対多の同報配信を行うPub/Subサービス。シンプルさと低遅延・低価格が持ち味" },
        { icon: "services/sqs", name: "Amazon SQS", role: "受け手ごとのバッファ。SNS直配信ではなくキューを挟むのはEventBridge案と同じ理由" },
        { icon: "services/lambda", name: "AWS Lambda", role: "各マイクロサービスの実行環境" }
      ],
      points: [
        "SNS+SQSはAWSで最も古典的なファンアウト構成。EventBridgeより配信が速く、メッセージ単価も安い",
        "フィルタはメッセージ属性（本文とは別のタグ）に対する単純な条件のみ。本文JSONの中身で振り分けたくなったらEventBridgeへの乗り換えサイン",
        "SNS→SQSの購読時はアクセスポリシーの設定（SNSからの書き込み許可）を忘れやすいので注意。IaC化して定型化するのが実務の定石",
        "スキーマ管理・SaaS連携・アーカイブ再送などの高機能は無い。必要になった機能から逆算してEventBridgeと使い分ける"
      ],
      pros: [
        "構成が最小で理解しやすく、配信遅延も小さい",
        "メッセージ単価がEventBridgeより安く、大量イベントでも低コスト",
        "SNS→SQS間の配信は無料"
      ],
      cons: [
        "本文の内容に基づく高度なルーティングはできない",
        "イベントのアーカイブ・リプレイ（過去イベントの再配信）機能が無い",
        "トピックが増えると購読関係の管理が煩雑になりがち"
      ],
      cost: "<strong>月数百円程度</strong>（月1,000万イベント前提でSNS約750円、SNS→SQS配信は無料。3案の中で最安になりやすい）。",
      references: [
        { title: "Amazon SNSの一般的なシナリオ（ファンアウト）", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/sns-common-scenarios.html", note: "ファンアウト構成の公式解説" },
        { title: "SNSトピックへのSQSキューのサブスクライブ", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/sns-sqs-as-subscriber.html", note: "アクセスポリシー設定を含む手順" }
      ]
    },
    {
      name: "Amazon MSK（Apache Kafka）",
      when: "秒間数万件級のイベントストリームを扱う場合や、既存のKafka資産・Kafka前提のツール群を活かしたい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [5, 1] },
          { type: "vpc", label: "VPC", from: [1, 0], to: [5, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [2, 0], to: [2, 0], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [5, 1], depth: 2 }
        ],
        nodes: [
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 1, row: 0 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 2, row: 0 },
          { id: "order", icon: "services/ecs", label: "注文サービス\nECS", col: 3, row: 0 },
          { id: "msk", icon: "services/msk", label: "MSK\nKafkaクラスター", col: 4, row: 0 },
          { id: "ship", icon: "services/ecs", label: "在庫サービス\nECS", col: 5, row: 0 },
          { id: "notify", icon: "services/ecs", label: "通知サービス\nECS", col: 5, row: 1 }
        ],
        edges: [
          { from: "order", to: "msk", label: "Produce" },
          { from: "msk", to: "ship", label: "Consume" },
          { from: "msk", to: "notify", label: "Consume" },
          { from: "order", to: "nat", dashed: true },
          { from: "nat", to: "igw", dashed: true }
        ]
      },
      flow: [
        "各マイクロサービス（ECSコンテナ）はVPCのプライベートサブネットで動き、注文サービスがKafkaのトピックへイベントをProduce（発行）する",
        "MSKはKafkaクラスターをマネージドで運用し、イベントをディスクに一定期間保存する。コンシューマーグループごとに読み取り位置が管理される",
        "在庫・通知サービスはそれぞれ独立したペースでConsume（購読）し、新サービスは過去分をさかのぼって読み直すこともできる",
        "コンテナイメージ取得などの外向き通信はNATゲートウェイからインターネットゲートウェイを通って出る（破線）。イベント連携自体はVPC内で完結する"
      ],
      services: [
        { icon: "services/msk", name: "Amazon MSK", role: "Apache Kafkaのマネージドサービス。超高スループットのイベントストリームと一定期間の保存・再読込を提供" },
        { icon: "services/ecs", name: "Amazon ECS", role: "各マイクロサービスの実行基盤。Kafkaクライアントは常駐プロセスと相性がよい" },
        { icon: "resources/nat-gateway", name: "NATゲートウェイ", role: "プライベートサブネットからの外向き通信の出口" },
        { icon: "resources/internet-gateway", name: "インターネットゲートウェイ", role: "VPCとインターネットの境界。この構成の入口兼出口" }
      ],
      points: [
        "Kafkaはイベントを消費後も保持し続けるログ型のため「後から参加したサービスが過去イベントを最初から読む」ことができる。SQS型（読んだら消える）との最大の思想差",
        "パーティション内でイベントの順序が保証される。「同じ注文IDのイベントは必ず順番に処理したい」という要件に強い",
        "MSKはVPC内に置くサービスのため、サーバーレス2案には無かったVPC・サブネット・ゲートウェイ類の設計がここで必要になる",
        "ブローカーのサイジング・パーティション設計・クライアントの再接続処理など、マネージドとはいえKafka固有の運用知識は必要。専任がいない小規模チームには過剰装備になりやすい"
      ],
      pros: [
        "秒間数万件以上の高スループットに耐え、順序保証・再読込ができる",
        "Kafka互換のOSSエコシステム（Connect・Streams等）や既存資産をそのまま使える",
        "イベントを長期保持でき、イベントソーシング的な設計にも対応する"
      ],
      cons: [
        "クラスター常時稼働の固定費がかかり、少量イベントでは大幅に割高",
        "VPC設計とKafka運用の学習コストが高い",
        "受け手の追加もコンシューマー実装が必要で、設定だけでは完結しない"
      ],
      cost: "<strong>月1万円〜10万円超</strong>（検証用kafka.t3.small×2台で約1万円、本番想定のkafka.m5.large×3台で約8万円+ストレージ・NAT代。イベント量が多いほど1件単価で逆転する）。",
      references: [
        { title: "Amazon MSKとは", url: "https://docs.aws.amazon.com/ja_jp/msk/latest/developerguide/what-is-msk.html", note: "MSK公式デベロッパーガイド" },
        { title: "Amazon ECSとは", url: "https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/Welcome.html" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html", note: "外向き通信経路の一次情報" }
      ]
    }
  ],
  cost: "<p>推奨構成（EventBridge+SQS+Lambda）は<strong>月数百円〜数千円</strong>、SNS+SQS案はさらに安く<strong>月数百円程度</strong>で、どちらもイベントが無ければほぼ0円。MSK案はクラスター常時稼働のため<strong>月1万円〜10万円超</strong>の固定費型。イベント量が秒間数万件を超えるあたりから、従量課金2案よりMSKの方が1件あたりの単価で安くなる逆転が起きる。</p>",
  summary: "<p>マイクロサービス連携の本質は<strong>「APIの直接呼び出し（命令）をイベント（事実の通知）に置き換えて依存を切る」</strong>ことです。振り分けの賢さが欲しければEventBridge、単純な同報だけならSNS+SQS、量と順序とやり直しが問題になったらKafka（MSK）、と覚えましょう。どの案でも共通するのは、受け手の前に必ずキューを置いて取りこぼしを防ぐことと、冪等化を受け手の責任として実装すること。この2つはイベント駆動設計の土台です。</p>"
});
