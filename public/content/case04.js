// ケース4：動画配信サービス（VOD）
registerCase({
  id: 4,
  category: "Webサイト・配信",
  title: "動画配信サービス（VOD）",
  scenario: "<p>教育講座やセミナー動画をオンデマンド配信（VOD：視聴者が好きなタイミングで再生する方式）するサービスを作りたい。運営が収録済みの動画をアップロードすると、PC・スマホのどちらでも快適に再生できる形で公開される。動画は数百本、1本あたり10〜60分。視聴者は数千人規模から始めて拡大したい。エンコード（動画変換）の知識が深いメンバーはいない。</p>",
  requirements: [
    "アップロードした動画を、回線速度に応じて画質が切り替わる形式（アダプティブビットレート）で配信したい",
    "PC・スマホ・タブレットの標準的なプレイヤーで再生できること",
    "視聴者数の増加に配信インフラが自動で追従すること",
    "動画のタイトル・再生時間・公開状態などのメタデータを管理したい",
    "エンコード用サーバーの構築・運用はやりたくない"
  ],
  main: {
    name: "S3 + MediaConvert + CloudFront + DynamoDB（マネージドVODパイプライン）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "uploader", icon: "resources/client", label: "運営\n動画入稿", col: 0, row: 0 },
        { id: "s3src", icon: "services/s3", label: "S3\n元動画", col: 1, row: 0 },
        { id: "mc", icon: "services/mediaconvert", label: "MediaConvert\nエンコード", col: 2, row: 0 },
        { id: "s3out", icon: "services/s3", label: "S3\n配信用HLS", col: 3, row: 0 },
        { id: "users", icon: "resources/users", label: "視聴者", col: 0, row: 1 },
        { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 3, row: 1 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\nメタデータ", col: 4, row: 1 }
      ],
      edges: [
        { from: "uploader", to: "s3src", label: "アップロード" },
        { from: "s3src", to: "mc", label: "元動画読込" },
        { from: "mc", to: "s3out", label: "HLS出力" },
        { from: "mc", to: "ddb", label: "完了情報を記録", dashed: true },
        { from: "users", to: "cf", label: "HTTPS" },
        { from: "cf", to: "s3out" }
      ]
    },
    flow: [
      "運営が元動画（mp4等）をS3の入稿用バケットにアップロードする",
      "アップロードをイベントとして検知し、MediaConvertのエンコードジョブを起動する（検知にはEventBridgeとLambdaを使うのが定石。図では省略）",
      "MediaConvertが複数画質のHLS（数秒ごとの細切れファイル＋再生リストで構成されるストリーミング形式）に変換し、配信用のS3バケットへ出力する",
      "変換完了時にタイトル・再生時間・画質・配信URLなどのメタデータをDynamoDBに記録し、アプリはここから動画一覧を組み立てる",
      "視聴者はCloudFront経由でHLSを再生する。細切れファイルはキャッシュが効きやすく、視聴者が増えてもS3への負荷はほとんど増えない"
    ],
    services: [
      { icon: "services/s3", name: "Amazon S3", role: "元動画と変換後の配信用ファイルの保存先。動画のような大容量データを安価に保存できる" },
      { icon: "services/mediaconvert", name: "AWS Elemental MediaConvert", role: "マネージドの動画変換サービス。複数画質のHLS/DASHへの変換をジョブ投入だけで行える" },
      { icon: "services/cloudfront", name: "Amazon CloudFront", role: "CDN。HLSの細切れファイルをエッジでキャッシュ配信し、視聴者数の増加を吸収する" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "動画のタイトル・再生時間・公開状態などメタデータの保存先。動画IDでの高速な取得に向く" }
    ],
    points: [
      "動画配信は「変換パイプライン」と「配信」を分けて考えるのが基本。この構成はどちらもマネージドサービスで、自前のサーバーが1台もない",
      "HLSは動画を数秒単位のファイルに分割するため、CDNキャッシュとの相性が抜群に良い。視聴者1万人でもオリジンのS3から取得されるのは各ファイル1回だけになり得る",
      "元動画バケットと配信用バケットを分けると、権限管理（元動画は非公開のまま）とライフサイクル管理（元動画は低頻度アクセス層へ移動）がしやすい",
      "S3はCloudFrontからのみ読めるようOAC（Origin Access Control）を設定し、バケットの直URLでは再生できないようにする"
    ],
    pros: [
      "エンコードサーバーの構築・キャパシティ管理が不要（ジョブ課金のマネージドサービス）",
      "視聴者が何倍に増えてもCloudFront+S3が自動で受け止める",
      "アイドル時のコストが小さい（保存料以外はほぼ従量課金）",
      "複数画質・字幕・サムネイル生成など、動画配信に必要な変換機能が最初から揃っている"
    ],
    cons: [
      "MediaConvertの変換課金は動画の長さ・画質に比例するため、大量入稿時のコスト見積もりが必要",
      "変換ジョブの起動・完了通知の配線（EventBridge・Lambda）は自分で作る必要がある",
      "DRM（コンテンツ暗号化による著作権保護）まで必要になると構成が一段複雑になる"
    ],
    cost: "<strong>月数千円〜10万円超（視聴量に比例）</strong>。内訳の目安：HD動画の変換が1分あたり1〜3円程度、S3保存が100GBで月300円程度、支配的なのはCloudFrontの転送量（1TBで1万円台）。視聴が少ない初期は月数千円で収まり、視聴時間が伸びると転送費が主コストになる。",
    references: [
      { title: "AWS Elemental MediaConvertとは", url: "https://docs.aws.amazon.com/ja_jp/mediaconvert/latest/ug/what-is.html" },
      { title: "CloudFrontを使用したオンデマンド動画配信", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/on-demand-streaming-video.html", note: "この構成そのものの公式解説" },
      { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html", note: "アップロード検知の仕組み" },
      { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" }
    ]
  },
  alternatives: [
    {
      name: "EC2 / AWS Batch + FFmpegで自前エンコード",
      when: "特殊な変換要件（独自フィルタ・特殊コーデック）がある、または変換量が膨大でマネージドの変換単価が見合わない場合",
      diagram: {
        cols: 6, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 2] },
          { type: "vpc", label: "VPC", from: [1, 1], to: [4, 1], depth: 1 },
          { type: "public-subnet", label: "パブリックサブネット", from: [2, 1], to: [2, 1], depth: 2 },
          { type: "private-subnet", label: "プライベートサブネット", from: [4, 1], to: [4, 1], depth: 2 }
        ],
        nodes: [
          { id: "uploader", icon: "resources/client", label: "運営\n動画入稿", col: 0, row: 0 },
          { id: "s3src", icon: "services/s3", label: "S3\n元動画", col: 2, row: 0 },
          { id: "igw", icon: "resources/internet-gateway", label: "インターネット\nゲートウェイ", col: 1, row: 1 },
          { id: "nat", icon: "resources/nat-gateway", label: "NAT\nゲートウェイ", col: 2, row: 1 },
          { id: "batch", icon: "services/batch", label: "AWS Batch\nFFmpeg変換", col: 4, row: 1 },
          { id: "s3out", icon: "services/s3", label: "S3\n配信用HLS", col: 5, row: 1 },
          { id: "users", icon: "resources/users", label: "視聴者", col: 0, row: 2 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 5, row: 2 }
        ],
        edges: [
          { from: "uploader", to: "s3src", label: "アップロード" },
          { from: "s3src", to: "batch", label: "元動画読込" },
          { from: "batch", to: "s3out", label: "変換結果を保存" },
          { from: "batch", to: "nat", label: "イメージ取得", dashed: true },
          { from: "nat", to: "igw", dashed: true },
          { from: "cf", to: "s3out", label: "オリジン取得" },
          { from: "users", to: "cf", label: "HTTPS" }
        ]
      },
      flow: [
        "アップロードをイベントで検知し、AWS Batchに変換ジョブを投入する（Batchはジョブキューに応じてVPC内のコンテナ実行環境を自動で起動・停止するサービス）",
        "プライベートサブネットで起動したコンテナがFFmpeg（オープンソースの動画変換ツール）で元動画をHLSへ変換し、配信用S3に保存する",
        "コンテナイメージの取得などの外向き通信はパブリックサブネットのNATゲートウェイを経由する",
        "配信側は推奨構成と同じくCloudFront+S3で行う"
      ],
      services: [
        { icon: "services/batch", name: "AWS Batch", role: "変換ジョブのキュー管理と計算資源（EC2/Fargate）の自動起動・停止を担うバッチ実行基盤" },
        { icon: "services/s3", name: "Amazon S3", role: "元動画と変換後ファイルの保存先" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "変換後のHLSをキャッシュ配信するCDN" }
      ],
      points: [
        "FFmpegのコマンドを自分で書くため、フィルタ・透かし・特殊コーデックなどMediaConvertにない処理も自由にできる",
        "Batchのコンピューティング環境にスポットインスタンス（余剰EC2を最大9割引で使える仕組み）を指定すると、変換コストを大きく下げられる。変換ジョブは中断されても再実行すればよいためスポットと相性が良い",
        "S3との大量データのやり取りはNAT経由にすると転送課金がかさむ。S3用のゲートウェイ型VPCエンドポイントを置いてNATを迂回させるのが定石",
        "変換の並列度・リトライ・失敗監視をすべて自分で設計する必要があり、運用の重さはマネージド案と段違いである点を織り込む"
      ],
      pros: [
        "変換処理の自由度が最大（FFmpegでできることは何でもできる)",
        "スポットインスタンス活用で大量変換の単価をMediaConvertより下げられる余地がある",
        "変換ロジックがコンテナなのでローカル検証がしやすい"
      ],
      cons: [
        "FFmpegのパラメータ設計・ジョブ管理・失敗時のリカバリなど、エンコードの専門知識と運用工数が必要",
        "VPC・NATゲートウェイなどネットワークの管理対象が増える",
        "少量の変換ではマネージドとの価格差がほぼ出ず、手間だけが増える"
      ],
      cost: "<strong>月数千円〜（変換量に比例）</strong>。スポットのc系インスタンスなら1時間数十円でHD数本を変換でき、大量変換時の単価はMediaConvertより下げられる。ただしNATゲートウェイ（月約45USD、約6,800円）や運用工数という見えにくいコストが乗る。",
      references: [
        { title: "AWS Batchとは", url: "https://docs.aws.amazon.com/ja_jp/batch/latest/userguide/what-is-batch.html" },
        { title: "Amazon EC2とは", url: "https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/concepts.html" },
        { title: "S3用ゲートウェイエンドポイント", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/privatelink/vpc-endpoints-s3.html", note: "NAT転送料を避ける定石" },
        { title: "NATゲートウェイ", url: "https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/vpc-nat-gateway.html" }
      ]
    },
    {
      name: "CloudFront署名付きURL + WAFで有料会員限定配信",
      when: "有料会員だけに動画を見せたい・動画URLの共有や直リンクによるタダ見を防ぎたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "会員ユーザー", col: 0, row: 1 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway\n再生API", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n署名URL発行", col: 2, row: 0 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\nCDN", col: 2, row: 1 },
          { id: "waf", icon: "services/waf", label: "AWS WAF\n防御", col: 3, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n配信用HLS", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "再生リクエスト" },
          { from: "apigw", to: "lambda", label: "会員確認" },
          { from: "users", to: "cf", label: "署名付きURLで視聴" },
          { from: "cf", to: "s3", label: "オリジン取得" },
          { from: "waf", to: "cf", noArrow: true, dashed: true }
        ]
      },
      flow: [
        "会員が再生ボタンを押すと、アプリはAPI Gateway経由でLambdaに再生リクエストを送る",
        "Lambdaが会員資格を確認し、有効期限つきの署名付きURL（またはCookie）を発行して返す。署名は秘密鍵で作られるため第三者には偽造できない",
        "プレイヤーは署名付きURLでCloudFrontにアクセスして視聴する。署名がない・期限切れのリクエストはCloudFrontが拒否する",
        "WAFをCloudFrontに紐づけ、大量リクエストや不審なアクセスパターンをエッジでブロックする"
      ],
      services: [
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "署名の検証と配信を担うCDN。正しい署名がないリクエストには403を返す" },
        { icon: "services/waf", name: "AWS WAF", role: "レート制限や不審なリクエストのブロック。スクレイピング的な大量取得への防御" },
        { icon: "services/lambda", name: "AWS Lambda", role: "会員資格を確認して署名付きURLを発行するAPI処理" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "再生APIの入口。認証との連携やレート制限を担う" },
        { icon: "services/s3", name: "Amazon S3", role: "配信用HLSの保存先。OACでCloudFront以外からは読めなくする" }
      ],
      points: [
        "アクセス制御は「S3を直接守る」のではなく「CloudFrontの入口で署名を検証する」のがポイント。S3側はOACでCloudFront経由以外を全拒否する",
        "HLSは細切れファイルを大量に取得するため、1本ずつURL署名するより署名付きCookieを使うとプレイヤー側の実装が単純になる",
        "署名の有効期限は視聴時間より少し長い程度（数時間）に絞る。URLが流出しても期限切れで再生できなくなる",
        "「共有されても完全に防ぎたい」レベルの要件（有料映画など）ではDRMが必要で、その場合はSPEKE対応のパッケージングを追加検討する"
      ],
      pros: [
        "会員限定配信を、配信インフラ（CloudFront+S3）を変えずに後付けできる",
        "URLの使い回し・直リンクを有効期限と署名で防げる",
        "WAF併用で大量ダウンロードや荒らし的アクセスも抑止できる"
      ],
      cons: [
        "署名発行APIと会員管理の実装が必要になる",
        "署名はあくまで「アクセス制御」であり、再生中の画面録画や完全なコピー防止はできない（それはDRMの領域）",
        "署名付きCookie/URLの期限設計を誤ると「再生が途中で止まる」問い合わせにつながる"
      ],
      cost: "<strong>推奨構成に月数百円〜数千円の追加</strong>（Lambda・API Gatewayのリクエスト課金と、WAFの基本料金月10ドル前後＋ルール数・リクエスト数の従量）。配信量そのもののコストは推奨構成と同じ。",
      references: [
        { title: "CloudFrontのプライベートコンテンツ配信", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/PrivateContent.html", note: "署名付きURL/Cookieの全体像" },
        { title: "署名付きURLと署名付きCookieの使い分け", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/private-content-choosing-signed-urls-cookies.html", note: "HLSではCookieが有力という判断材料" },
        { title: "署名付きURLの使用", url: "https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html" },
        { title: "AWS WAFとは", url: "https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/what-is-aws-waf.html" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月数千円〜10万円超</strong>で、視聴量（CloudFront転送量）にほぼ比例する。自前エンコード案は変換単価を下げられる可能性があるが、NATゲートウェイ等の固定費と運用工数が乗るため、<strong>大量変換でなければ差額は出にくい</strong>。会員限定配信は推奨構成への<strong>月数百円〜数千円の追加</strong>で実現できる。VODのコストは「変換費は入稿量に比例、配信費は視聴量に比例」と分けて見積もるのがコツ。</p>",
  summary: "<p>VODは「変換（S3+MediaConvert）」と「配信（CloudFront+S3）」の2つのパイプラインに分けて考えると整理できます。どちらもサーバーレスに組めるため、<strong>エンコードの専門家がいなくても運用できる</strong>のがマネージド構成の最大の価値です。FFmpeg自前案が浮上するのは特殊要件か大量変換のときだけで、まずはMediaConvertから始めるのが定石です。また有料配信の要件が出たら、配信基盤はそのままに署名付きURL/Cookieを重ねる、という拡張の道筋も覚えておきましょう。ライブ配信は次のケースで扱います。</p>"
});
