// ケース29：音声文字起こし・議事録作成
registerCase({
  id: 29,
  category: "AI・機械学習",
  title: "音声文字起こし・議事録作成",
  scenario: "<p>社内の定例会議や商談の録音（1回30分〜1時間、月40件程度）から、議事録の作成を自動化したい。現在は若手社員が録音を聞き直しながら書き起こしており、1時間の会議に2〜3時間かかっている。録音ファイルをアップロードしたら、文字起こしと要点・決定事項・宿題の整理まで自動で終わり、後から検索できる形で残したい。専門用語（自社製品名など）も正しく変換したい。</p>",
  requirements: [
    "録音ファイルから自動で文字起こしをしたい",
    "文字起こし全文から要点・決定事項・宿題を自動で整理したい",
    "議事録は後から検索・参照できる形で保存したい",
    "自社製品名などの専門用語を正しく変換したい",
    "会議数の増減に応じた従量コストにしたい（サーバーの常時稼働はしない）"
  ],
  main: {
    name: "Transcribe + S3 + Bedrock + DynamoDB（録音から議事録まで全自動）",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] }
      ],
      nodes: [
        { id: "usr", icon: "resources/user", label: "担当者\n録音アップ", col: 0, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n録音ファイル", col: 1, row: 0 },
        { id: "l1", icon: "services/lambda", label: "Lambda\nジョブ起動", col: 2, row: 0 },
        { id: "ts", icon: "services/transcribe", label: "Transcribe\n文字起こし", col: 3, row: 0 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n議事録保存", col: 3, row: 1 },
        { id: "l2", icon: "services/lambda", label: "Lambda\n要約処理", col: 4, row: 1 },
        { id: "br", icon: "services/bedrock", label: "Bedrock\n要約生成", col: 5, row: 1 }
      ],
      edges: [
        { from: "usr", to: "s3", label: "録音保存" },
        { from: "s3", to: "l1", label: "イベント通知" },
        { from: "l1", to: "ts", label: "ジョブ開始" },
        { from: "ts", to: "l2", label: "完了後に結果取得" },
        { from: "l2", to: "br", label: "要約リクエスト" },
        { from: "l2", to: "ddb", label: "要約を保存" }
      ]
    },
    flow: [
      "担当者が会議の録音ファイルをS3にアップロードする",
      "S3のイベント通知でLambdaが起動し、Transcribeの文字起こしジョブ（バッチ処理）を開始する",
      "Transcribeが話者分離（誰の発言かの区別）付きで文字起こしし、結果をS3に出力。完了イベントで2つ目のLambdaが起動する",
      "Lambdaが文字起こし全文をBedrockに渡し、「要点・決定事項・宿題を抽出して」というプロンプトで議事録を生成する",
      "全文と議事録をDynamoDBに保存し、社内ツールから会議IDや日付で検索・参照できるようにする"
    ],
    services: [
      { icon: "services/transcribe", name: "Amazon Transcribe", role: "音声認識サービス。日本語対応で、話者分離やカスタム語彙（専門用語の登録）が使える" },
      { icon: "services/bedrock", name: "Amazon Bedrock", role: "LLMによる要約担当。文字起こし全文から決定事項・宿題を構造化して抽出する" },
      { icon: "services/s3", name: "Amazon S3", role: "録音ファイルと文字起こし結果の保存先。処理の起点となるイベントもここから出る" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "議事録の保存先。会議IDをキーに全文・要約・参加者を記録する" },
      { icon: "services/lambda", name: "AWS Lambda", role: "ジョブ起動と要約処理の2箇所で使う接着剤役。イベントが来たときだけ動く" }
    ],
    points: [
      "「文字起こし」と「要約」を別サービスに分けるのがポイント。TranscribeはASR（自動音声認識）の専門家、Bedrockは文章理解の専門家で、餅は餅屋に任せると精度もコストも最適化しやすい",
      "自社製品名や社内用語はTranscribeのカスタム語彙に登録すると誤変換が減る。議事録の品質は用語辞書の育成で決まると言ってよい",
      "話者分離を有効にすると「誰が何を約束したか」が残り、宿題の抽出精度が大きく上がる",
      "録音（会話データ）は機微情報になりやすい。S3のバケットは非公開設定を徹底し、保存期間のルール（例：録音原本は90日で削除、議事録のみ長期保存）をライフサイクル設定で自動化する"
    ],
    pros: [
      "1時間の会議の書き起こし作業（2〜3時間）が数分の待ち時間になる",
      "完全従量課金で、会議がない月はコストがほぼゼロ",
      "全文がデータとして残るため、後からの検索・振り返りができる",
      "要約フォーマットはプロンプトの修正だけで会議体ごとに変えられる"
    ],
    cons: [
      "音声品質が悪い（マイクが遠い・同時発話が多い）と精度が大きく落ちる",
      "固有名詞の誤変換はゼロにならず、カスタム語彙の育成という運用が残る",
      "要約はLLM生成のため、重要な会議では人の最終確認を挟む必要がある"
    ],
    cost: "<strong>月1万円程度</strong>（1時間会議×月40件の想定。Transcribeバッチは1分約3.6円＝0.024USDで月40時間なら約8,600円、Bedrockの要約が1件数円〜十数円で月数百円、Lambda・S3・DynamoDBは合計数百円。1USD150円換算）。会議数に完全比例する。",
    references: [
      { title: "Amazon Transcribeとは", url: "https://docs.aws.amazon.com/ja_jp/transcribe/latest/dg/what-is.html" },
      { title: "カスタム語彙", url: "https://docs.aws.amazon.com/ja_jp/transcribe/latest/dg/custom-vocabulary.html", note: "専門用語の誤変換対策" },
      { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" },
      { title: "Amazon Transcribeの料金", url: "https://aws.amazon.com/jp/transcribe/pricing/" },
      { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html" }
    ]
  },
  alternatives: [
    {
      name: "SageMakerでWhisper等を自前運用",
      when: "音声データを自社管理の推論環境から出したくない場合や、大量の音声処理でモデル・コストを自分で最適化したい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "usr", icon: "resources/user", label: "担当者\n録音アップ", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n録音ファイル", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n推論制御", col: 2, row: 0 },
          { id: "sm", icon: "services/sagemaker", label: "SageMaker\nWhisper推論", col: 3, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n文字起こし結果", col: 3, row: 1 }
        ],
        edges: [
          { from: "usr", to: "s3", label: "録音保存" },
          { from: "s3", to: "lambda", label: "イベント通知" },
          { from: "lambda", to: "sm", label: "推論リクエスト" },
          { from: "lambda", to: "ddb", label: "結果保存" }
        ]
      },
      flow: [
        "オープンソースの音声認識モデル（Whisper等）をSageMakerにデプロイする。モデルカタログ（JumpStart）から数クリックで立てられる",
        "録音がS3に置かれるとLambdaが起動し、SageMakerの推論エンドポイントに音声を渡す",
        "モデルが文字起こしを返し、LambdaがDynamoDBへ保存する",
        "長時間音声は非同期推論（結果を後で受け取る方式）を使い、タイムアウトを避ける"
      ],
      services: [
        { icon: "services/sagemaker", name: "Amazon SageMaker", role: "オープンソースモデルのホスティング基盤。モデルの選定・差し替え・チューニングを自社で握れる" },
        { icon: "services/lambda", name: "AWS Lambda", role: "推論リクエストの投げ込みと結果の保存を担当" },
        { icon: "services/s3", name: "Amazon S3", role: "録音ファイルの保存先兼イベント起点" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "文字起こし結果の保存先" }
      ],
      points: [
        "SageMakerエンドポイントはAWS管理の領域に立つためVPC設計なしでも使えるが、要件次第でVPC内からのみアクセス可能にもできる。「音声を自社統制下の推論環境だけで処理した」と説明できるのが採用理由になりやすい",
        "GPUエンドポイントの常時起動は高額なので、会議後にまとめて処理するなら非同期推論やバッチ変換で「使うときだけ起動」に寄せるのが現実解",
        "モデルのバージョン選定・更新・精度評価がすべて自社責任になる。Transcribeとの精度比較を最初に行い、運用コストに見合うか判断する",
        "要約が必要なら推奨構成と同様にBedrockや自前LLMを後段に足す"
      ],
      pros: [
        "モデル・推論環境を自社で完全にコントロールできる",
        "処理量が非常に多い場合、インスタンスの選定次第でAPI課金より安くできる余地がある",
        "ドメイン特化のファインチューニング（追加学習）まで発展させられる"
      ],
      cons: [
        "GPUエンドポイントを常時起動すると月数万円〜の固定費がかかる",
        "モデル更新・依存ライブラリ・性能監視など、MLOpsと呼ばれる運用負担が発生する",
        "話者分離やカスタム語彙に相当する機能は自分で組み合わせる必要がある"
      ],
      cost: "<strong>月8万円程度〜</strong>（GPUのml.g4dn.xlargeを常時起動した場合、1USD150円換算）。非同期推論・バッチ処理で起動時間を月40時間に絞れば<strong>月4,000円台</strong>まで下がる。「常時起動か、使うときだけか」でコストが1桁変わるのがこの案の要注意点。",
      references: [
        { title: "Amazon SageMaker JumpStart", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/studio-jumpstart.html", note: "公開モデルをすばやくデプロイする仕組み" },
        { title: "非同期推論", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/async-inference.html", note: "長時間音声とコスト削減の鍵" },
        { title: "Amazon SageMakerの料金", url: "https://aws.amazon.com/jp/sagemaker/pricing/" }
      ]
    },
    {
      name: "Transcribeストリーミング + API Gateway WebSocket（リアルタイム字幕）",
      when: "会議が終わってからではなく、進行中にリアルタイムで字幕・文字起こしを表示したい場合（聴覚サポートやウェビナー字幕など）",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "spk", icon: "resources/client", label: "発話者\n音声送信", col: 0, row: 0 },
          { id: "ws", icon: "services/api-gateway-websocket", label: "API Gateway\nWebSocket", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n中継処理", col: 2, row: 0 },
          { id: "ts", icon: "services/transcribe", label: "Transcribe\nストリーミング", col: 3, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n接続ID管理", col: 2, row: 1 },
          { id: "aud", icon: "resources/users", label: "参加者\n字幕表示", col: 0, row: 1 }
        ],
        edges: [
          { from: "spk", to: "ws", label: "音声チャンク" },
          { from: "ws", to: "lambda", label: "中継" },
          { from: "lambda", to: "ts", label: "音声ストリーム" },
          { from: "lambda", to: "ddb", label: "接続ID参照" },
          { from: "ws", to: "aud", label: "字幕を配信" }
        ]
      },
      flow: [
        "発話者のブラウザがマイク音声を小さな断片（チャンク）に分け、WebSocket（双方向通信のプロトコル）でAPI Gatewayに送り続ける",
        "Lambdaが音声をTranscribeのストリーミングAPIに流し込み、数百ミリ秒〜数秒遅れで暫定の文字起こしを受け取る",
        "DynamoDBに記録している参加者の接続IDへ、API Gateway経由で字幕テキストを配信する",
        "確定した文字起こしは保存しておき、会議後の議事録生成（推奨構成の後段）にそのまま使える"
      ],
      services: [
        { icon: "services/transcribe", name: "Amazon Transcribe（ストリーミング）", role: "音声を流し込みながら順次結果を返すリアルタイム音声認識" },
        { icon: "services/api-gateway-websocket", name: "API Gateway WebSocket API", role: "ブラウザとの双方向常時接続を管理し、字幕のプッシュ配信を可能にする" },
        { icon: "services/lambda", name: "AWS Lambda", role: "音声の中継とTranscribe結果の配信処理" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "WebSocketの接続ID（誰がつながっているか）の管理台帳" }
      ],
      points: [
        "リアルタイム系はバッチと違い「暫定結果→確定結果」の2段階で字幕が届く。暫定を薄い色で出して確定で置き換えるなど、UI側の工夫が体験を左右する",
        "WebSocketはリクエストのたびに切れるHTTPと違い接続を張りっぱなしにするため、接続IDの管理台帳（DynamoDB）が必須になる。この管理パターンはリアルタイムチャットでも同じ",
        "遅延を最小にしたい場合、ブラウザから直接TranscribeのストリーミングAPIを呼ぶ設計（一時認証情報を払い出す）もある。中継サーバーを挟むかは遅延要件と認証設計の兼ね合いで決める",
        "バッチ版と料金単価は同水準だが、無音時間も接続中は課金対象になり得るため、無音検知で接続を切る制御を入れるとよい"
      ],
      pros: [
        "会議中にその場で字幕が出るため、聴覚サポートや多言語参加者への配慮ができる",
        "文字起こしの完成を待たずに内容を確認でき、会議後の議事録化も速い",
        "サーバーレス構成のため、開催していない時間のコストがほぼゼロ"
      ],
      cons: [
        "バッチ処理に比べて構成要素が多く、実装・デバッグの難易度が上がる",
        "リアルタイムの暫定結果は精度が揺れ、確定までの表示制御が必要",
        "同時接続数が多いウェビナーでは、接続管理と配信のスケール設計が必要になる"
      ],
      cost: "<strong>月1万円前後</strong>（月40時間の会議をリアルタイム処理する想定。Transcribeストリーミングは1分約3.6円で約8,600円、API Gateway WebSocketの接続・メッセージ課金とLambda・DynamoDBが合計数百円〜。1USD150円換算）。",
      references: [
        { title: "ストリーミング文字起こし", url: "https://docs.aws.amazon.com/ja_jp/transcribe/latest/dg/streaming.html" },
        { title: "WebSocketによるストリーミング", url: "https://docs.aws.amazon.com/ja_jp/transcribe/latest/dg/streaming-websocket.html", note: "Transcribeへの直接ストリーミングの詳細" },
        { title: "API Gateway WebSocket API", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-websocket-api.html" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月1万円程度</strong>（1時間会議×月40件）で会議数に比例する従量課金。リアルタイム字幕案も同水準の<strong>月1万円前後</strong>。SageMaker自前運用案はGPU常時起動だと<strong>月8万円程度〜</strong>と跳ね上がるが、使うときだけ起動する設計にすれば<strong>月4,000円台</strong>まで下げられる。人件費換算（月40件×2時間の書き起こし工数）と比べると、どの案も投資回収は速い。</p>",
  summary: "<p>音声系AIの構成は<strong>「文字起こし（Transcribe）と理解・要約（Bedrock）を分業させる」</strong>のが基本形です。まず録音アップロード起点のバッチ構成で価値を出し、必要になったらリアルタイム字幕へ広げる、という段階導入が現実的です。SageMaker自前運用はデータ統制やコスト最適化の明確な理由があるときの選択肢で、<strong>「常時起動か、使うときだけ起動か」でコストが1桁変わる</strong>ことは面接でも実務でも語れる重要ポイントです。</p>",
  quiz: [
    {
      q: "文字起こしをTranscribe、要約をBedrockと別サービスに分けています。1つのサービスにまとめないのはなぜでしょうか。",
      a: "Transcribeは音声認識の専門、Bedrockは文章理解の専門で、それぞれ得意分野に任せたほうが精度もコストも最適化しやすいからです。要約の書式を会議体ごとに変えたいときもプロンプトの修正だけで済み、音声認識側には手を入れずにすみます。分業しておくと、片方だけを別のサービスへ差し替える判断もしやすくなります。"
    },
    {
      q: "議事録の品質が上がらないとき、構成そのものを変えずにできる打ち手は何でしょうか。",
      a: "Transcribeのカスタム語彙に自社製品名や社内用語を登録して誤変換を減らすこと、話者分離を有効にして「誰が何を約束したか」を残すことです。特に話者分離は宿題の抽出精度に直結します。議事録の品質はモデル選定より、この用語辞書の育成と録音環境（マイクの近さや同時発話の少なさ）で決まる部分が大きいのが実情です。"
    },
    {
      q: "「会議中にその場で字幕を出したい」という要望が追加されました。あなたなら構成をどう広げるでしょうか。",
      a: "代替2のTranscribeストリーミングとAPI Gateway WebSocketの構成へ広げます。WebSocketは接続を張りっぱなしにするため、誰がつながっているかの接続IDをDynamoDBで管理する必要があり、この台帳の作り方はリアルタイムチャットでも同じです。ただし暫定結果と確定結果の2段階で届くので表示制御の作り込みが要ります。まずバッチ構成で価値を出してから広げるのが現実的です。"
    }
  ]
});
