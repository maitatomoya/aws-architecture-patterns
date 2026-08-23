// ケース31：多言語翻訳・音声案内パイプライン
registerCase({
  id: 31,
  category: "AI・機械学習",
  title: "多言語翻訳・音声案内パイプライン",
  scenario: "<p>訪日観光客が多い観光施設の運営会社で、館内案内・イベント告知・注意事項などの案内文を英語・中国語・韓国語など6言語で提供したい。現在は翻訳会社に依頼しており、1回の更新に数日と数万円かかるため、急な運休情報などをタイムリーに多言語化できていない。担当者が日本語の原文を登録したら、自動で多言語化されてWebサイトやデジタルサイネージに反映される仕組みを作りたい。</p>",
  requirements: [
    "日本語の案内文を登録したら自動で6言語に翻訳したい",
    "急な更新（運休・イベント変更）を数分で多言語反映したい",
    "施設名・地名などの固有名詞は決まった訳語に統一したい",
    "翻訳結果は言語別に保存し、Webサイトやサイネージから参照できるようにしたい",
    "翻訳会社への都度依頼（数日・数万円）から脱却し、従量の低コストにしたい"
  ],
  main: {
    name: "Translate + Lambda + S3 + DynamoDB（自動翻訳パイプライン）",
    diagram: {
      cols: 4, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
      ],
      nodes: [
        { id: "staff", icon: "resources/user", label: "担当者\n原文を登録", col: 0, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n原文テキスト", col: 1, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\n翻訳制御", col: 2, row: 0 },
        { id: "tr", icon: "services/translate", label: "Translate\n機械翻訳", col: 3, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n言語別翻訳文", col: 2, row: 1 }
      ],
      edges: [
        { from: "staff", to: "s3", label: "原文アップ" },
        { from: "s3", to: "lambda", label: "イベント通知" },
        { from: "lambda", to: "tr", label: "翻訳リクエスト" },
        { from: "lambda", to: "ddb", label: "言語別に保存" }
      ]
    },
    flow: [
      "担当者が日本語の案内文をS3にアップロードする（管理画面やCMS経由でもよい）",
      "S3のイベント通知でLambdaが起動する",
      "Lambdaが対象6言語ぶんTranslateのAPIを呼ぶ。固有名詞はカスタム用語集（対訳表）で訳語を固定する",
      "翻訳結果を「案内ID×言語」をキーにDynamoDBへ保存する",
      "Webサイトやサイネージは表示言語に応じてDynamoDBの翻訳文を参照する。原文を更新すれば数分で全言語が差し替わる"
    ],
    services: [
      { icon: "services/translate", name: "Amazon Translate", role: "ニューラル機械翻訳サービス。75以上の言語に対応し、API1回で1言語ペアを翻訳する" },
      { icon: "services/lambda", name: "AWS Lambda", role: "6言語ぶんの翻訳呼び出しと保存を行う制御役。原文が来たときだけ動く" },
      { icon: "services/s3", name: "Amazon S3", role: "原文の保存先兼処理の起点。原文の履歴が残るので訳し直しも容易" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "翻訳結果の保存先。「案内ID×言語」のキー設計で参照が1回の読み取りで済む" }
    ],
    points: [
      "固有名詞対策がこの構成の実務上の要。「雷門」を意訳されては困るので、カスタム用語集（CSVの対訳表）をTranslateに登録して訳語を固定する。用語集の育成が翻訳品質の運用そのもの",
      "翻訳会社依頼の「数日・数万円」が「数分・数円」になるのが導入効果。人による翻訳を全廃するのではなく、常設の重要案内は人がレビューし、緊急・短命な案内は機械翻訳のみ、と使い分けるのが現実的",
      "キーを「案内ID×言語」にしておくと、表示側は言語を切り替えてもクエリが変わらず、対応言語の追加もLambdaの言語リストに1行足すだけで済む",
      "全サービスがVPC外のマネージドサービスで、サーバーもネットワーク設計も不要。案内文の更新頻度程度なら性能面の考慮もいらない"
    ],
    pros: [
      "更新から反映まで数分になり、急な運休情報も全言語で即時発信できる",
      "従量課金で、翻訳会社への都度依頼と比べて桁違いに安い",
      "対応言語の追加が設定変更レベルでできる",
      "原文・訳文がデータとして蓄積され、サイネージ・アプリなど配信先を増やしやすい"
    ],
    cons: [
      "機械翻訳の品質は言語ペアや文体によりばらつきがあり、重要文面は人のレビューが必要",
      "用語集の整備・更新という新しい運用タスクが発生する",
      "文化的な言い回しの調整（丁寧さのトーン等）は苦手で、定型的な案内文に向く"
    ],
    cost: "<strong>月数百円〜3,000円程度</strong>（Translateは100万文字あたり約2,250円＝15USD、1USD150円換算。案内文の更新が月10万文字×6言語=60万文字なら約1,350円。Lambda・S3・DynamoDBは合計でも月数十円規模）。翻訳会社への都度依頼と比べると2〜3桁安い。",
    references: [
      { title: "Amazon Translateとは", url: "https://docs.aws.amazon.com/ja_jp/translate/latest/dg/what-is.html" },
      { title: "カスタム用語集", url: "https://docs.aws.amazon.com/ja_jp/translate/latest/dg/how-custom-terminology.html", note: "固有名詞の訳語固定に必須" },
      { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html" },
      { title: "Amazon Translateの料金", url: "https://aws.amazon.com/jp/translate/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "Bedrock（文脈・トーン重視のLLM翻訳）",
      when: "観光ガイド文のような読み物で、直訳ではなく文化的な補足やトーンの統一まで求める場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "staff", icon: "resources/user", label: "担当者\n原文を登録", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n原文テキスト", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n翻訳制御", col: 2, row: 0 },
          { id: "br", icon: "services/bedrock", label: "Bedrock\nLLM翻訳", col: 3, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n言語別翻訳文", col: 2, row: 1 }
        ],
        edges: [
          { from: "staff", to: "s3", label: "原文アップ" },
          { from: "s3", to: "lambda", label: "イベント通知" },
          { from: "lambda", to: "br", label: "翻訳指示+原文" },
          { from: "lambda", to: "ddb", label: "言語別に保存" }
        ]
      },
      flow: [
        "担当者が原文をS3に登録するとLambdaが起動する（構成の骨格は推奨構成と同じ）",
        "LambdaがBedrockのLLMに「観光客向けに丁寧なトーンで翻訳。施設名はこの対訳表に従う。文化的に伝わりにくい語には短い補足を付ける」といった指示文と原文を送る",
        "モデルが翻訳文（必要に応じて補足付き）を返す",
        "結果を検証してDynamoDBへ言語別に保存する"
      ],
      services: [
        { icon: "services/bedrock", name: "Amazon Bedrock", role: "LLMによる翻訳。指示文でトーン・用語・補足の方針まで指定できる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "プロンプト組み立てと結果検証・保存" },
        { icon: "services/s3", name: "Amazon S3", role: "原文の保存先兼イベント起点" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "翻訳結果の保存先" }
      ],
      points: [
        "LLM翻訳の強みは「翻訳＋α」ができること。「お盆期間」を単に音訳せず短い説明を添える、全言語で敬体のトーンを揃える、といった指示が1つのプロンプトで済む",
        "Translateとの使い分けが本題。定型の運行案内は速くて安いTranslate、読み物のガイド文は品質重視でBedrock、と文書種別でパイプラインを分けるのが実務解",
        "出力の検証を必ず入れる。訳抜けや指示外の創作が起きうるため、文字数比のチェックや原文との突き合わせ、重要文面の人のレビューを組み込む",
        "トークン課金のため長文ほど高くなる。Translateの文字単価と比べ、対象文書の量で事前に試算しておく"
      ],
      pros: [
        "トーン・文脈・文化的補足まで含めた自然な翻訳ができる",
        "翻訳方針の変更（もっとカジュアルに等）がプロンプト修正だけで済む",
        "要約・言い換え・多言語FAQ生成など、翻訳以外のテキスト処理にも同じ構成が使える"
      ],
      cons: [
        "Translateより処理が遅く、コストも文書量によっては高くなる",
        "出力が確率的で品質が揺れるため、検証・レビューの仕組みが必須",
        "モデルの選定・プロンプトの品質管理という運用テーマが増える"
      ],
      cost: "<strong>月1,000円〜1万円程度</strong>（月60万文字を中位モデルで翻訳する想定。トークン単価はモデルで大きく異なり、Translateの数倍になることが多い）。全文書をLLMにせず、品質が必要な文書に絞るのがコスト管理の鍵。",
      references: [
        { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" },
        { title: "Amazon Bedrockの料金", url: "https://aws.amazon.com/jp/bedrock/pricing/" },
        { title: "Amazon Translateとは", url: "https://docs.aws.amazon.com/ja_jp/translate/latest/dg/what-is.html", note: "使い分け先の比較用" }
      ]
    },
    {
      name: "Polly追加で多言語音声案内まで生成",
      when: "テキスト表示だけでなく、館内放送や音声ガイドとして多言語の音声案内も流したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "staff", icon: "resources/user", label: "担当者\n原文を登録", col: 0, row: 0 },
          { id: "s3t", icon: "services/s3", label: "S3\n原文テキスト", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n変換制御", col: 2, row: 0 },
          { id: "tr", icon: "services/translate", label: "Translate\n多言語翻訳", col: 3, row: 0 },
          { id: "users", icon: "resources/users", label: "利用者\n音声再生", col: 0, row: 1 },
          { id: "cf", icon: "services/cloudfront", label: "CloudFront\n配信", col: 1, row: 1 },
          { id: "s3a", icon: "services/s3", label: "S3\n音声ファイル", col: 2, row: 1 },
          { id: "polly", icon: "services/polly", label: "Polly\n音声合成", col: 3, row: 1 }
        ],
        edges: [
          { from: "staff", to: "s3t", label: "原文アップ" },
          { from: "s3t", to: "lambda", label: "イベント通知" },
          { from: "lambda", to: "tr", label: "多言語翻訳" },
          { from: "lambda", to: "polly", label: "音声合成依頼" },
          { from: "polly", to: "s3a", label: "MP3保存" },
          { from: "users", to: "cf", label: "再生リクエスト" },
          { from: "cf", to: "s3a", label: "オリジン取得" }
        ]
      },
      flow: [
        "原文の登録から多言語翻訳までは推奨構成と同じ流れで動く",
        "Lambdaが翻訳済みテキストを言語ごとにPolly（テキスト読み上げサービス）へ渡し、音声を合成する",
        "生成されたMP3ファイルを言語別にS3へ保存する",
        "サイネージ・音声ガイドアプリ・館内放送設備はCloudFront経由で音声ファイルを取得して再生する"
      ],
      services: [
        { icon: "services/polly", name: "Amazon Polly", role: "テキスト読み上げ（TTS）サービス。言語ごとのネイティブ話者風の音声を合成できる" },
        { icon: "services/translate", name: "Amazon Translate", role: "音声化の前段となる多言語翻訳" },
        { icon: "services/lambda", name: "AWS Lambda", role: "翻訳→音声合成→保存の一連の制御" },
        { icon: "services/s3", name: "Amazon S3", role: "原文と生成音声（MP3）の保存先" },
        { icon: "services/cloudfront", name: "Amazon CloudFront", role: "音声ファイルのキャッシュ配信。多拠点のサイネージからのアクセスを高速化しS3の負荷を下げる" }
      ],
      points: [
        "音声は一度生成してS3に置けば何度でも再生できるため、合成は更新時の1回だけ。リクエストのたびに合成するより桁違いに安く、再生側の遅延もない",
        "言語ごとに適した音声（英語はネイティブ話者風の声、中国語は中国語の声）を選ぶ。Pollyは言語×話者のバリエーションが豊富で、案内の聞き取りやすさに直結する",
        "読み上げの間・発音・数字の読み方はSSML（読み上げ方を指定するマークアップ）で調整できる。駅名の読みなど固有名詞の発音調整に使う",
        "配信をCloudFront経由にすることで、サイネージ端末が多拠点にあってもS3への直接アクセスを避けられ、キャッシュで転送コストも抑えられる"
      ],
      pros: [
        "テキストと音声の多言語案内が1つのパイプラインで揃う",
        "ナレーター収録が不要になり、急な案内変更でも音声まで数分で更新できる",
        "生成済みファイルの配信なので再生時の可用性・速度が安定している"
      ],
      cons: [
        "合成音声の品質は自然になったとはいえ、緊急放送など聞き逃せない用途では聞き取りやすさの検証が必要",
        "読みの誤り（固有名詞・数字）はSSMLでの個別調整が必要で、言語数ぶん手間が増える",
        "構成要素が増えるぶん、障害時の切り分けポイントが多くなる"
      ],
      cost: "<strong>月1,000円〜4,000円程度</strong>（翻訳費用は推奨構成と同じ数百円〜。Pollyは標準音声が100万文字約600円、高品質なニューラル音声が100万文字約2,400円。月60万文字を音声化しても数千円。CloudFrontは無料枠内に収まる規模が多い。1USD150円換算）。",
      references: [
        { title: "Amazon Pollyとは", url: "https://docs.aws.amazon.com/ja_jp/polly/latest/dg/what-is.html" },
        { title: "Pollyで利用できる音声一覧", url: "https://docs.aws.amazon.com/ja_jp/polly/latest/dg/voicelist.html", note: "言語ごとの話者選び" },
        { title: "Amazon Pollyの料金", url: "https://aws.amazon.com/jp/polly/pricing/" },
        { title: "Amazon Translateとは", url: "https://docs.aws.amazon.com/ja_jp/translate/latest/dg/what-is.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Translate）は<strong>月数百円〜3,000円程度</strong>で、翻訳会社への都度依頼（1回数万円・数日）と比べて2〜3桁のコスト削減になる。Bedrock案は<strong>月1,000円〜1万円程度</strong>で品質重視の文書に絞って併用するのが得策。Polly追加案は<strong>プラス月1,000円〜4,000円程度</strong>で音声まで自動化できる。いずれも従量課金で、更新量が少ない月はさらに安くなる。</p>",
  summary: "<p>翻訳パイプラインの設計は<strong>「文書の性質でエンジンを使い分ける」</strong>のが結論です。定型の案内はTranslate＋カスタム用語集で速く安く、読み物のガイド文はBedrockで品質を取り、音声が必要ならPollyを後段に足す。共通の骨格は「S3イベント→Lambda→AIサービス→保存」というサーバーレスパイプラインで、このケースの構成はOCR（ケース28）や文字起こし（ケース29）とまったく同じ型です。<strong>AIサービスを差し替えれば別の業務が自動化できる</strong>という型の再利用性こそ、サーバーレス×AI構成の本質的な強みです。</p>"
});
