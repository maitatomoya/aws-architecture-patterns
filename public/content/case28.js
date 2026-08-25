// ケース28：帳票OCR・文書データ化
registerCase({
  id: 28,
  category: "AI・機械学習",
  title: "帳票OCR・文書データ化",
  scenario: "<p>経理部門では、取引先から届く請求書や領収書（紙・PDF）の内容を会計システムへ手入力で転記しており、月3,000枚を数人がかりで処理している。入力ミスも毎月発生する。スキャンした帳票画像から金額・日付・取引先名などの項目を自動で抽出し、データベースに登録して転記作業をなくしたい。帳票のレイアウトは取引先ごとにバラバラで、複数ページのPDFもある。</p>",
  requirements: [
    "帳票画像・PDFから金額・日付・取引先などの項目を自動抽出したい",
    "取引先ごとにレイアウトが違っても対応したい（テンプレート定義を1枚ずつ作りたくない）",
    "複数ページのPDFも処理したい",
    "抽出結果はデータベースに保存し、会計システム連携の元データにしたい",
    "処理の失敗・再試行を仕組みで管理したい（月3,000枚を人が見張らない）"
  ],
  main: {
    name: "Textract + Step Functions + S3 + DynamoDB（OCRパイプライン）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "doc", icon: "resources/documents", label: "帳票\nスキャン画像", col: 0, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n帳票画像", col: 1, row: 0 },
        { id: "evb", icon: "services/eventbridge", label: "EventBridge\nアップロード検知", col: 2, row: 0 },
        { id: "sfn", icon: "services/step-functions", label: "Step Functions\nワークフロー", col: 3, row: 0 },
        { id: "txt", icon: "services/textract", label: "Textract\nOCR解析", col: 4, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\n結果整形", col: 3, row: 1 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n抽出データ", col: 4, row: 1 }
      ],
      edges: [
        { from: "doc", to: "s3", label: "アップロード" },
        { from: "s3", to: "evb", label: "イベント発行" },
        { from: "evb", to: "sfn", label: "実行開始" },
        { from: "sfn", to: "txt", label: "解析ジョブ" },
        { from: "sfn", to: "lambda", label: "整形を呼ぶ" },
        { from: "lambda", to: "ddb", label: "抽出データ保存" }
      ]
    },
    flow: [
      "スキャンした帳票（画像・PDF）をS3にアップロードする",
      "S3のイベントをEventBridge（イベントの交通整理役）が受け取り、Step Functionsのワークフローを起動する",
      "Step FunctionsがTextractの非同期解析ジョブを開始し、完了を待つ。Textractは文字だけでなく「項目名と値のペア」や表の構造も抽出する",
      "解析結果のJSONをLambdaが受け取り、金額・日付・取引先名など必要な項目に整形する",
      "整形済みデータを信頼度スコアとともにDynamoDBへ保存し、会計システム連携の元データにする"
    ],
    services: [
      { icon: "services/textract", name: "Amazon Textract", role: "帳票特化のOCRサービス。レイアウト定義なしでフォーム（キーと値）や表を構造ごと抽出できる" },
      { icon: "services/step-functions", name: "AWS Step Functions", role: "「解析→完了待ち→整形→保存」の流れを宣言的に定義するワークフロー。失敗時のリトライも設定だけで済む" },
      { icon: "services/s3", name: "Amazon S3", role: "帳票の原本と解析結果JSONの保存先。原本を残すことが監査対応にもなる" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "抽出項目の保存先。帳票IDをキーに項目と信頼度スコアを記録する" },
      { icon: "services/eventbridge", name: "Amazon EventBridge", role: "S3のアップロードイベントを受けてワークフローを起動する仲介役" },
      { icon: "services/lambda", name: "AWS Lambda", role: "Textractの生JSONを業務で使える形に整形する変換処理" }
    ],
    points: [
      "Textractは座標ベースの伝統的OCRと違い、機械学習で「請求金額: 10,000円」のようなキーと値の関係を理解するため、取引先ごとのテンプレート作成が不要になる",
      "複数ページPDFは非同期API（StartDocumentAnalysis）でしか処理できない。ジョブ開始と完了待ちが分かれるため、その状態管理をStep Functionsに任せるのがこの構成の肝",
      "抽出項目には必ず信頼度スコアが付く。スコアをDynamoDBに一緒に保存しておくと、後から「低信頼のものだけ人が確認する」運用（代替パターン2）に発展させやすい",
      "全サービスがVPC外のマネージドサービスなので、ネットワーク設計・サーバー管理が一切不要。月3,000枚程度なら性能設計も不要"
    ],
    pros: [
      "テンプレート定義なしで多様なレイアウトの帳票を処理できる",
      "完全従量課金で、帳票が少ない月はコストも下がる",
      "リトライ・エラー分岐がStep Functionsの定義で完結し、運用スクリプトを自作しなくてよい",
      "原本・抽出結果・信頼度が揃って残るため、監査や精度改善の分析がしやすい"
    ],
    cons: [
      "日本語帳票の抽出精度は帳票の品質（解像度・手書きの有無）に左右され、事前検証が必須",
      "Textractの生JSONは構造が複雑で、整形Lambdaの実装にそれなりの工数がかかる",
      "項目の意味解釈（この金額は税込か税抜か等）はできないため、業務ルールはLambda側に書く必要がある"
    ],
    cost: "<strong>月3万円程度</strong>（フォーム＋表解析を月3,000ページ、1ページ約10円＝0.065USD、1USD150円換算）。文字起こしだけでよい帳票はDetectDocumentText（1ページ約0.23円）に切り替えると大きく下がる。Step Functions・Lambda・DynamoDBは合計でも月数百円規模。",
    references: [
      { title: "Amazon Textractとは", url: "https://docs.aws.amazon.com/ja_jp/textract/latest/dg/what-is.html" },
      { title: "ドキュメントの分析（フォーム・表の抽出）", url: "https://docs.aws.amazon.com/ja_jp/textract/latest/dg/how-it-works-analyzing.html", note: "キーと値のペア抽出の仕組み" },
      { title: "非同期オペレーションの呼び出し", url: "https://docs.aws.amazon.com/ja_jp/textract/latest/dg/async.html", note: "複数ページPDF処理に必須" },
      { title: "AWS Step Functionsとは", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/welcome.html" },
      { title: "Amazon Textractの料金", url: "https://aws.amazon.com/jp/textract/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "Bedrock活用（非定型文書を文脈ごと理解する）",
      when: "手書きメモ混じりの帳票や契約書など非定型文書が多い場合や、「支払期限を過ぎているか」のような解釈を伴う抽出までさせたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "doc", icon: "resources/documents", label: "非定型帳票\n手書き混じり", col: 0, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n帳票画像", col: 1, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n抽出制御", col: 2, row: 0 },
          { id: "br", icon: "services/bedrock", label: "Bedrock\nLLM抽出", col: 3, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n抽出データ", col: 3, row: 1 }
        ],
        edges: [
          { from: "doc", to: "s3", label: "アップロード" },
          { from: "s3", to: "lambda", label: "イベント通知" },
          { from: "lambda", to: "br", label: "画像+抽出指示" },
          { from: "lambda", to: "ddb", label: "JSON保存" }
        ]
      },
      flow: [
        "帳票がS3に置かれるとLambdaが起動する",
        "Lambdaが帳票画像と「取引先名・金額・支払期限をJSONで抽出して」というプロンプトをBedrockのマルチモーダルモデルに送る",
        "モデルがレイアウトに関係なく文脈で項目を読み取り、指定したJSON形式で返す",
        "LambdaがJSONを検証してDynamoDBに保存する"
      ],
      services: [
        { icon: "services/bedrock", name: "Amazon Bedrock", role: "画像を直接読めるLLMをAPIで利用。文脈理解を伴う抽出や要約まで1回の呼び出しでこなす" },
        { icon: "services/lambda", name: "AWS Lambda", role: "プロンプト組み立て・出力JSONの検証・保存を担当" },
        { icon: "services/s3", name: "Amazon S3", role: "帳票原本の保存先兼イベント起点" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "抽出結果の保存先" }
      ],
      points: [
        "抽出したい項目の定義をプロンプトで書くため、帳票の種類が増えても指示文を足すだけで対応できる。Textractの後処理Lambdaで書いていた整形ロジックの多くをモデル側に寄せられる",
        "「振込先が前回と違う」「金額欄が空欄」のような業務的な注意点の指摘まで同時に生成でき、単なるOCRを超えた使い方ができる",
        "LLMは存在しない値をもっともらしく答える（ハルシネーション）ことがあるため、金額や日付は形式チェックを必ず入れ、重要帳票は人の確認を残す",
        "TextractのようなページごとのOCR特化課金と違い、トークン課金なので画像サイズと出力量でコストが変わる。大量処理の前に単価を実測しておく"
      ],
      pros: [
        "レイアウトが毎回違う非定型文書や手書き混じりに強い",
        "抽出と同時に解釈（期限超過の判定・内容の要約）までできる",
        "抽出項目の追加・変更がプロンプト修正だけで済む"
      ],
      cons: [
        "出力が確率的で、同じ帳票でも結果が揺れることがある（検証処理が必須）",
        "座標情報（どの位置から抽出したか）が得られず、抽出根拠の提示が難しい",
        "処理速度がTextractより遅く、大量一括処理では時間とコストがかさみやすい"
      ],
      cost: "<strong>月5,000円〜3万円程度</strong>（月3,000枚、1枚あたり2〜10円程度の想定。使うモデルと画像サイズ・出力の長さで変動）。軽量モデルで足りればTextractのフォーム解析より安くなることもあり、事前の単価実測が重要。",
      references: [
        { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" },
        { title: "Amazon Bedrockの料金", url: "https://aws.amazon.com/jp/bedrock/pricing/" },
        { title: "Amazon S3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventNotifications.html" }
      ]
    },
    {
      name: "人手確認フロー入り（低信頼の結果だけ人がチェック）",
      when: "会計データなど誤りが許されない用途で、自動化率と正確性を両立したい場合",
      diagram: {
        cols: 5, rows: 3,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [0, 0], to: [3, 2] }
        ],
        nodes: [
          { id: "txt", icon: "services/textract", label: "Textract\nOCR解析", col: 2, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n帳票画像", col: 0, row: 1 },
          { id: "sfn", icon: "services/step-functions", label: "Step Functions\n信頼度で分岐", col: 1, row: 1 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n確定データ", col: 3, row: 1 },
          { id: "sqs", icon: "services/sqs", label: "SQS\n確認待ちキュー", col: 1, row: 2 },
          { id: "app", icon: "services/amplify", label: "確認用\nWebアプリ", col: 2, row: 2 },
          { id: "op", icon: "resources/user", label: "担当者\n目視確認", col: 4, row: 2 }
        ],
        edges: [
          { from: "s3", to: "sfn", label: "イベント起動" },
          { from: "sfn", to: "txt", label: "解析" },
          { from: "sfn", to: "ddb", label: "高信頼は自動確定" },
          { from: "sfn", to: "sqs", label: "低信頼を送る" },
          { from: "sqs", to: "app", label: "確認タスク" },
          { from: "app", to: "ddb", label: "確認済みを登録" },
          { from: "op", to: "app", label: "確認・修正" }
        ]
      },
      flow: [
        "帳票がS3に置かれるとStep Functionsが起動し、Textractで解析する",
        "抽出項目の信頼度スコアをチェックし、すべて高信頼（例：95以上）ならそのままDynamoDBに自動確定で登録する",
        "低信頼の項目を含む帳票はSQS（処理待ちの行列を作るキュー）に入れる",
        "担当者は確認用Webアプリでキューの帳票画像と抽出結果を見比べ、修正して登録する。確定データには自動か人手確認かの区別も記録する"
      ],
      services: [
        { icon: "services/textract", name: "Amazon Textract", role: "OCR解析。項目ごとの信頼度スコアが分岐の判断材料になる" },
        { icon: "services/step-functions", name: "AWS Step Functions", role: "信頼度による自動確定と人手確認の振り分けを担うワークフロー" },
        { icon: "services/sqs", name: "Amazon SQS", role: "確認待ち帳票のキュー。担当者が不在でも溜めておけて、取りこぼしがない" },
        { icon: "services/amplify", name: "AWS Amplify Hosting", role: "確認用Webアプリの配信基盤。画像と抽出結果を並べて表示し修正を受け付ける" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "確定データの保存先。確定方法（自動・人手）も記録する" },
        { icon: "services/s3", name: "Amazon S3", role: "帳票原本の保存先。確認画面での原本表示にも使う" }
      ],
      points: [
        "「AIで全自動」ではなく「高信頼だけ自動、残りは人」と設計すると、自動化率8〜9割と会計品質を両立できる。この考え方はヒューマンインザループと呼ばれ、AI導入の実務で最重要のパターン",
        "しきい値は最初は保守的（人手確認多め）に始め、修正実績を見ながら段階的に上げると事故なく自動化率を伸ばせる",
        "人の修正結果は「正解データ」として蓄積される。どの取引先の帳票で誤りが多いかを分析すれば、スキャン品質の改善やしきい値調整に活かせる",
        "キューにSQSを使うことで、確認作業が数日遅れても帳票が失われず、担当者の作業ペースとシステムの処理ペースを分離できる"
      ],
      pros: [
        "誤データがそのまま会計システムに流れる事故を構造的に防げる",
        "人の確認対象が低信頼分のみに絞られ、全件目視に比べて工数を大幅削減できる",
        "修正実績が精度改善のデータとして貯まる"
      ],
      cons: [
        "確認用Webアプリの開発・保守という追加コストがかかる",
        "人の確認が挟まるぶん、低信頼帳票の処理完了までの時間は長くなる",
        "しきい値・確認ルールの設計と見直しという運用タスクが増える"
      ],
      cost: "<strong>月3万円強</strong>（Textract費用は推奨構成と同じ月3万円程度＋SQSはほぼ無料枠内＋確認用Webアプリの配信が月数百円）。追加のAWS費用はごく小さく、実質の追加コストは確認アプリの開発工数と担当者の確認時間。",
      references: [
        { title: "Amazon SQSとは", url: "https://docs.aws.amazon.com/ja_jp/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html" },
        { title: "AWS Amplify Hostingとは", url: "https://docs.aws.amazon.com/ja_jp/amplify/latest/userguide/welcome.html" },
        { title: "AWS Step Functionsとは", url: "https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/welcome.html", note: "分岐・並列・待ち合わせの定義方法" }
      ]
    }
  ],
  cost: "<p>推奨構成は<strong>月3万円程度</strong>（フォーム＋表解析3,000ページ）で、手入力の人件費数人分と比べると通常は大幅な削減になる。Bedrock案は<strong>月5,000円〜3万円程度</strong>とモデル次第で推奨構成より安くも高くもなる。人手確認フロー入りはAWS費用こそ<strong>月3万円強</strong>とほぼ同じだが、確認アプリの開発工数が別途かかる。いずれも従量課金で、帳票枚数に比例する。</p>",
  summary: "<p>帳票OCRは「文字を読む」だけなら簡単に見えて、実務では<strong>複数ページ対応・失敗時のリトライ・結果の検証</strong>という周辺の仕組みが本体です。だからこそTextract単体ではなくStep Functionsとの組み合わせが定番になります。そして会計のような誤りが許されない領域では、<strong>信頼度スコアで自動と人手を振り分けるヒューマンインザループ</strong>が最終形です。定型帳票はTextract、非定型・解釈が必要ならBedrock、という使い分けの軸も覚えておきましょう。</p>",
  quiz: [
    {
      q: "OCRはTextractのAPIを呼ぶだけに見えますが、なぜStep Functionsのワークフローが必要なのでしょうか。",
      a: "複数ページのPDFはジョブ開始と完了待ちが分かれる非同期APIでしか処理できず、その状態管理と失敗時のリトライを自前スクリプトで書くと運用が重くなるからです。「解析、完了待ち、整形、保存」を宣言的に定義しておけば、月3,000枚を人が見張らなくても失敗箇所が分かり再実行できます。OCR本体より、この周辺の仕組みのほうが実務の中身だと言えます。"
    },
    {
      q: "抽出項目に信頼度スコアを添えてDynamoDBへ保存しています。スコアを捨てて確定値だけ保存すると、後で何ができなくなるでしょうか。",
      a: "「低信頼の項目を含む帳票だけ人が確認する」という運用（代替2）へ発展させられなくなります。またどの取引先の帳票で誤りが多いかを分析し、スキャン品質の改善やしきい値の調整に活かすこともできません。スコアは精度改善の手がかりであり、自動化率を上げていく根拠でもあるため、確定値と一緒に残しておくのが定石です。"
    },
    {
      q: "手書きメモ入りの非定型な発注書が増え、「支払期限を過ぎていないか」の判定まで欲しいと言われました。あなたなら構成をどう変えるでしょうか。",
      a: "代替1のBedrock案を併用します。マルチモーダルモデルはレイアウトに依存せず文脈で読み取れ、抽出と同時に期限超過の判定までこなせるためです。ただし出力が確率的で抽出根拠となる座標も得られないので、金額や日付には形式チェックを入れ、会計へ流す重要帳票には人の確認を残します。定型帳票はTextract、非定型はBedrockと帳票の種類でパイプラインを分けるのが現実解です。"
    }
  ]
});
