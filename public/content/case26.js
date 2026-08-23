// ケース26：RAGチャットボット（社内ナレッジ回答）
registerCase({
  id: 26,
  category: "AI・機械学習",
  title: "RAGチャットボット（社内ナレッジ回答）",
  scenario: "<p>従業員500名の企業。社内規程・議事録・製品マニュアルなどの文書がS3やファイルサーバーに散在し、「どこに書いてあるか分からない」ため総務・情シスへの問い合わせが月数百件に達している。社内文書の内容に基づいて自然文で回答し、根拠となった文書も提示するチャットボットを作りたい。社外にデータを出せないためAWS内で完結させることが条件。</p>",
  requirements: [
    "一般知識ではなく、社内文書の内容に基づいて回答すること",
    "回答に根拠（出典文書名やリンク）を添えること",
    "文書の追加・更新が自動で回答に反映されること",
    "データをAWSの外に出さないこと（モデルの学習にも使わせない）",
    "1部門でスモールスタートし、全社に拡張できること"
  ],
  main: {
    name: "Bedrock+OpenSearchの自前RAG構成",
    diagram: {
      cols: 5, rows: 2,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 1] }
      ],
      nodes: [
        { id: "os", icon: "services/opensearch", label: "OpenSearch\nベクトル検索", col: 2, row: 0 },
        { id: "lidx", icon: "services/lambda", label: "Lambda\nインデクサ", col: 3, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n社内文書", col: 4, row: 0 },
        { id: "users", icon: "resources/users", label: "社員", col: 0, row: 1 },
        { id: "apigw", icon: "services/api-gateway", label: "API\nGateway", col: 1, row: 1 },
        { id: "lrag", icon: "services/lambda", label: "Lambda\nRAG処理", col: 2, row: 1 },
        { id: "bedrock", icon: "services/bedrock", label: "Bedrock\nLLM/埋め込み", col: 3, row: 1 }
      ],
      edges: [
        { from: "users", to: "apigw", label: "質問" },
        { from: "apigw", to: "lrag" },
        { from: "lrag", to: "os", label: "類似検索" },
        { from: "lrag", to: "bedrock", label: "回答生成" },
        { from: "s3", to: "lidx", label: "文書取得" },
        { from: "lidx", to: "os", label: "索引登録" },
        { from: "lidx", to: "bedrock", label: "埋め込み生成", dashed: true }
      ]
    },
    flow: [
      "社内文書はS3に集約する。文書の追加・更新をきっかけにLambdaインデクサが起動する",
      "インデクサは文書を段落程度に分割（チャンク化）し、Bedrockの埋め込みモデルで「意味を表す数値ベクトル」に変換してOpenSearchへ登録する",
      "社員の質問はAPI Gateway経由でRAG処理のLambdaに届く",
      "Lambdaは質問も同様にベクトル化し、OpenSearchで意味が近い文書チャンクを検索する（ベクトル検索）",
      "見つかった文書チャンクを質問と一緒にBedrockのLLMへ渡し、「この資料に基づいて答えて」という形で出典付きの回答を生成させる。これがRAG（検索拡張生成）"
    ],
    services: [
      { icon: "services/bedrock", name: "Amazon Bedrock", role: "生成AIの本体。回答を作るLLMと、文書をベクトル化する埋め込みモデルの両方をAPIで提供" },
      { icon: "services/opensearch", name: "Amazon OpenSearch Service", role: "ベクトルデータベース役。意味の近い文書チャンクをk-NN検索で高速に見つける" },
      { icon: "services/lambda", name: "AWS Lambda", role: "2役。文書を取り込むインデクサと、検索＋生成をつなぐRAG処理" },
      { icon: "services/api-gateway", name: "Amazon API Gateway", role: "チャットAPIの公開口。社内認証との連携やスロットリングを担う" },
      { icon: "services/s3", name: "Amazon S3", role: "社内文書の集約置き場。RAGの知識の源泉" }
    ],
    points: [
      "RAGの品質は生成モデルの賢さより「検索で正しい文書を引けているか」で決まることが多い。チャンクの分割サイズと検索の上位何件を渡すかが最初のチューニングポイント",
      "回答には検索でヒットした文書名・リンクを必ず添える。利用者が原文を確認でき、幻覚（もっともらしい誤答）への安全弁になる",
      "Bedrockに送信したデータは基盤モデルの学習に使われない。セキュリティ部門への説明材料として公式ドキュメントを押さえておくと導入がスムーズ",
      "自前RAGは検索ロジック・プロンプト・引用形式まで自由に制御できる反面、実装量が多い。まず代替1のナレッジベースで検証し、制御が足りない部分だけ自前化する順番も有力"
    ],
    pros: [
      "検索・プロンプト・引用形式まで細かく制御でき、回答品質を追い込める",
      "BedrockのモデルはAPI切り替えだけで新しいものに乗り換えられる",
      "文書の追加・更新が自動でインデックスに反映される",
      "データがAWS内で完結し、モデル学習にも使われない"
    ],
    cons: [
      "実装・チューニングの範囲が広く、開発工数がかかる",
      "ベクトル検索用OpenSearchの常時稼働費が利用量に関係なくかかる",
      "回答品質の評価・改善サイクルまで含めると運用は軽くない"
    ],
    cost: "<strong>月3万円〜10万円程度</strong>。内訳はベクトル検索用OpenSearchの常時稼働費が月2万〜5万円で支配的、Bedrockは従量課金で1日数百質問の社内利用なら月数千円〜数万円、Lambda・API Gatewayは少額。誰も使わない月でもOpenSearch費用だけは発生する点が最大の固定費。",
    references: [
      { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" },
      { title: "OpenSearch Serviceのk-NN（ベクトル）検索", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/knn.html", note: "ベクトル検索の仕組み" },
      { title: "OpenSearch Serverlessのベクトル検索コレクション", url: "https://docs.aws.amazon.com/ja_jp/opensearch-service/latest/developerguide/serverless-vector-search.html" },
      { title: "Amazon Bedrockのデータ保護", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/data-protection.html", note: "入力データが学習に使われないことの根拠" },
      { title: "Amazon API Gatewayとは", url: "https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/welcome.html" }
    ]
  },
  alternatives: [
    {
      name: "Bedrockナレッジベース（マネージド一体型）",
      when: "RAGの内部実装に工数をかけず、最短で社内展開したい場合",
      diagram: {
        cols: 5, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [4, 0] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "社員", col: 0, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API\nGateway", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\n薄いAPI層", col: 2, row: 0 },
          { id: "kb", icon: "services/bedrock", label: "Bedrock\nナレッジベース", col: 3, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\n社内文書", col: 4, row: 0 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "質問" },
          { from: "apigw", to: "fn" },
          { from: "fn", to: "kb", label: "検索と回答生成" },
          { from: "s3", to: "kb", label: "自動同期" }
        ]
      },
      flow: [
        "S3をデータソースとして登録すると、ナレッジベースがチャンク分割・ベクトル化・ベクトルDBへの登録まで自動で行う",
        "アプリはRetrieveAndGenerate APIを1回呼ぶだけで、検索＋回答生成＋出典付与までまとめて返ってくる",
        "文書の同期はマネージドで、手動実行または定期実行を設定できる"
      ],
      services: [
        { icon: "services/bedrock", name: "Amazon Bedrock ナレッジベース", role: "RAGの検索・生成・出典付与を一体で提供するマネージド機能。ベクトルDBの面倒も見る" },
        { icon: "services/s3", name: "Amazon S3", role: "社内文書の置き場。ナレッジベースのデータソースとして登録する" },
        { icon: "services/lambda", name: "AWS Lambda", role: "認証や履歴保存などアプリ都合の処理を挟む薄いAPI層" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "チャットAPIの公開口" }
      ],
      points: [
        "自前構成でLambdaに書いていた検索・プロンプト組み立て・引用整形がAPI一発になる。RAGの仕組みを学びながら最短で動くものを出せる",
        "チャンク分割の方式や検索件数は設定で調整できるが、細部の自由度は自前構成に劣る。物足りなくなった部分だけ自前実装へ段階的に移行できる",
        "裏側でベクトルDB（OpenSearch Serverless等）が動くため、その費用は自前構成と同様にかかる。「マネージド＝安い」ではない点に注意"
      ],
      pros: [
        "実装量が圧倒的に少なく、出典表示も標準機能",
        "チャンク化・ベクトルDB・同期の設計運用をAWSに任せられる"
      ],
      cons: [
        "検索ロジックやプロンプトの細かい制御に限界がある",
        "裏側のベクトルDB費用は自前構成同様にかかる"
      ],
      cost: "<strong>月2万円〜8万円程度</strong>（裏側のベクトルDB費用＋Bedrockの従量課金）。構築工数は大きく減るが、月額の費用構造は自前RAGと大きくは変わらない。",
      references: [
        { title: "Amazon Bedrockナレッジベース", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/knowledge-base.html" },
        { title: "Amazon Bedrockとは", url: "https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/what-is-bedrock.html" }
      ]
    },
    {
      name: "SageMakerで独自モデル運用",
      when: "自社データでのファインチューニングや、Bedrockにない独自モデルの利用が必須の場合",
      diagram: {
        cols: 5, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "社員", col: 0, row: 0 },
          { id: "apigw", icon: "services/api-gateway", label: "API\nGateway", col: 1, row: 0 },
          { id: "fn", icon: "services/lambda", label: "Lambda\nAPI層", col: 2, row: 0 },
          { id: "sm", icon: "services/sagemaker", label: "SageMaker\n推論エンドポイント", col: 3, row: 0 },
          { id: "s3", icon: "services/s3", label: "S3\nモデル/文書", col: 3, row: 1 }
        ],
        edges: [
          { from: "users", to: "apigw", label: "質問" },
          { from: "apigw", to: "fn" },
          { from: "fn", to: "sm", label: "推論リクエスト" },
          { from: "s3", to: "sm", label: "モデルデプロイ", dashed: true }
        ]
      },
      flow: [
        "オープンソースLLMや自社でファインチューニングしたモデルをS3に置き、SageMakerの推論エンドポイント（モデルを常時ホストするAPI）としてデプロイする",
        "質問はAPI Gateway→Lambda経由でエンドポイントに送られ、独自モデルが回答を生成する",
        "RAGにするなら検索部分（ベクトルDBと検索処理）は推奨構成と同様に別途組み合わせる"
      ],
      services: [
        { icon: "services/sagemaker", name: "Amazon SageMaker", role: "独自モデルの学習・デプロイ・推論を担うML基盤。モデルの中身まで自社管理できる" },
        { icon: "services/s3", name: "Amazon S3", role: "モデルの重みファイルと学習データの置き場" },
        { icon: "services/lambda", name: "AWS Lambda", role: "リクエスト整形とエンドポイント呼び出しのAPI層" },
        { icon: "services/api-gateway", name: "Amazon API Gateway", role: "チャットAPIの公開口" }
      ],
      points: [
        "モデルの重みまで自社管理したい規制要件や、Bedrock未対応モデルの利用が必須のときに選ぶ択。逆に言えば、それ以外でこの案を選ぶ理由は薄い",
        "推論エンドポイントはGPUインスタンスの常時起動になりやすく、3案で最も高額。呼び出しが散発的ならサーバーレス推論やオートスケールで抑える",
        "モデルの更新・脆弱性対応・品質評価まで自社責任になる。MLエンジニアの継続的な工数を前提に計画する"
      ],
      pros: [
        "モデルを完全にコントロールできる（チューニング・バージョン固定・独自モデル）",
        "推論もデータもすべて自社のAWSアカウント内で完結する"
      ],
      cons: [
        "GPUの常時起動で高額になりやすい",
        "MLOps（モデルの継続的な運用改善）の専門知識と体制が必須"
      ],
      cost: "<strong>月10万円〜数十万円</strong>（GPU推論用ml.g5.xlarge1台の常時起動で月15万円前後が目安）。モデル運用の人件費も含めると3案で最も重く、要件が明確な場合以外は選ばない。",
      references: [
        { title: "Amazon SageMakerとは", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/whatis.html" },
        { title: "SageMakerでの推論用モデルのデプロイ", url: "https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/deploy-model.html" }
      ]
    }
  ],
  cost: "<p>自前RAG構成は<strong>月3万円〜10万円程度</strong>、ナレッジベース案は<strong>月2万円〜8万円程度</strong>で、いずれもベクトルDBの常時稼働費が支配的。SageMaker案は<strong>月10万円〜数十万円</strong>とGPU費用で跳ね上がる。生成AI部分（Bedrock）は従量課金なので、コスト設計の主戦場は「ベクトルDBを何にするか」と「独自モデルが本当に必要か」の2点になる。</p>",
  summary: "<p>RAGは「LLMに社内文書をあらかじめ検索して渡す」ことで、一般知識しか知らないモデルに自社の事情を答えさせる技術です。構成選びの本質は<strong>「どこまで自分で制御したいか」</strong>で、まずナレッジベース（マネージド）で価値を検証し、検索精度やプロンプトを追い込みたくなったら自前RAGへ、モデル自体を変えたい特殊要件が出たらSageMakerへ、と段階的に深くしていくのが失敗しにくい進め方です。どの案でも「出典を必ず示す」「検索品質から改善する」というRAG運用の原則は共通です。</p>"
});
