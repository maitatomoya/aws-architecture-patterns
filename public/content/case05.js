// ケース5：ライブ配信サービス
registerCase({
  id: 5,
  category: "Webサイト・配信",
  title: "ライブ配信サービス",
  scenario: "<p>セミナーやイベントのライブ配信サービスを作りたい。配信者はOBS（定番の無料配信ソフト）から映像を送出し、視聴者はブラウザやスマホアプリで視聴する。視聴しながらリアルタイムにチャットで質問やコメントを送れるようにしたい。同時視聴者は数十人〜数千人まで変動する。配信インフラの専門知識を持つメンバーはおらず、少人数で運営する。</p>",
  requirements: [
    "OBS等の標準的な配信ソフトから映像を受け取れること",
    "視聴の遅延は数秒以内に抑えたい（チャットでのやり取りが成立する程度）",
    "同時視聴者数十人〜数千人の変動に自動で追従すること",
    "リアルタイムチャット機能をつけたいこと",
    "配信サーバーの構築・スケーリング運用はやりたくない"
  ],
  main: {
    name: "Amazon IVS + API Gateway WebSocket + Lambda + DynamoDB",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "streamer", icon: "resources/client", label: "配信者\nOBS等", col: 0, row: 0 },
        { id: "ivs", icon: "services/ivs", label: "Amazon IVS\nライブ配信", col: 2, row: 0 },
        { id: "users", icon: "resources/users", label: "視聴者", col: 0, row: 1 },
        { id: "apigw", icon: "services/api-gateway-websocket", label: "API Gateway\nWebSocket", col: 2, row: 1 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\nチャット処理", col: 3, row: 1 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nチャット履歴", col: 4, row: 1 }
      ],
      edges: [
        { from: "streamer", to: "ivs", label: "RTMPS送出" },
        { from: "ivs", to: "users", label: "低遅延再生" },
        { from: "users", to: "apigw", label: "チャット送受信" },
        { from: "apigw", to: "lambda", label: "メッセージ処理" },
        { from: "lambda", to: "ddb", label: "保存・取得" }
      ]
    },
    flow: [
      "配信者はOBSからIVSのエンドポイントへRTMPS（暗号化された配信プロトコル）で映像を送出する",
      "IVSが受信した映像の変換（複数画質化）と世界規模の配信網への展開までを一括で行い、視聴者は専用プレイヤーSDKで2〜5秒程度の低遅延再生ができる",
      "チャットはAPI GatewayのWebSocket API（サーバーからもクライアントへ送信できる常時接続の仕組み）で受け付ける",
      "受信したメッセージはLambdaが処理してDynamoDBに保存し、同じ配信ルームの全接続へ配信する",
      "この構成にVPCやゲートウェイ類が登場しないのは、IVS・API Gateway・Lambda・DynamoDBがすべてVPC外のマネージドサービスだから"
    ],
    services: [
      { icon: "services/ivs", name: "Amazon IVS", role: "ライブ配信のマネージドサービス。映像の受信・変換・CDN配信・プレイヤーSDKまで一式を提供" },
      { icon: "services/api-gateway-websocket", name: "API Gateway（WebSocket API）", role: "チャット用の双方向通信の入口。接続の維持と各接続へのメッセージ送信を担う" },
      { icon: "services/lambda", name: "AWS Lambda", role: "チャットメッセージの検証・保存・配信ルーム内への一斉送信を行う処理" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "チャット履歴と接続情報の保存先。接続数の急増にも安定して応答する" }
    ],
    points: [
      "ライブ配信の自前構築で最難関になる「同時視聴者数に応じた配信サーバーのスケーリング」を、IVSがサービスとして丸ごと引き受けてくれるのがこの構成の核心",
      "遅延数秒の「低遅延」はIVSの標準機能で足りる。双方向通話レベル（1秒未満）が必要ならIVSのリアルタイム機能やWebRTC系の別設計になるため、要件の遅延許容値を最初に確認する",
      "チャットの接続情報（どの接続がどのルームにいるか）はDynamoDBに持たせ、Lambdaを完全にステートレスにするのがWebSocket構成の定石",
      "チャット履歴にDynamoDBのTTL（期限が来た項目を自動削除する機能）を設定すると、古いメッセージの削除バッチを作らずに済む"
    ],
    pros: [
      "配信サーバーの構築・運用が不要で、少人数でもライブ配信サービスを成立させられる",
      "同時視聴者数の急増にIVS側が自動で追従する",
      "チャット部分もサーバーレスで、配信がない時間帯の固定費がほぼゼロ",
      "プレイヤーSDKが提供されるため、Web・iOS・Androidの再生実装が早い"
    ],
    cons: [
      "IVSの利用料は配信時間と視聴時間に比例するため、長時間・大人数の配信ではコストが大きくなる",
      "映像処理の細かいカスタマイズ（特殊な合成・独自プロトコル）はできない",
      "WebSocketのチャットは接続管理・再接続処理などクライアント側の作り込みがそれなりに必要"
    ],
    cost: "<strong>月数千円〜数十万円（配信時間×視聴時間に比例）</strong>。IVSは「入力（配信時間）」と「出力（延べ視聴時間）」の従量課金で、週数時間の配信×同時視聴数十人なら月数千円程度、同時視聴数千人の長時間配信では出力課金が支配的になり数十万円規模もあり得る。最新単価は公式料金ページで必ず確認すること。",
    references: [
      { title: "Amazon IVS（低遅延ストリーミング）とは", url: "https://docs.aws.amazon.com/ja_jp/ivs/latest/LowLatencyUserGuide/what-is.html" },
      { title: "API GatewayのWebSocket API", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-websocket-api.html", note: "チャットの双方向通信の仕組み" },
      { title: "DynamoDBのTTLによる項目の自動削除", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/TTL.html" },
      { title: "Amazon IVSの料金", url: "https://aws.amazon.com/jp/ivs/pricing/", note: "入力・出力課金の最新単価" }
    ]
  },
  alternatives: [
    {
      name: "EC2 + nginx-rtmpで自前構築",
      when: "配信プロトコルや映像処理を細かく制御したい・学習目的や小規模で固定費を読める形にしたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [3, 0], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [3, 0], to: [3, 0], depth: 2 }
        ],
        nodes: [
          { id: "streamer", icon: "resources/client", label: "配信者\nOBS等", col: 0, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 2, row: 0 },
          { id: "ec2", icon: "services/ec2", label: "EC2\nnginx-rtmp", col: 3, row: 0 },
          { id: "users", icon: "resources/users", label: "視聴者", col: 0, row: 1 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 2, row: 1 }
        ],
        edges: [
          { from: "streamer", to: "igw", label: "RTMP送出" },
          { from: "igw", to: "ec2" },
          { from: "cf", to: "ec2", label: "オリジン取得" },
          { from: "users", to: "cf", label: "HLS視聴" }
        ]
      },
      flow: [
        "配信者はOBSから、インターネットゲートウェイを通ってパブリックサブネットのEC2（nginxのRTMPモジュール）へ映像を送出する",
        "EC2上のnginx-rtmpとFFmpegが映像を受信してHLSに変換し、EC2自身がHTTPで配信できる状態にする",
        "視聴者にはCloudFront経由で配信し、EC2から直接配信する帯域と負荷を抑える",
        "チャットが必要な場合は推奨構成と同じWebSocket構成を併設する（図では省略）"
      ],
      services: [
        { icon: "services/ec2", name: "Amazon EC2", role: "nginx-rtmp（RTMP受信）とFFmpeg（変換）を動かす仮想サーバー。構築・監視・増強は自前" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "変換されたHLSをキャッシュ配信し、EC2の配信負荷と転送料を軽減する" }
      ],
      points: [
        "HLS変換後の配信は静的ファイルの連続なので、CloudFrontを前段に置けば視聴者数の増加はかなり吸収できる。ボトルネックは受信・変換を担うEC2側に残る",
        "遅延はHLSの特性上10〜30秒程度になりがちで、IVSの数秒遅延より大きい。チャットとの一体感を求める配信には不利",
        "EC2が1台構成なら、そのインスタンス障害＝配信全断となる。本番イベントでは予備系や再送出の手順を用意しておく",
        "EC2から直接配信するとアウト転送料（GB単価がCloudFrontより高く無料枠も小さい）がかさむため、必ずCDNを挟む"
      ],
      pros: [
        "nginx-rtmpとFFmpegの設定次第で、録画・合成・再エンコードなどを自由に組める",
        "インスタンス料金ベースなので、小規模なら費用の上限を読みやすい",
        "ライブ配信の仕組み（RTMP受信→変換→HLS配信）を手を動かして学べる"
      ],
      cons: [
        "配信サーバーの構築・監視・障害対応・スケーリングをすべて自前で行う必要がある",
        "同時視聴者や配信本数が増えたときの増強設計（受信サーバーの分散）が難しい",
        "遅延がIVSより大きく、低遅延要件には応えにくい"
      ],
      cost: "<strong>月5,000円〜2万円程度＋転送量</strong>（c5.large相当を配信時間だけ起動する運用か常時起動かで変動）。インスタンス費より、視聴者数に比例するCloudFront転送量（1TBで1万円台）が支配的になりやすい。",
      references: [
        { title: "Amazon EC2とは", url: "https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/concepts.html" },
        { title: "EC2インスタンスタイプ", url: "https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/instance-types.html", note: "変換処理はCPU性能が要るためc系が候補" },
        { title: "CloudFrontを使用したライブ動画の配信", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/live-streaming.html" }
      ]
    },
    {
      name: "録画アーカイブをS3 + MediaConvertでVOD化",
      when: "ライブ終了後に見逃し配信・アーカイブ視聴を提供したい場合（ライブ配信への追加要素）",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "streamer", icon: "resources/client", label: "配信者\nOBS等", col: 0, row: 0 },
          { id: "ivs", icon: "services/ivs", label: "Amazon IVS\nライブ配信", col: 1, row: 0 },
          { id: "s3rec", icon: "services/s3", label: "S3\n録画アーカイブ", col: 2, row: 0 },
          { id: "mc", icon: "services/mediaconvert", label: "MediaConvert\nVOD用変換", col: 3, row: 0 },
          { id: "s3out", icon: "services/s3", label: "S3\n配信用HLS", col: 4, row: 0 },
          { id: "users", icon: "resources/users", label: "視聴者", col: 0, row: 1 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 4, row: 1 }
        ],
        edges: [
          { from: "streamer", to: "ivs", label: "ライブ配信" },
          { from: "ivs", to: "s3rec", label: "自動録画" },
          { from: "s3rec", to: "mc", label: "録画読込" },
          { from: "mc", to: "s3out", label: "変換出力" },
          { from: "users", to: "cf", label: "HTTPS" },
          { from: "cf", to: "s3out" }
        ]
      },
      flow: [
        "IVSの自動録画（Auto-Record to S3）を有効にすると、ライブ配信の映像がそのままS3に保存される",
        "録画完了をイベントで検知し、MediaConvertで見逃し配信用のHLS（必要ならハイライト用mp4も）へ変換する",
        "変換後はケース4のVOD構成と同じく、CloudFront+S3で配信する",
        "ライブ（IVS）とアーカイブ（VOD）で再生URLが分かれるため、アプリ側は配信状態に応じて出し分ける"
      ],
      services: [
        { icon: "services/ivs", name: "Amazon IVS", role: "ライブ配信本体。自動録画機能でS3への保存までを担う" },
        { icon: "services/s3", name: "Amazon S3", role: "録画アーカイブと変換後ファイルの保存先" },
        { icon: "services/mediaconvert", name: "AWS Elemental MediaConvert", role: "録画をVOD向けの画質構成へ変換。不要部分のカットやmp4化にも使える" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "アーカイブ視聴のCDN配信" }
      ],
      points: [
        "ライブとVODは配信の性質が別物なので、無理に1つの仕組みにせず「ライブはIVS、アーカイブはVODパイプライン」と分けるのが素直な設計。VOD側の詳細はケース4を参照",
        "IVSの録画はライブ時の画質構成そのままなので、長期保存や画質の整理をしたい場合にMediaConvertでの再変換を挟む価値がある",
        "録画をそのまま公開するだけなら、MediaConvertを挟まずIVS録画のHLSをCloudFrontで配信する簡易構成も選べる",
        "アーカイブが増え続けるS3にはライフサイクルルール（一定期間後に低頻度アクセス層へ移す）を設定して保存費を抑える"
      ],
      pros: [
        "ライブの価値を見逃し配信として二次利用でき、コンテンツ資産が積み上がる",
        "録画の取得がIVSの設定1つで済み、録画サーバーが不要",
        "VOD側はケース4の構成をそのまま流用できる"
      ],
      cons: [
        "ライブとVODの2系統を管理することになり、メタデータや公開状態の整合を取る仕組みが必要",
        "変換をたくさん挟むほどMediaConvertの変換費が積み上がる",
        "録画の保存費は配信本数に比例して増え続けるため、保存期間のルールを決めておく必要がある"
      ],
      cost: "<strong>ライブ構成に月数百円〜数万円の追加</strong>（録画保存のS3費用：100GBで月300円程度、変換費は変換した分数に比例、アーカイブ視聴の転送量は視聴数に比例）。見逃し視聴が多いサービスでは、ライブよりアーカイブ側の転送費が大きくなることも珍しくない。",
      references: [
        { title: "IVSの自動録画（Auto-Record to S3）", url: "https://docs.aws.amazon.com/ja_jp/ivs/latest/LowLatencyUserGuide/record-to-s3.html", note: "録画設定の公式手順" },
        { title: "AWS Elemental MediaConvertとは", url: "https://docs.aws.amazon.com/ja_jp/mediaconvert/latest/ug/what-is.html" },
        { title: "CloudFrontを使用したオンデマンド動画配信", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/on-demand-streaming-video.html", note: "ケース4で扱うVOD構成" }
      ]
    }
  ],
  cost: "<p>推奨構成（IVS）は<strong>配信時間×延べ視聴時間の従量課金</strong>で、小規模なら月数千円、同時視聴数千人規模では数十万円もあり得る。自前構築（EC2+nginx-rtmp）は<strong>月5,000円〜2万円程度＋転送量</strong>で小規模なら安く見えるが、スケーリングと障害対応の人件費が隠れコストになる。アーカイブVOD化は<strong>月数百円〜数万円の追加</strong>。ライブ配信の費用は「配信時間」より「視聴者数×視聴時間」が支配するという構造を押さえておくと見積もりを外しにくい。</p>",
  summary: "<p>ライブ配信は「受信・変換・大規模配信・低遅延」を同時に満たす必要があり、自前構築の難度が非常に高い領域です。だからこそ<strong>マネージドのIVSに配信部分を丸ごと任せ、チャットなど周辺機能をサーバーレスで組む</strong>のが少人数チームの現実解になります。自前構築（nginx-rtmp）は要件が特殊な場合や学習用途では価値がありますが、本番の低遅延・大規模要件には不利です。またライブは「終わったらVODになる」のが定番の発展形なので、ケース4のVOD構成とセットで理解しておくと設計の引き出しが増えます。</p>"
});
