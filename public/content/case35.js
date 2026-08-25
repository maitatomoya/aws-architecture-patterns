// ケース35：社内向け生成AIアシスタント
registerCase({
  id: 35,
  category: "社内・閉域・ハイブリッド",
  title: "社内向け生成AIアシスタント",
  scenario: "<p>社員から「ChatGPTのような生成AIを仕事で使いたい」という要望が多いが、外部の生成AIサービスへ社内情報を入力することは情報漏えいの懸念から禁止している。そこで、自社のAWS環境内で完結する社内向け生成AIチャットアシスタントを提供したい。利用は社員のみに限定し、会話履歴も自社の管理下で保存する。</p>",
  requirements: [
    "入力した社内情報がAIモデルの学習に使われないこと",
    "社員だけが使えるようにログイン認証をかけること",
    "会話履歴を保存し、続きから会話できること",
    "サーバー管理なしで小さく始め、利用が増えても耐えられること",
    "費用は利用量に応じた従量課金であること"
  ],
  main: {
    name: "Bedrock+API Gateway+Lambda+Cognito+DynamoDB",
    diagram: {
      cols: 6, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] }
      ],
      nodes: [
        { id: "users", icon: "resources/users", label: "社員", col: 0, row: 1 },
        { id: "cognito", icon: "services/cognito", label: "Cognito\n社員認証", col: 2, row: 0 },
        { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 2, row: 1 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\nアプリロジック", col: 3, row: 1 },
        { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n会話履歴", col: 4, row: 0 },
        { id: "bedrock", icon: "services/bedrock", label: "Bedrock\n基盤モデル", col: 5, row: 1 }
      ],
      edges: [
        { from: "users", to: "apigw", label: "HTTPS" },
        { from: "cognito", to: "apigw", noArrow: true, dashed: true },
        { from: "apigw", to: "lambda", label: "認証済みのみ" },
        { from: "lambda", to: "ddb", label: "履歴の読み書き" },
        { from: "lambda", to: "bedrock", label: "推論リクエスト" }
      ]
    },
    flow: [
      "社員はCognitoでログインし、チャット画面からAPI Gatewayを呼び出す",
      "API GatewayはCognitoのトークン（ログイン済みの証明）を検証し、認証済みのリクエストだけをLambdaに渡す",
      "LambdaはDynamoDBから会話履歴を読み出し、今回の質問と合わせてBedrockの基盤モデルへ送る",
      "生成された回答を社員へ返し、あわせて会話履歴をDynamoDBに保存する"
    ],
    services: [
      { icon: "services/bedrock", name: "Amazon Bedrock", role: "複数の基盤モデル（生成AIの本体）をAPIひとつで使えるマネージドサービス。入出力はモデルの学習に使われない" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "チャットAPIの入口。Cognitoオーソライザーで未認証リクエストを門前払いする" },
      { icon: "services/lambda", name: "AWS Lambda", role: "履歴の組み立て・Bedrock呼び出し・回答整形などのアプリロジックを担うサーバーレス実行環境" },
      { icon: "services/cognito", name: "Amazon Cognito", role: "社員のログイン認証。既存の社内IdPとのSAML/OIDC連携もできる" },
      { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "会話履歴の保存先。ユーザーID+会話IDのキー設計で高速に読み書きできる" }
    ],
    points: [
      "Bedrockに送った入力・出力は基盤モデルの学習に使われず、モデル提供元とも共有されないことをAWSが公式に明言している。「外部AI禁止」の根拠だった学習利用の懸念に正面から答えられる構成",
      "この図にVPCもIGWも無いのは、すべてVPC外のマネージドサービスで組んだサーバーレス構成だから。ゲートウェイ類はVPCを使う構成で初めて登場する",
      "会話履歴はDynamoDBにユーザーID+会話IDをキーとして保存する。TTL（期限が来た項目の自動削除）を設定すれば、履歴の保存期間ポリシーにもそのまま対応できる",
      "より厳格に閉域化したい場合は、API GatewayをプライベートAPIにしてVPCエンドポイント経由でのみ呼べるようにし、ケース32の閉域接続と組み合わせる"
    ],
    pros: [
      "従量課金でスモールスタートでき、サーバー管理もゼロ",
      "モデルの選択肢が広く、コードをほぼ変えずにモデルを切り替えられる",
      "認証・履歴・APIが分離されており、後からRAG（代替2）などを足しやすい"
    ],
    cons: [
      "トークン従量課金は利用が増えると青天井になり得る（予算アラート必須）",
      "モデル自体を細かく作り替えるような用途には向かない",
      "リージョンによって使えるモデルに差がある"
    ],
    cost: "<strong>月数千円〜数万円程度</strong>。Bedrockはトークン（文章を細かく区切った単位）ごとの従量課金で、社員100人が日常的に使う規模なら月1万円前後から利用量に比例して増える。API Gateway・Lambda・DynamoDB・Cognitoは合計でも月数百円〜数千円規模",
    references: [
      { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html", note: "Bedrock公式ユーザーガイド" },
      { title: "Amazon Bedrockのデータ保護", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/data-protection.html", note: "入出力が学習に使われないことの公式説明" },
      { title: "Amazon Cognitoとは", url: "https://docs.aws.amazon.com/ja_jp/cognito/latest/developerguide/what-is-amazon-cognito.html" },
      { title: "プライベートAPIの作成（API Gateway）", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/apigateway-private-apis.html", note: "閉域化する場合の方法" },
      { title: "Amazon Bedrockの料金", url: "https://aws.amazon.com/jp/bedrock/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "ECS+SageMakerでオープンモデルを自前運用",
      when: "モデル自体も自社の管理下に置く方針の場合や、Bedrockの提供モデル・リージョン制約が要件に合わない場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [2, 1], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [2, 1], to: [2, 1], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "社員", col: 0, row: 0 },
          { id: "ddb", icon: "services/dynamodb", label: "DynamoDB\n会話履歴", col: 1, row: 1 },
          { id: "ecs", icon: "services/ecs", label: "ECS\nチャットアプリ", col: 2, row: 1 },
          { id: "sm", icon: "services/sagemaker", label: "SageMaker\n推論エンドポイント", col: 3, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\nモデル格納", col: 3, row: 0 }
        ],
        edges: [
          { from: "users", to: "ecs", label: "社内から利用", dashed: true },
          { from: "ecs", to: "ddb", label: "会話履歴" },
          { from: "ecs", to: "sm", label: "推論リクエスト" },
          { from: "s3", to: "sm", label: "モデル読み込み", dashed: true }
        ]
      },
      flow: [
        "S3に置いたオープンモデル（Llamaなど公開されている生成AIモデル）をSageMakerの推論エンドポイントにデプロイする",
        "社員は社内ネットワークからECS上のチャットアプリにアクセスする（入口はケース32の閉域構成と組み合わせる）",
        "ECSがSageMakerへ推論リクエストを送り、会話履歴はDynamoDBに保存する"
      ],
      services: [
        { icon: "services/sagemaker", name: "Amazon SageMaker AI", role: "機械学習モデルのデプロイ基盤。GPUインスタンス上でオープンモデルを推論エンドポイントとして公開する" },
        { icon: "services/ecs", name: "Amazon ECS", role: "チャットアプリ（UI/API）の実行基盤" },
        { icon: "services/s3", name: "Amazon S3", role: "モデルの重みファイル（学習済みパラメータ）の格納先" },
        { icon: "services/dynamodb", name: "Amazon DynamoDB", role: "会話履歴の保存先" }
      ],
      points: [
        "SageMaker JumpStartを使うと、公開されているモデルを少ない手数でデプロイできる。モデルの重みまで自社アカウント内で完結するのが最大の特徴",
        "費用の大半はGPUインスタンスの常時稼働分。夜間停止やオートスケーリングを設計しないと月十数万円が固定費になる",
        "モデルの品質評価・更新・安全対策（不適切出力への対処）も自社責任になる。Bedrockで要件を満たせるならまずBedrockを検討し、それでも足りないときの選択肢と考える"
      ],
      pros: [
        "モデル本体まで含めて完全に自社管理でき、説明責任を果たしやすい",
        "モデルの選択・差し替え・チューニングの自由度が高い"
      ],
      cons: [
        "GPU費用が高額で、利用が少なくても固定費がかかる",
        "モデル運用（MLOps）の専門知識が必要になる"
      ],
      cost: "<strong>月15万円前後〜</strong>（GPU推論インスタンスml.g5.xlarge相当の常時稼働で月15万円前後+ECS・DynamoDBで数千円。モデルが大きいほどGPU費用は上がる）",
      references: [
        { title: "Amazon SageMaker AIとは", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/whatis.html", note: "SageMaker公式デベロッパーガイド" },
        { title: "SageMaker JumpStart", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/studio-jumpstart.html", note: "公開モデルのデプロイ機能" },
        { title: "Amazon SageMaker AIの料金", url: "https://aws.amazon.com/jp/sagemaker/pricing/" }
      ]
    },
    {
      name: "RAG追加構成（社内文書を踏まえた回答）",
      when: "一般知識だけでなく、社内規程やマニュアルの内容を踏まえて回答してほしい場合",
      diagram: {
        cols: 6, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "社員", col: 0, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n社内文書", col: 2, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API Gateway", col: 2, row: 1 },
          { id: "lambda", icon: "services/lambda", label: "Lambda", col: 3, row: 1 },
          { id: "os", icon: "services/opensearch", label: "OpenSearch\nベクトル検索", col: 4, row: 0 },
          { id: "bedrock", icon: "services/bedrock", label: "Bedrock\n基盤モデル", col: 5, row: 1 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "HTTPS" },
          { from: "apigw", to: "lambda" },
          { from: "s3", to: "os", label: "文書を事前取り込み", dashed: true },
          { from: "lambda", to: "os", label: "関連文書を検索" },
          { from: "lambda", to: "bedrock", label: "文書を添えて推論" }
        ]
      },
      flow: [
        "社内文書をS3に集約し、埋め込み（文章の意味を数値ベクトルに変換したもの）を事前にOpenSearchへ取り込んでおく",
        "質問を受けたLambdaは、まずOpenSearchで質問に関連する社内文書を検索する",
        "見つかった文書を質問に添えてBedrockへ送り、社内情報に基づいた回答を生成する（この手法をRAG＝検索拡張生成と呼ぶ）"
      ],
      services: [
        { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "文書のベクトル検索エンジン。質問と意味が近い社内文書を探し出す" },
        { icon: "services/s3", name: "Amazon S3", role: "社内規程・マニュアルなど元文書の置き場所" },
        { icon: "services/bedrock", name: "Amazon Bedrock", role: "検索結果の文書を根拠として回答を生成する基盤モデル" },
        { icon: "services/lambda", name: "AWS Lambda", role: "検索→プロンプト組み立て→推論の一連の流れを実行する" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "チャットAPIの入口。認証は推奨構成と同じCognitoを使う" }
      ],
      points: [
        "RAGはモデルを再学習させずに社内知識を反映できる定番手法。検索部分の詳しい設計はケース26（RAGチャットボット）を参照",
        "Bedrockのナレッジベース機能を使うと、S3からの取り込み・埋め込み・検索をマネージドでまとめて構築することもできる",
        "回答に「根拠となった文書へのリンク」を添えると、社員が真偽を確認でき、生成AIの弱点であるもっともらしい誤り（ハルシネーション）を補える"
      ],
      pros: [
        "社内規程・マニュアルに基づく回答ができ、実用性が大きく上がる",
        "文書を更新すれば回答も追従する（モデルの再学習が不要）"
      ],
      cons: [
        "検索基盤（OpenSearch）の費用と、文書取り込みパイプラインの構築・運用が増える",
        "回答品質が検索精度に左右されるため、文書の整備・分割方法の調整が必要"
      ],
      cost: "<strong>推奨構成+月5,000円〜数万円</strong>（OpenSearch小型ドメインが月5,000円前後〜+埋め込み生成のトークン費用。文書量と検索頻度で変動）",
      references: [
        { title: "Amazon Bedrockのナレッジベース", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/knowledge-base.html", note: "RAGをマネージドで構築する機能" },
        { title: "Amazon OpenSearch Serviceとは", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/what-is.html" },
        { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" }
      ]
    }
  ],
  cost: "<p>推奨構成（Bedrock）は<strong>月数千円〜数万円</strong>の従量課金で始められる。自前運用案はGPU常時稼働で<strong>月15万円前後〜</strong>と固定費が大きく、費用構造がまったく異なる。RAG追加は<strong>+月5,000円〜数万円</strong>で、実用性への投資として効果が大きい。</p>",
  summary: "<p>社内生成AIの第一歩は<strong>「Bedrockなら入力が学習に使われない」という事実を押さえること</strong>です。外部SaaS禁止の理由が学習利用の懸念なら、この構成で正面から解消できます。認証（Cognito）と履歴（DynamoDB）を最初から分離して作っておくと、次の段階であるRAG（社内文書対応）へ自然に発展できます。GPUでの自前運用は自由度と引き換えに固定費と運用責任が重いため、「Bedrockでは本当に満たせない要件は何か」を言語化してから選びましょう。</p>",
  quiz: [
    {
      q: "「外部の生成AIサービスは禁止」という社内ルールがあるのに、Bedrockなら使ってよいと説明できるのはなぜでしょうか。",
      a: "Bedrockに送った入力と生成された出力は基盤モデルの学習に使われず、モデル提供元とも共有されないことをAWSが公式に明言しているためです。禁止の根拠が入力データの学習利用への懸念であれば、この一点で正面から解消できます。逆に禁止の根拠が「社内の通信を外に出したくない」ことなら、API GatewayをプライベートAPIにしてVPCエンドポイント経由に閉じるなど別の手当てが必要です。禁止理由を言語化してから構成を選ぶのが順序になります。"
    },
    {
      q: "稼働後、利用部門から「就業規則や社内マニュアルの内容も踏まえて答えてほしい」と要望が出ました。あなたならこの構成をどう変えるでしょうか。",
      a: "モデルを作り替えるのではなく、代替パターン2のRAG（検索拡張生成）を足すのが定石です。社内文書をS3に集め、質問に近い文書をOpenSearchなどで検索し、その文書を添えてBedrockへ渡すだけなので、認証と履歴の部分は推奨構成のまま使い回せます。文書を更新すれば回答も追従するため再学習は不要で、検索側の詳しい設計はケース26が参考になります。回答に根拠文書へのリンクを添えると、もっともらしい誤りを利用者自身が検証できます。"
    },
    {
      q: "自前でGPUを用意してオープンモデルを動かす案は自由度が高いのに、第一候補になりにくいのはなぜでしょうか。",
      a: "費用の構造がまったく違うためです。Bedrockはトークン単位の従量課金なので利用の少ない立ち上げ期はほとんど費用がかかりませんが、GPU推論エンドポイントは使われていない時間も課金される固定費で、月15万円前後から始まります。さらにモデルの品質評価・更新・不適切な出力への対処まで自社の責任になります。「Bedrockでは満たせない要件は具体的に何か」を言語化できたときだけ選ぶ構成だと考えましょう。"
    }
  ]
});
