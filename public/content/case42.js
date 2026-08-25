// ケース42：プッシュ通知・お知らせ配信基盤
registerCase({
  id: 42,
  category: "IoT・リアルタイム",
  title: "プッシュ通知・お知らせ配信基盤",
  scenario: "<p>会員数10万人のスマホアプリに、お知らせやキャンペーン情報をプッシュ通知で配信したい。全員向けの一斉配信だけでなく、「直近30日間に購入したユーザーだけ」のようなセグメント配信も行う。配信のピークは一斉配信の瞬間に集中し、数万件の通知を短時間で送り切る必要がある。誰にいつ何を送ったかの配信履歴も残したい。</p>",
  requirements: [
    "iOS（APNs）とAndroid（FCM）の両方へプッシュ通知を送りたい",
    "10万人への一斉配信を数分以内に送り切りたい",
    "宛先（デバイストークン）の管理とセグメント抽出が必要",
    "配信履歴（誰に・いつ・何を送ったか）を保存したい",
    "配信の失敗（無効トークン等）があっても全体が止まらないこと",
    "通知サーバーの常時運用はしたくない（配信時だけ動けばよい）"
  ],
  main: {
    name: "SNS + SQS + Lambda + DynamoDB（モバイルプッシュ配信基盤）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "admin", icon: "resources/client", label: "管理者\n配信指示", col: 0, row: 0 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway\n配信API", col: 1, row: 0 },
        { id: "sqs", icon: "services/sqs", label: "SQS\n配信ジョブ", col: 2, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\n配信ワーカー", col: 3, row: 0 },
        { id: "sns", icon: "services/sns", label: "SNS\nモバイルプッシュ", col: 4, row: 0 },
        { id: "mobile", icon: "resources/mobile-client", label: "会員の\nスマホアプリ", col: 5, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n宛先・配信履歴", col: 3, row: 1 }
      ],
      edges: [
        { from: "admin", to: "apigw", label: "配信リクエスト" },
        { from: "apigw", to: "sqs", label: "ジョブ投入" },
        { from: "sqs", to: "lambda", label: "取り出し" },
        { from: "lambda", to: "sns", label: "publish" },
        { from: "sns", to: "mobile", label: "プッシュ通知" },
        { from: "lambda", to: "ddb", label: "宛先取得・履歴" }
      ]
    },
    flow: [
      "管理者が配信APIを呼ぶと、API Gatewayが配信ジョブをSQS（キュー。処理待ちの列）に積む。受付と実際の配信を切り離すのがポイント",
      "LambdaがSQSからジョブを取り出し、DynamoDBから対象ユーザーのデバイストークン（端末ごとの宛先ID）を読み出す",
      "Lambdaが宛先ごとにSNSのプラットフォームエンドポイントへpublishすると、SNSがAPNs（iOS）とFCM（Android）の差分を吸収してプッシュ通知を届ける",
      "配信結果（成功・無効トークン等）をDynamoDBの履歴テーブルに書き込む。無効トークンは次回から除外する"
    ],
    services: [
      { icon: "services/sns", name: "Amazon SNS", role: "プッシュ通知の配信エンジン。APNs/FCMへの接続・認証情報の管理を肩代わりし、アプリ側はSNSにpublishするだけでよい" },
      { icon: "services/sqs", name: "Amazon SQS", role: "配信ジョブを一時的に貯めるキュー。一斉配信の瞬間的な負荷を平準化し、失敗ジョブの再実行も担う" },
      { icon: "services/lambda", name: "AWS Lambda", role: "配信ワーカー。宛先の抽出→SNSへのpublish→履歴記録を行う。配信時だけ動くのでサーバー常時運用が不要" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "デバイストークン（宛先）と配信履歴の保存先。会員IDをキーにした高速な読み書きが得意" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "管理画面や社内システムから配信を指示するためのAPIの入口。認証・流量制御もここで行う" }
    ],
    points: [
      "受付（API Gateway）と配信（Lambda）の間にSQSを挟むのが最大の工夫。10万件の一斉配信でも受付は一瞬で終わり、実際の送信はLambdaが並列に安定して処理できる",
      "SNSには「プラットフォームアプリケーション」としてAPNs/FCMの認証情報を登録しておく。OS間の差分（ペイロード形式など）をSNSが吸収してくれるため、自前でAPNs/FCMの接続を管理しなくてよい",
      "無効になったデバイストークン（アプリ削除等）はSNSがイベントで教えてくれるので、DynamoDBの宛先から外す掃除処理を入れておく。放置すると配信数と失敗率が増え続ける",
      "SQSにはデッドレターキュー（規定回数失敗したメッセージの退避先）を設定し、一部の失敗が全体の配信を止めない設計にする"
    ],
    pros: [
      "サーバーレス構成のため、配信がない時間帯のコストがほぼゼロ",
      "SQSがバッファになるため、10万件規模の一斉配信でも詰まらずスケールする",
      "APNs/FCMの接続管理をSNSに任せられ、自前実装より運用負荷が大幅に低い",
      "宛先・履歴がDynamoDBに揃うため、セグメント配信や効果測定に発展させやすい"
    ],
    cons: [
      "登場するサービスが多く、初学者には全体像の把握に時間がかかる",
      "セグメント抽出の条件が複雑になると、DynamoDBの設計（キー設計）に工夫が必要",
      "通知の開封率分析など高度なマーケティング機能は自前で作り込む必要がある"
    ],
    cost: "<strong>月数百円〜数千円程度</strong>（月100万通知の場合）。SNSのモバイルプッシュは100万件あたり約0.5USD、Lambda・SQS・DynamoDBはいずれも無料枠が大きく、通知量が少なければほぼ無料枠内。通知量に比例する純粋な従量課金で、待機コストがないのが強み。",
    references: [
      { title: "Amazon SNSモバイルプッシュ通知", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/sns-mobile-application-as-subscriber.html", note: "APNs/FCMへの配信のしくみ" },
      { title: "Amazon SNSとは", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/welcome.html" },
      { title: "LambdaとSQSの連携", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-sqs.html", note: "キューを処理するワーカーの作り方" },
      { title: "SQSデッドレターキュー", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html", note: "失敗メッセージの退避先" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "EventBridge起点のイベント駆動通知",
      when: "「注文完了」「発送済み」などシステム内のイベントに応じて自動で通知したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "src", icon: "resources/client", label: "各システム\nイベント発生", col: 0, row: 0 },
          { id: "eb", icon: "services/eventbridge", label: "EventBridge\nイベントバス", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n通知組み立て", col: 2, row: 0 },
          { id: "sns", icon: "services/sns", label: "SNS\nモバイルプッシュ", col: 3, row: 0 },
          { id: "mobile", icon: "resources/mobile-client", label: "会員の\nスマホアプリ", col: 4, row: 0 },
          { id: "sqs", icon: "services/sqs", label: "SQS\n他の後続処理", col: 1, row: 1 }
        ],
        edges: [
          { from: "src", to: "eb", label: "イベント送信" },
          { from: "eb", to: "lambda", label: "ルール一致" },
          { from: "lambda", to: "sns", label: "publish" },
          { from: "sns", to: "mobile", label: "プッシュ通知" },
          { from: "eb", to: "sqs", label: "別ルール" }
        ]
      },
      flow: [
        "注文システムなどの各システムが「注文完了」等のイベントをEventBridge（イベントの交通整理役）のイベントバスに送る",
        "EventBridgeのルールがイベントの種類ごとに宛先を振り分け、通知が必要なイベントだけLambdaを起動する",
        "Lambdaがイベント内容から通知文面を組み立て、SNS経由で対象ユーザーへプッシュ通知を送る",
        "同じイベントを別のルールでSQSにも流せば、ポイント付与など通知以外の後続処理も同時に自動化できる"
      ],
      services: [
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "イベントのハブ。「どのイベントが起きたらどこへ流すか」をルールとして宣言的に管理する" },
        { icon: "services/lambda", name: "AWS Lambda", role: "イベントの内容からユーザー向けの通知文面を組み立てて配信する" },
        { icon: "services/sns", name: "Amazon SNS", role: "組み立てた通知をAPNs/FCM経由でスマホに届ける" },
        { icon: "services/sqs", name: "Amazon SQS", role: "通知以外の後続処理（ポイント付与・メール送信など）を受け取る先の例" }
      ],
      points: [
        "「イベントを発生させる側」は通知のことを知らなくてよい、という疎結合が最大の価値。通知仕様が変わってもイベント送信側のコード修正が不要になる",
        "ルールはイベントのJSONパターンで書けるため、「金額が1万円以上の注文だけ通知」のような条件分岐をコードなしで実現できる",
        "1つのイベントを複数の宛先（Lambda・SQS・SNSなど）へ同時に流せるので、通知を起点に機能を後から追加しやすい",
        "手動の一斉配信が主目的なら推奨構成のほうが単純。イベント連動の自動通知が主目的ならこちらが向く、と使い分ける"
      ],
      pros: [
        "システム間が疎結合になり、通知機能の追加・変更が他システムに影響しない",
        "イベント条件による振り分けをコードなしで宣言的に管理できる",
        "通知以外の後続処理も同じイベント基盤に相乗りでき、拡張性が高い"
      ],
      cons: [
        "手動の一斉配信には向かず、別途配信ジョブのしくみが必要",
        "イベントがどこへ流れるかがルール設定に分散し、全体の追跡がしにくくなる",
        "イベント設計（命名・スキーマ）を最初に決めないと後で混乱しやすい"
      ],
      cost: "<strong>月数百円程度</strong>（月100万イベントの場合）。EventBridgeのカスタムイベントは100万件あたり約1USD。Lambda・SNSは推奨構成と同様に従量課金で、小規模なら無料枠内に収まる。",
      references: [
        { title: "Amazon EventBridgeとは", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-what-is.html" },
        { title: "EventBridgeルール", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-rules.html", note: "イベントの振り分け条件の書き方" },
        { title: "Amazon SNSでのメッセージの発行", url: "https://docs.aws.amazon.com/ja_jp/sns/latest/dg/sns-publishing.html" }
      ]
    },
    {
      name: "SES中心のメール通知基盤",
      when: "アプリを持たない会員にも届けたい・メルマガのような長文のお知らせが中心の場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "eb", icon: "services/eventbridge", label: "EventBridge\n定期起動", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n配信バッチ", col: 2, row: 0 },
          { id: "ses", icon: "services/ses", label: "SES\nメール送信", col: 3, row: 0 },
          { id: "email", icon: "resources/email", label: "会員の\nメールボックス", col: 4, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n宛先リスト", col: 2, row: 1 },
          { id: "sns", icon: "services/sns", label: "SNS\nバウンス通知", col: 3, row: 1 }
        ],
        edges: [
          { from: "eb", to: "lambda", label: "定期起動" },
          { from: "lambda", to: "ses", label: "送信API" },
          { from: "ses", to: "email", label: "メール配信" },
          { from: "lambda", to: "ddb", label: "宛先取得" },
          { from: "ses", to: "sns", label: "バウンス通知" },
          { from: "sns", to: "ddb", label: "配信停止更新" }
        ]
      },
      flow: [
        "EventBridgeのスケジュールが配信時刻にLambdaを起動する（即時配信ならAPIから直接起動でもよい）",
        "LambdaがDynamoDBの宛先リストからメールアドレスを読み出し、SES（マネージドのメール送信サービス）の送信APIを呼ぶ",
        "SESが会員のメールボックスへ配信する。SPF/DKIMなどの送信ドメイン認証を設定して迷惑メール判定を避ける",
        "バウンス（宛先不明で返送されたメール）や苦情はSESがSNS経由で通知するので、受け取って宛先リストに配信停止フラグを立てる"
      ],
      services: [
        { icon: "services/ses", name: "Amazon SES", role: "メール送信のマネージドサービス。大量送信・送信ドメイン認証・バウンス管理のしくみを提供する" },
        { icon: "services/lambda", name: "AWS Lambda", role: "宛先の読み出しと送信APIの呼び出しを行う配信バッチ" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "メールアドレスと配信可否フラグを持つ宛先リスト" },
        { icon: "services/sns", name: "Amazon SNS", role: "SESからのバウンス・苦情イベントを受け取り、後続の配信停止処理へつなぐ" },
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "配信バッチの定期起動スケジューラー" }
      ],
      points: [
        "メールはプッシュ通知と違いアプリ不要で全会員に届くが、開封されにくく即時性も低い。用途（緊急告知かメルマガか）で使い分ける",
        "バウンス率・苦情率が高いとSESの送信自体が制限されるため、バウンス処理（配信停止）の実装は飾りではなく必須",
        "SESは初期状態ではサンドボックス（検証済みアドレスにしか送れないお試しモード）のため、本番前に制限解除申請が必要",
        "実務ではプッシュ通知とメールの併用が多い。宛先管理をDynamoDBに共通化しておくと、チャネル追加時に設計を流用できる"
      ],
      pros: [
        "アプリを入れていない会員にも届く（到達範囲が最も広い）",
        "長文・画像つきのリッチなお知らせを送れる",
        "1,000通あたり約0.1USDと送信単価が安い"
      ],
      cons: [
        "迷惑メール判定・ドメイン認証（SPF/DKIM）などメール特有の運用知識が必要",
        "プッシュ通知に比べて即時性・開封率が低い",
        "バウンス・苦情管理を怠るとアカウント全体の送信が止められるリスクがある"
      ],
      cost: "<strong>月数百円〜数千円程度</strong>（月10万通の場合）。SESの送信は1,000通あたり約0.1USDで、10万通でも約10USD。Lambda・DynamoDBの費用は推奨構成と同様にごく小さい。",
      references: [
        { title: "Amazon SESとは", url: "https://docs.aws.amazon.com/ja_jp/ses/latest/dg/Welcome.html" },
        { title: "SESのSNS経由の通知", url: "https://docs.aws.amazon.com/ja_jp/ses/latest/dg/notifications-via-sns.html", note: "バウンス・苦情の受け取り方" },
        { title: "Amazon SQSとは", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html", note: "大量送信時のジョブ分割に応用できる" }
      ]
    }
  ],
  cost: "<p>推奨構成（SNSプッシュ）は<strong>月数百円〜数千円程度</strong>（月100万通知）。EventBridge案もほぼ同水準で、どちらも通知量に比例する従量課金。SESメール案は<strong>月10万通で1,000円台</strong>と単価は最安だが、チャネルの性質（即時性・開封率）が異なるため、費用よりも「どこに届けたいか」で選ぶのが正しい。3案とも常時起動のサーバーがなく、待機コストがほぼゼロという点は共通している。</p>",
  summary: "<p>プッシュ通知基盤の核心は「受付と配信を分ける」ことです。<strong>SQSを挟んで一斉配信の瞬間負荷を平準化し、APNs/FCMの面倒はSNSに任せる</strong>のが定石で、宛先と履歴をDynamoDBに集めておくとセグメント配信にも発展できます。イベント連動の自動通知が主役ならEventBridge起点、アプリ外の会員へ届けるならSESと、トリガー（誰が配信を起こすか）とチャネル（どこへ届けるか）の2軸で構成を選び分けましょう。</p>",
  quiz: [
    {
      q: "配信APIとLambdaのあいだにSQSを挟んでいるのは、10万人への一斉配信で何を防ぐためでしょうか。",
      a: "受付の応答が配信の重さに引きずられるのを防ぐためです。キューにジョブを積んだ時点で受付は完了するので管理画面は一瞬で応答を返せ、実際の送信はLambdaが並列に処理していきます。さらにデッドレターキューを設定しておけば、一部の宛先で失敗しても再試行され、全体の配信が止まりません。受付と処理を切り離すのは非同期処理の定石で、ケース15と同じ考え方です。"
    },
    {
      q: "無効になったデバイストークンを掃除する処理を、最初から入れておくべきなのはなぜでしょうか。",
      a: "アプリを削除した端末の宛先は時間とともに増え続け、放置すると配信対象と失敗数だけが膨らんでいくためです。SNSは無効になったトークンをイベントで教えてくれるので、それを受けてDynamoDBの宛先から外す仕組みにしておきます。効果測定の分母も汚れなくなるので、配信品質の面でも意味があります。運用が始まってからでは対象の特定が難しくなる類の処理です。"
    },
    {
      q: "「注文が完了したら自動で通知を送りたい」という要望が来たら、あなたならこの構成をどう発展させますか。",
      a: "代替1のEventBridge起点へ広げます。注文システムは「注文完了」というイベントを出すだけでよくなり、通知のことを知らずに済むため、通知仕様が変わっても注文側のコードを触らなくてよくなるからです。ルールのイベントパターンで「金額が1万円以上のときだけ通知」のような条件分岐もコードなしで書けます。手動の一斉配信も残るなら両方を併存させ、トリガーの種類ごとに経路を分けるのが実務的です。"
    }
  ]
});
