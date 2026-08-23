// ケース27：画像認識・コンテンツモデレーション
registerCase({
  id: 27,
  category: "AI・機械学習",
  title: "画像認識・コンテンツモデレーション",
  scenario: "<p>フリマアプリを運営しており、ユーザーが商品画像を1日数千枚投稿する。まれにアダルト・暴力表現・規約違反の画像が混ざるため、これまで運営チームが目視で全件チェックしていたが、投稿数の増加で追いつかなくなった。投稿された画像を自動で判定し、違反の疑いがあるものだけを運営チームに通知して確認・非公開の対応をしたい。機械学習の専任エンジニアはいない。</p>",
  requirements: [
    "投稿画像を自動でモデレーション（不適切判定）したい",
    "違反の疑いがある画像だけを運営チームに通知したい",
    "機械学習モデルの構築・学習はやりたくない（専任者がいない）",
    "投稿数の増減に自動で追従してほしい",
    "判定の基準（どこまで自動化するか）は後から調整できるようにしたい"
  ],
  main: {
    name: "Rekognition + Lambda + S3 + SNS（マネージドAIで全自動判定）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "ユーザー\n画像投稿", col: 0, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n投稿画像", col: 1, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\n判定処理", col: 2, row: 0 },
        { id: "rek", icon: "services/rekognition", label: "Rekognition\nモデレーション", col: 3, row: 0 },
        { id: "sns", icon: "services/sns", label: "SNS\n違反通知", col: 3, row: 1 },
        { id: "mod", icon: "resources/user", label: "運営チーム\n確認・対応", col: 4, row: 1 }
      ],
      edges: [
        { from: "users", to: "s3", label: "画像アップ" },
        { from: "s3", to: "lambda", label: "イベント通知" },
        { from: "lambda", to: "rek", label: "判定リクエスト" },
        { from: "lambda", to: "sns", label: "違反時のみ発行" },
        { from: "sns", to: "mod", label: "メール通知" }
      ]
    },
    flow: [
      "ユーザーが投稿した画像はS3バケットに保存される",
      "S3のイベント通知（ファイルが置かれたら自動で知らせる仕組み）がLambdaを起動する",
      "LambdaがRekognitionのDetectModerationLabels APIを呼び、アダルト・暴力などのカテゴリと信頼度スコア（判定の自信度、0〜100）を受け取る",
      "スコアがしきい値を超えた画像だけ、LambdaがSNSトピックにメッセージを発行する",
      "SNSを購読している運営チームにメールが届き、人が最終確認して非公開などの対応をする"
    ],
    services: [
      { icon: "services/rekognition", name: "Amazon Rekognition", role: "学習済みの画像認識AI。モデルの構築・学習なしで、APIを1回呼ぶだけで不適切コンテンツを検出できる" },
      { icon: "services/lambda", name: "AWS Lambda", role: "画像が置かれたときだけ動く判定処理。サーバー不要で、投稿数に応じて自動で並列実行される" },
      { icon: "services/s3", name: "Amazon S3", role: "投稿画像の保存先。イベント通知でLambdaを起動する起点にもなる" },
      { icon: "services/sns", name: "Amazon SNS", role: "違反疑いの通知配信。メールのほかチャットツール連携（Lambda経由）にも広げられる" }
    ],
    points: [
      "信頼度スコアで対応を2段階に分けるのが実務の定石。例えば「スコア90以上は即自動非公開、60〜90は通知して人が確認」とすれば、誤判定で正常な商品を消してしまう事故と、見逃しの両方を減らせる",
      "Rekognitionはリクエスト課金の完全マネージドサービスなので、投稿が増えてもスケーリングの設計が不要。夜間に投稿がゼロでも固定費がかからない",
      "S3イベント駆動にすることで「定期的に新着画像を探しに行く」ポーリング処理が不要になり、投稿から数秒で判定が終わる",
      "この図にVPCやゲートウェイ類がないのは省略ではない。S3・Lambda・Rekognition・SNSはすべてVPC外のマネージドサービスで、自前のネットワークを作る必要がそもそもない"
    ],
    pros: [
      "機械学習の知識ゼロでも当日から動かせる（モデル構築・学習が不要）",
      "完全従量課金で、投稿ゼロの時間帯のコストがほぼゼロ",
      "投稿数の急増にも自動で追従する（Lambdaが並列実行される）",
      "運営チームの確認対象が「違反疑いのみ」に絞られ、目視工数が大幅に減る"
    ],
    cons: [
      "判定カテゴリはAWSが用意した汎用のもの（アダルト・暴力・薬物など）に限られ、「自社規約独自のNG商品」は判定できない",
      "信頼度のしきい値設計はデータを見ながらの試行錯誤が必要",
      "誤判定（正常画像の違反扱い・違反画像の見逃し）はゼロにならないため、人の確認フローは残す必要がある"
    ],
    cost: "<strong>月1,500円〜1万5,000円程度</strong>（画像1万〜10万枚/月の想定。Rekognitionのモデレーション判定は1枚あたり約0.15円＝0.001USD、1USD150円換算。Lambda・S3・SNSは合計でも月数百円規模）。判定枚数に完全比例するため、小規模なら月数百円で始められる。",
    references: [
      { title: "不適切なコンテンツのモデレーション（Rekognition）", url: "https://docs.aws.amazon.com/ja_jp/rekognition/latest/dg/moderation.html", note: "この構成の中核となる機能の公式ガイド" },
      { title: "Amazon Rekognitionとは", url: "https://docs.aws.amazon.com/ja_jp/rekognition/latest/dg/what-is.html" },
      { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html", note: "S3→Lambda起動の仕組み" },
      { title: "Amazon S3でAWS Lambdaを使用する", url: "https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/with-s3.html" },
      { title: "Amazon Rekognitionの料金", url: "https://aws.amazon.com/jp/rekognition/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "SageMakerカスタムモデル（独自基準の画像判定）",
      when: "「自社規約で禁止している商品カテゴリ」など、汎用AIにない独自ドメインの判定が必要で、学習用の画像データを自社で持っている場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー\n画像投稿", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n投稿画像", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n判定処理", col: 2, row: 0 },
          { id: "smep", icon: "services/sagemaker", label: "SageMaker\n推論エンドポイント", col: 3, row: 0 },
          { id: "smtr", icon: "services/sagemaker", label: "SageMaker\n学習ジョブ", col: 4, row: 0 },
          { id: "sns", icon: "services/sns", label: "SNS\n違反通知", col: 3, row: 1 },
          { id: "mod", icon: "resources/user", label: "運営チーム\n確認・対応", col: 0, row: 1 }
        ],
        edges: [
          { from: "users", to: "s3", label: "画像アップ" },
          { from: "s3", to: "lambda", label: "イベント通知" },
          { from: "lambda", to: "smep", label: "推論リクエスト" },
          { from: "smtr", to: "smep", label: "モデル更新", dashed: true },
          { from: "lambda", to: "sns", label: "違反時のみ発行" },
          { from: "sns", to: "mod", label: "メール通知" }
        ]
      },
      flow: [
        "自社で集めた違反画像・正常画像を教師データとして、SageMakerの学習ジョブで独自の分類モデルを作る",
        "学習済みモデルをSageMakerの推論エンドポイント（モデルをAPIとして常時公開する仕組み）にデプロイする",
        "投稿画像がS3に置かれるとLambdaが起動し、エンドポイントに推論リクエストを送って自社基準の判定結果を得る",
        "違反疑いはSNS経由で運営チームに通知する。モデルは新しいデータで定期的に再学習して更新する"
      ],
      services: [
        { icon: "services/sagemaker", name: "Amazon SageMaker", role: "機械学習の学習・デプロイ基盤。独自データで学習したモデルをAPIとして公開できる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "S3イベントを受けてエンドポイントを呼び、結果に応じて通知する接着剤役" },
        { icon: "services/s3", name: "Amazon S3", role: "投稿画像と学習用データセットの保存先" },
        { icon: "services/sns", name: "Amazon SNS", role: "違反疑いの通知配信" }
      ],
      points: [
        "SageMakerエンドポイントはVPCの外にAWSが管理する形で立つため、この構成でも自前のVPC設計は不要（VPC内に閉じる構成も選べるが、要件が出てからでよい）",
        "推論エンドポイントは常時起動の課金になる。リクエストが少ないうちはサーバーレス推論（リクエスト時だけ起動）を選ぶとコストを抑えられる",
        "まずRekognitionで汎用カテゴリを判定し、そこで拾えない独自基準だけカスタムモデルに回す2段構えにすると、学習データが少なくても精度を確保しやすい",
        "モデルの精度は学習データの質で決まる。誤判定した画像を教師データに追加して再学習する運用ループを最初から設計しておく"
      ],
      pros: [
        "自社規約に完全に合わせた判定基準を作れる",
        "学習データを増やすほど自社ドメインでの精度を上げていける",
        "モデル・推論環境を自社管理できるため、判定ロジックの説明責任を果たしやすい"
      ],
      cons: [
        "教師データの収集・ラベル付け・再学習という機械学習特有の運用が発生する",
        "推論エンドポイントを常時起動にすると、リクエストがなくても固定費がかかる",
        "精度が出るまでの試行錯誤に時間がかかり、専任に近い担当者が必要になる"
      ],
      cost: "<strong>月1万2,000円〜8万円程度</strong>（推論エンドポイント常時起動の場合。CPUのml.m5.largeで月約1万2,500円、GPUのml.g4dn.xlargeで月約8万円、1USD150円換算）。これに学習ジョブの実行時間課金が加わる。常時起動コストが重い場合はサーバーレス推論で従量課金化できる。",
      references: [
        { title: "Amazon SageMaker AIとは", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/whatis.html" },
        { title: "リアルタイム推論エンドポイント", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/realtime-endpoints.html", note: "常時起動型の推論の公式ガイド" },
        { title: "Amazon SageMakerの料金", url: "https://aws.amazon.com/jp/sagemaker/pricing/", note: "エンドポイントのインスタンス単価はここで確認" }
      ]
    },
    {
      name: "Bedrockマルチモーダルモデル（自然言語で判定基準を書く）",
      when: "「生き物の画像は禁止」「医薬品らしき商品はNG」など、判定基準が複雑・頻繁に変わる場合や、違反理由の説明文もあわせて生成したい場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "ユーザー\n画像投稿", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n投稿画像", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n判定処理", col: 2, row: 0 },
          { id: "br", icon: "services/bedrock", label: "Bedrock\nLLM画像判定", col: 3, row: 0 },
          { id: "sns", icon: "services/sns", label: "SNS\n違反通知", col: 3, row: 1 },
          { id: "mod", icon: "resources/user", label: "運営チーム\n確認・対応", col: 4, row: 1 }
        ],
        edges: [
          { from: "users", to: "s3", label: "画像アップ" },
          { from: "s3", to: "lambda", label: "イベント通知" },
          { from: "lambda", to: "br", label: "画像+判定指示" },
          { from: "lambda", to: "sns", label: "違反時のみ発行" },
          { from: "sns", to: "mod", label: "メール通知" }
        ]
      },
      flow: [
        "投稿画像がS3に置かれるとLambdaが起動する",
        "LambdaがBedrock経由でマルチモーダルモデル（画像とテキストを同時に扱えるLLM）を呼び、画像と一緒に「この規約に違反するか、理由付きでJSONで答えて」というプロンプトを送る",
        "モデルが違反有無・該当規約・理由の説明をJSONで返す",
        "違反疑いはSNSで運営チームに通知する。通知には理由の説明文も含められるので、人の確認が速くなる"
      ],
      services: [
        { icon: "services/bedrock", name: "Amazon Bedrock", role: "ClaudeなどのLLMをAPIで呼べるマネージドサービス。画像入力に対応したモデルでモデレーション判定に使える" },
        { icon: "services/lambda", name: "AWS Lambda", role: "プロンプトの組み立てとモデル呼び出し、結果のパースを担当" },
        { icon: "services/s3", name: "Amazon S3", role: "投稿画像の保存先兼イベント起点" },
        { icon: "services/sns", name: "Amazon SNS", role: "違反疑いの通知配信" }
      ],
      points: [
        "判定基準をプロンプト（自然言語の指示文）で書けるのが最大の特徴。規約が変わってもモデルの再学習ではなくプロンプトの書き換えだけで即日反映できる",
        "「違反理由の説明」を同時に生成できるため、運営チームの確認やユーザーへの通知文作成が楽になる",
        "LLMの出力は毎回同じとは限らない。出力形式をJSONに固定する指示と、パース失敗時のリトライ処理をLambda側に必ず入れる",
        "料金はトークン量に比例するため、Rekognitionより1枚あたりの単価が読みにくい。まず安価な軽量モデルで試し、精度が足りない画像だけ上位モデルに回す設計が有効"
      ],
      pros: [
        "判定基準の変更がプロンプト修正だけで済み、変化に最も強い",
        "汎用カテゴリにない独自基準も、学習データなしで判定できる",
        "違反理由の説明文まで自動生成できる"
      ],
      cons: [
        "判定のたびにLLMを呼ぶため、Rekognitionより応答が遅くコストも変動しやすい",
        "出力が確率的で、同じ画像でも判定が揺れることがある（しきい値運用の代わりにプロンプトと再試行の設計が必要）",
        "プロンプトの品質管理という新しい運用テーマが増える"
      ],
      cost: "<strong>月1,000円〜1万円程度</strong>（画像1万枚/月、軽量モデル利用の想定。画像1枚あたり0.1〜1円程度で、使うモデルと画像サイズ・出力の長さで変動する）。高精度モデルを全件に使うと1桁上がることもあるため、モデルの使い分けが重要。",
      references: [
        { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" },
        { title: "Amazon Bedrockの料金", url: "https://aws.amazon.com/jp/bedrock/pricing/", note: "モデル別のトークン単価" },
        { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Rekognition）は<strong>月1,500円〜1万5,000円程度</strong>（1万〜10万枚/月）で完全従量課金。Bedrock案は軽量モデルなら<strong>月1,000円〜1万円程度</strong>と同水準だが、モデル選定次第で変動幅が大きい。SageMaker案はエンドポイント常時起動なら<strong>月1万2,000円〜8万円程度</strong>の固定費が乗る点が最大の違いで、判定枚数が少ないほど割高になる。</p>",
  summary: "<p>画像モデレーションの第一選択は<strong>「まず学習済みAI（Rekognition）で始める」</strong>です。機械学習の実務では、モデルを作ること自体より教師データの収集と再学習の運用が重いため、汎用カテゴリで足りるならマネージドAIが圧倒的に低コストです。判断の分かれ目は判定基準の性質で、<strong>基準が独自だが安定しているならSageMaker、基準が複雑で頻繁に変わるならBedrock</strong>という選び方を覚えておきましょう。どの案でも「AIが疑いを絞り、最終判断は人がする」二段構えは共通です。</p>"
});
