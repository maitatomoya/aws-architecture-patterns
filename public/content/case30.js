// ケース30：レコメンドエンジン
registerCase({
  id: 30,
  category: "AI・機械学習",
  title: "レコメンドエンジン",
  scenario: "<p>会員10万人・商品点数5万点のECサイトで、トップページの「あなたへのおすすめ」と商品ページの「この商品を見た人はこちらも」を実現したい。現在は人手で選んだ特集商品を全員に同じ内容で出しており、クリック率が伸び悩んでいる。ユーザーごとの閲覧・購入履歴を活かしたパーソナライズ（一人ひとり違うおすすめ）に切り替えたいが、社内に推薦アルゴリズムの専門家はいない。</p>",
  requirements: [
    "ユーザーごとに異なる「あなたへのおすすめ」を出したい",
    "閲覧・購入などの行動履歴をリアルタイムに反映したい（今見た商品が次の推薦に効く）",
    "推薦アルゴリズムの専門知識なしで実現したい",
    "新商品・新規ユーザーにもそれなりの推薦を出したい（コールドスタート対策）",
    "効果（クリック率・購入率）を測りながら改善したい"
  ],
  main: {
    name: "Personalize + Kinesis + S3 + Lambda（マネージド推薦エンジン）",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "user", icon: "resources/users", label: "ユーザー\n閲覧・購入", col: 0, row: 1 },
        { id: "kin", icon: "services/kinesis-data-streams", label: "Kinesis\nイベント収集", col: 1, row: 0 },
        { id: "l1", icon: "services/lambda", label: "Lambda\n取り込み処理", col: 2, row: 0 },
        { id: "pers", icon: "services/personalize", label: "Personalize\n学習・推論", col: 3, row: 0 },
        { id: "l2", icon: "services/lambda", label: "Lambda\n推薦API", col: 2, row: 1 },
        { id: "s3", icon: "services/s3", label: "S3\n過去データ", col: 4, row: 1 }
      ],
      edges: [
        { from: "user", to: "kin", label: "行動イベント" },
        { from: "kin", to: "l1", label: "ストリーム" },
        { from: "l1", to: "pers", label: "イベント登録" },
        { from: "user", to: "l2", label: "おすすめ取得" },
        { from: "l2", to: "pers", label: "推薦を問い合わせ" },
        { from: "s3", to: "pers", label: "過去データ取込", dashed: true }
      ]
    },
    flow: [
      "過去の閲覧・購入履歴をS3に置き、Personalizeに一括インポートして最初のモデルを学習させる",
      "サイト上の「商品を見た・カートに入れた・買った」という行動イベントをKinesisに送り、Lambdaが順次PersonalizeのEvent Tracker（行動をリアルタイムで学習に反映する入口）へ登録する",
      "ユーザーがページを開くと、推薦APIのLambdaがPersonalizeのキャンペーン（推論エンドポイント）へ問い合わせる",
      "そのユーザー向けにランキングされた商品ID一覧が返り、商品情報を付けて画面に表示する",
      "モデルは新しい行動データを取り込みながら定期的に再学習し、推薦の鮮度を保つ"
    ],
    services: [
      { icon: "services/personalize", name: "Amazon Personalize", role: "Amazon.com同等技術の推薦エンジン。アルゴリズム選定・学習・推論APIまでをマネージドで提供" },
      { icon: "services/kinesis-data-streams", name: "Amazon Kinesis Data Streams", role: "大量の行動イベントを順序付きで受け止めるストリーム。急なアクセス増でもイベントを取りこぼさない" },
      { icon: "services/lambda", name: "AWS Lambda", role: "イベントの取り込みと推薦APIの2箇所を担うサーバーレス処理" },
      { icon: "services/s3", name: "Amazon S3", role: "過去の行動履歴・商品カタログの一括インポート元" }
    ],
    points: [
      "Personalizeの本質は「協調フィルタリング（この商品を買った人は他にこれも買う、という行動の類似性から推薦する手法）を自前実装せずに使える」こと。アルゴリズムはレシピと呼ばれる選択肢から用途別に選ぶだけでよい",
      "リアルタイムのイベント反映が効果の要。「たった今見た商品」が次のページの推薦に効くため、バッチ更新だけの推薦より体感の賢さが大きく違う",
      "新規ユーザーには人気ランキング相当の推薦から始まり、行動が溜まるほど個人化される。コールドスタート対策が組み込みなのもマネージドの利点",
      "推薦の効果はクリック率などで必ず計測する。「人手の特集 vs Personalize」のA/Bテストを最初に設計しておくと、費用対効果を数字で説明できる"
    ],
    pros: [
      "推薦アルゴリズムの専門家なしで、実績ある推薦エンジンを導入できる",
      "行動のリアルタイム反映・再学習・推論スケーリングまで面倒を見てもらえる",
      "ECの推薦以外（記事・動画・求人など）にも同じ構成が使い回せる"
    ],
    cons: [
      "リアルタイム推論エンドポイントは最低スループット分が常時課金され、完全な従量課金にはならない",
      "モデルの中身はブラックボックスで、「なぜこれが推薦されたか」の説明が難しい",
      "行動データが少ないサイトでは効果が出にくく、データ整備が先になることがある"
    ],
    cost: "<strong>月2万5,000円前後から</strong>（リアルタイム推論の最低スループット1TPS常時稼働で約2万2,000円＋学習時間課金＋Kinesis1シャード約1,600円、1USD150円換算）。リアルタイム性を諦めてバッチ推薦（夜間に全ユーザー分を生成して保存）にすると大きく下げられる。",
    references: [
      { title: "Amazon Personalizeとは", url: "https://docs.aws.amazon.com/ja_jp/personalize/latest/dg/what-is-personalize.html" },
      { title: "イベントの記録（Event Tracker）", url: "https://docs.aws.amazon.com/ja_jp/personalize/latest/dg/recording-events.html", note: "リアルタイム反映の仕組み" },
      { title: "Amazon Kinesis Data Streamsとは", url: "https://docs.aws.amazon.com/ja_jp/streams/latest/dev/introduction.html" },
      { title: "Amazon Personalizeの料金", url: "https://aws.amazon.com/jp/personalize/pricing/", note: "TPS時間課金の考え方はここで確認" }
    ]
  },
  alternatives: [
    {
      name: "SageMakerで自前の協調フィルタリング",
      when: "推薦ロジックを独自に作り込みたい場合や、MLチームがいて実験・チューニングを自社で回したい場合",
      diagram: {
        cols: 3, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [2, 1] }
        ],
        nodes: [
          { id: "user", icon: "resources/users", label: "ユーザー\nおすすめ閲覧", col: 0, row: 0 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\n推薦API", col: 1, row: 0 },
          { id: "smep", icon: "services/sagemaker", label: "SageMaker\n推論エンドポイント", col: 2, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n行動ログ", col: 1, row: 1 },
          { id: "smtr", icon: "services/sagemaker", label: "SageMaker\n学習ジョブ", col: 2, row: 1 }
        ],
        edges: [
          { from: "user", to: "lambda", label: "おすすめ取得" },
          { from: "lambda", to: "smep", label: "推論リクエスト" },
          { from: "s3", to: "smtr", label: "学習データ" },
          { from: "smtr", to: "smep", label: "モデルデプロイ" }
        ]
      },
      flow: [
        "S3に蓄積した行動ログを使い、SageMakerの学習ジョブで推薦モデル（行列分解やニューラル推薦など）を学習する",
        "学習済みモデルを推論エンドポイントにデプロイする",
        "推薦APIのLambdaがエンドポイントを呼び、ユーザーごとの推薦リストを返す",
        "定期的に再学習し、精度指標を比較してから新モデルに切り替える"
      ],
      services: [
        { icon: "services/sagemaker", name: "Amazon SageMaker", role: "学習・推論の基盤。アルゴリズムの選択と実装の自由度が最大" },
        { icon: "services/lambda", name: "AWS Lambda", role: "推薦APIの入口。エンドポイントの呼び出しと結果整形" },
        { icon: "services/s3", name: "Amazon S3", role: "学習データ（行動ログ・商品データ）の置き場" }
      ],
      points: [
        "「ビジネスルールとの複雑な混合（在庫・粗利・キャンペーンを推薦順位に反映）」など、Personalizeの枠を超えた要件が出たときに初めて選ぶ案。要件が枠内ならPersonalizeのほうが速くて安い",
        "推薦モデルは学習の実験管理（どのデータ・パラメータで精度がどうだったか）が本体で、モデル本体のコードより実験基盤の整備に時間を使う",
        "エンドポイントの常時起動費を抑えるため、夜間バッチで全ユーザーの推薦リストを事前計算してDynamoDBに置き、日中はそれを返すだけにする設計も定番",
        "行動ログの収集パイプライン（Kinesis等）は推奨構成と共通で必要になる"
      ],
      pros: [
        "アルゴリズム・特徴量・ビジネスルールの反映まで自由に設計できる",
        "モデルの中身を自社で把握でき、説明や改善の打ち手が立てやすい",
        "大規模になれば、マネージドの課金体系より安く運用できる可能性がある"
      ],
      cons: [
        "推薦アルゴリズムとMLOpsの知識を持つ人材が必須",
        "効果が出るまでの開発期間が数か月単位でかかる",
        "エンドポイント常時起動や実験用の学習ジョブなど、試行錯誤の費用がかさむ"
      ],
      cost: "<strong>月1万2,000円〜数万円＋人件費</strong>（推論エンドポイントml.m5.large常時起動で月約1万2,500円、学習ジョブは実験量に比例。1USD150円換算）。金額よりも、専門人材の工数が最大のコストになる点に注意。",
      references: [
        { title: "Amazon SageMaker AIとは", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/whatis.html" },
        { title: "リアルタイム推論エンドポイント", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/realtime-endpoints.html" },
        { title: "Amazon SageMakerの料金", url: "https://aws.amazon.com/jp/sagemaker/pricing/" }
      ]
    },
    {
      name: "DynamoDB + Lambdaのルールベース推薦",
      when: "「よく一緒に買われる商品」程度で十分な場合や、行動データがまだ少なくML導入の前段階として始めたい場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "user", icon: "resources/users", label: "ユーザー\nおすすめ閲覧", col: 0, row: 0 },
          { id: "api", icon: "services/lambda", label: "Lambda\n推薦API", col: 1, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n集計結果", col: 2, row: 0 },
          { id: "evb", icon: "services/eventbridge", label: "EventBridge\n定時起動", col: 1, row: 1 },
          { id: "batch", icon: "services/lambda", label: "Lambda\n夜間集計", col: 2, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n購買履歴", col: 3, row: 1 }
        ],
        edges: [
          { from: "user", to: "api", label: "おすすめ取得" },
          { from: "api", to: "ddb", label: "参照" },
          { from: "evb", to: "batch", label: "毎晩起動" },
          { from: "batch", to: "s3", label: "履歴を読む" },
          { from: "batch", to: "ddb", label: "集計を書き込み" }
        ]
      },
      flow: [
        "EventBridgeのスケジュールで毎晩Lambdaを起動する",
        "LambdaがS3の購買履歴から「商品Aと同じ注文で買われた商品ランキング」「カテゴリ別人気ランキング」を集計する",
        "集計結果を商品IDをキーにしてDynamoDBへ書き込む",
        "商品ページ表示時は、推薦APIのLambdaがDynamoDBを1回読むだけで「一緒に買われている商品」を返す"
      ],
      services: [
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "事前計算した推薦リストの置き場。キー1発の読み取りなので表示が速い" },
        { icon: "services/lambda", name: "AWS Lambda", role: "夜間の集計処理と推薦APIの2役" },
        { icon: "services/eventbridge", name: "Amazon EventBridge", role: "夜間バッチのスケジューラ" },
        { icon: "services/s3", name: "Amazon S3", role: "集計元の購買履歴データ置き場" }
      ],
      points: [
        "「同じ注文でよく一緒に買われる商品」は集計クエリだけで作れる立派な推薦で、機械学習なしでもクリック率改善の効果が出ることは多い。まずここから始めて効果測定の土台を作るのが賢い順序",
        "推薦結果を夜間に事前計算しておく方式は、表示時の処理がDynamoDBの読み取り1回で済むため、速くて安く、障害点も少ない",
        "個人化はされない（全ユーザー同じ結果）ことを明確に理解しておく。「閲覧中の商品に応じて変わる」ことと「人ごとに変わる」ことは別物",
        "この構成で行動ログの蓄積を始めておけば、後からPersonalize移行時の学習データがそのまま揃う"
      ],
      pros: [
        "圧倒的に安く、仕組みが単純で全員が理解・デバッグできる",
        "推薦理由が明快（一緒に買われた実績）で、ユーザーにも説明できる",
        "行動データが少ない立ち上げ期でも成立する"
      ],
      cons: [
        "ユーザー個人ごとのパーソナライズはできない",
        "「今見た商品」のリアルタイム反映もできない（夜間集計の鮮度）",
        "ロングテール商品（購買実績が少ない商品）には推薦が付きにくい"
      ],
      cost: "<strong>月数百円程度</strong>（夜間Lambda集計＋DynamoDB読み書き＋S3保存のみの従量課金。会員10万人規模でも無料枠に収まることが多い）。Personalize案の100分の1以下で、費用対効果の検証を始めるには十分。",
      references: [
        { title: "Amazon DynamoDBとは", url: "https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/Introduction.html" },
        { title: "Amazon EventBridgeとは", url: "https://docs.aws.amazon.com/ja_jp/eventbridge/latest/userguide/eb-what-is.html", note: "スケジュール起動の仕組み" },
        { title: "Amazon Personalizeとは", url: "https://docs.aws.amazon.com/ja_jp/personalize/latest/dg/what-is-personalize.html", note: "この構成から移行する先の把握に" }
      ]
    }
  ],
  cost: "<p>推奨構成（Personalize）は<strong>月2万5,000円前後から</strong>で、リアルタイム推論の常時課金が中心。SageMaker自前案は<strong>月1万2,000円〜数万円</strong>に加えて専門人材の工数が実質最大のコスト。ルールベース案は<strong>月数百円程度</strong>と桁違いに安い。売上規模に対して推薦の改善が生む金額を見積もり、段階的に上のパターンへ進むのがコスト面でも合理的。</p>",
  summary: "<p>レコメンドは「いきなり機械学習」ではなく、<strong>ルールベース→マネージドML（Personalize）→自前ML（SageMaker）</strong>という発展段階で捉えるのが実務的です。多くのサイトはルールベースの「よく一緒に買われる」で十分な効果が出ますし、そこで蓄積した行動データがそのまま次の段階の学習データになります。パーソナライズが本当に必要になったらPersonalize、その枠を超える独自要件が出たらSageMaker。<strong>効果測定（A/Bテスト）を先に設計しておくことが、どの段階でも投資判断の軸になります</strong>。</p>"
});
