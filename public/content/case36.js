// ケース36：社外とのファイル転送基盤
registerCase({
  id: 36,
  category: "社内・閉域・ハイブリッド",
  title: "社外とのファイル転送基盤",
  scenario: "<p>取引先数十社と日次でCSVファイルをやり取りしている。現在はオンプレのSFTPサーバーで受けているが、ハードウェアの保守切れが近い。取引先側のシステムや手順は変更をお願いできないため、SFTPでの接続方法はそのまま維持しつつ、自社側のサーバーだけをなくしたい。受信したファイルの後続処理（形式チェックと業務システムへの取り込み）も自動化したい。</p>",
  requirements: [
    "取引先が既存のSFTPクライアントと手順をそのまま使えること",
    "ファイル転送サーバーの保守・運用をなくすこと",
    "受信後の処理（チェック・取り込み）を自動で起動すること",
    "誰がいつ何を送受信したかの記録が残ること",
    "通信と保存の両方で暗号化されること"
  ],
  main: {
    name: "Transfer Family（SFTP）+S3+EventBridge+Lambda",
    diagram: {
      cols: 6, rows: 1,
      groups: [
        { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [5, 0] }
      ],
      nodes: [
        { id: "client", icon: "resources/client", label: "取引先\nシステム", col: 0, row: 0 },
        { id: "transfer", icon: "services/transfer-family", label: "Transfer Family\nSFTP", col: 2, row: 0 },
        { id: "s3", icon: "services/s3", label: "S3\n受信バケット", col: 3, row: 0 },
        { id: "eb", icon: "services/eventbridge", label: "EventBridge", col: 4, row: 0 },
        { id: "lambda", icon: "services/lambda", label: "Lambda\n後処理", col: 5, row: 0 }
      ],
      edges: [
        { from: "client", to: "transfer", label: "SFTP" },
        { from: "transfer", to: "s3", label: "S3に直接保存" },
        { from: "s3", to: "eb", label: "作成イベント" },
        { from: "eb", to: "lambda", label: "ルールで起動" }
      ]
    },
    flow: [
      "取引先は従来と同じSFTPクライアント・鍵・手順でTransfer Familyのエンドポイントに接続する",
      "受信したファイルはサーバーのディスクではなく、S3バケットに直接保存される",
      "S3のオブジェクト作成イベントがEventBridgeへ送られる",
      "EventBridgeのルールがLambdaを起動し、形式チェックや業務システムへの取り込みなどの後処理を自動実行する"
    ],
    services: [
      { icon: "services/transfer-family", name: "AWS Transfer Family", role: "SFTP/FTPS/AS2のマネージドサービス。サーバーなしでSFTPエンドポイントを提供し、保存先をS3にできる" },
      { icon: "services/s3", name: "Amazon S3", role: "受信ファイルの保存先。保存時の暗号化とライフサイクル管理を標準機能でまかなえる" },
      { icon: "services/eventbridge", name: "Amazon EventBridge", role: "ファイル到着イベントの振り分け役。ルールを足すだけで後処理の宛先を増やせる" },
      { icon: "services/lambda", name: "AWS Lambda", role: "受信後の形式チェック・取り込み処理を実行するサーバーレス実行環境" }
    ],
    points: [
      "Transfer Familyは「相手の手順を変えられない」という制約を守ったままサーバーレス化できるのが最大の価値。取引先から見れば接続先ホスト名が変わるだけ",
      "認証は取引先の既存SSH公開鍵をそのまま登録できる。Active Directoryやカスタム認証（Lambda連携）への差し替えも可能",
      "後処理の起動をS3イベント→EventBridge経由にしておくと、通知やSQS（処理の待ち行列）など宛先の追加がルール1本で済み、受信量が増えても拡張しやすい",
      "エンドポイントは起動している時間だけで月3万円強かかる。相手が少ないなら代替1（署名付きURL）のほうが二桁安いため、まず相手の数と頻度で判断する"
    ],
    pros: [
      "取引先への影響ゼロでサーバーを廃止できる",
      "OS・ミドルウェアの保守が消え、転送ログもCloudWatchに残って監査対応しやすい",
      "後続処理までイベント駆動で自動化できる"
    ],
    cons: [
      "エンドポイントの固定費が高め（使わない時間帯も課金される）",
      "既存SFTPサーバーの細かい独自設定までは再現できないことがある"
    ],
    cost: "<strong>月3.5万円程度〜</strong>（SFTPエンドポイント約0.30USD/時=月約3.3万円+転送量0.04USD/GB+S3保管料。転送が少なくてもエンドポイント費用は固定でかかる）",
    references: [
      { title: "AWS Transfer Familyとは", url: "https://docs.aws.amazon.com/ja_jp/transfer/latest/userguide/what-is-aws-transfer-family.html", note: "Transfer Family公式ユーザーガイド" },
      { title: "SFTP対応サーバーの作成", url: "https://docs.aws.amazon.com/ja_jp/transfer/latest/userguide/create-server-sftp.html" },
      { title: "Amazon EventBridgeを使用したS3イベント通知", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/EventBridge.html", note: "受信後の後処理起動の仕組み" },
      { title: "AWS Transfer Familyの料金", url: "https://aws.amazon.com/jp/aws-transfer-family/pricing/" }
    ]
  },
  alternatives: [
    {
      name: "S3署名付きURLの直共有（手軽・低コスト）",
      when: "相手が少ない・不定期で、SFTPではなくブラウザやHTTPSでの受け渡しに変更してもらえる場合",
      diagram: {
        cols: 4, rows: 2,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [2, 0], to: [3, 1] }
        ],
        nodes: [
          { id: "client", icon: "resources/client", label: "取引先", col: 0, row: 0 },
          { id: "users", icon: "resources/user", label: "社内担当者", col: 0, row: 1 },
          { id: "lambda", icon: "services/lambda", label: "Lambda\nURL発行API", col: 2, row: 1 },
          { id: "s3", icon: "services/s3", label: "S3\n共有バケット", col: 3, row: 0 }
        ],
        edges: [
          { from: "users", to: "lambda", label: "URL発行を依頼" },
          { from: "lambda", to: "s3", label: "署名付きURLを生成", dashed: true },
          { from: "client", to: "s3", label: "期限付きURLで送受信" }
        ]
      },
      flow: [
        "社内担当者がLambda（URL発行API）を呼び出すと、S3への期限付きアップロード/ダウンロードURL（署名付きURL）が返る",
        "担当者はそのURLをメールなどで取引先に伝える",
        "取引先はURLに対してHTTPSでファイルを直接送受信する。期限が過ぎたURLは自動で無効になる"
      ],
      services: [
        { icon: "services/s3", name: "Amazon S3", role: "ファイルの受け渡し場所。署名付きURLで特定オブジェクトへの期限付きアクセスを許可する" },
        { icon: "services/lambda", name: "AWS Lambda", role: "署名付きURLを生成して返す小さなAPI。発行履歴を残せば監査にも使える" }
      ],
      points: [
        "署名付きURLは「S3の特定ファイルに対する、期限付きの操作権限を埋め込んだURL」。AWSアカウントを持たない相手とファイルをやり取りする最も手軽な方法",
        "固定費がほぼゼロで、Transfer Familyの月3万円強と比べて二桁安い。相手が数社・月数回程度ならこちらで十分なことが多い",
        "URLを知っていれば誰でも期限内はアクセスできるため、有効期限は必要最小限にし、メール誤送信時の失効手順（URL再発行・オブジェクト削除）も決めておく"
      ],
      pros: [
        "固定費がほぼゼロで、構築も簡単",
        "取引先はブラウザやcurlだけでよく、専用ソフトが不要"
      ],
      cons: [
        "取引先に手順変更をお願いする必要がある（SFTPは使えない）",
        "URLの取り扱いを誤ると期限内は第三者もアクセスできてしまう",
        "数十社との大量・定期運用には管理が煩雑で向かない"
      ],
      cost: "<strong>月数十円〜数百円</strong>（S3保管料+転送量+Lambda実行費のみ。固定費なし）",
      references: [
        { title: "署名付きURLの使用", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/using-presigned-url.html", note: "S3公式ユーザーガイド" },
        { title: "署名付きURLによるオブジェクトの共有", url: "https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html" }
      ]
    },
    {
      name: "EFS共有ストレージ（社内アプリ間の共有が本題の場合）",
      when: "要件を掘り下げると社外との転送ではなく、社内の複数サーバー間でファイルを共有したいのが本題だった場合",
      diagram: {
        cols: 6, rows: 1,
        groups: [
          { type: "aws-cloud", label: "AWS Cloud", from: [1, 0], to: [5, 0] },
          { type: "vpc", label: "VPC", from: [2, 0], to: [5, 0], depth: 1 },
          { type: "private-subnet", label: "プライベートサブネット", from: [3, 0], to: [5, 0], depth: 2 }
        ],
        nodes: [
          { id: "users", icon: "resources/users", label: "社員", col: 0, row: 0 },
          { id: "ec2a", icon: "services/ec2", label: "EC2\n業務アプリA", col: 3, row: 0 },
          { id: "efs", icon: "services/efs", label: "EFS\n共有ストレージ", col: 4, row: 0 },
          { id: "ec2b", icon: "services/ec2", label: "EC2\n業務アプリB", col: 5, row: 0 }
        ],
        edges: [
          { from: "users", to: "ec2a", label: "社内から利用", dashed: true },
          { from: "ec2a", to: "efs", label: "NFSマウント" },
          { from: "ec2b", to: "efs", label: "NFSマウント" }
        ]
      },
      flow: [
        "VPC内にEFS（複数サーバーから同時にマウントできる共有ファイルシステム）を作成する",
        "業務アプリA・BのEC2が同じEFSをNFS（ネットワーク越しにディスクのように使うプロトコル）でマウントし、同じファイルを読み書きする",
        "社員は社内ネットワーク経由（ケース32の閉域接続）で各アプリを利用する"
      ],
      services: [
        { icon: "services/efs", name: "Amazon EFS", role: "NFSで複数サーバーから同時マウントできる共有ファイルシステム。容量は自動で伸縮する" },
        { icon: "services/ec2", name: "Amazon EC2", role: "EFSを共有ディスクとして使う業務アプリのサーバー" }
      ],
      points: [
        "「ファイル転送基盤が欲しい」という要望の裏に「複数サーバーでファイルを共有したいだけ」が隠れていることは実務でよくある。要件の聞き分けひとつで構成が丸ごと変わる例",
        "EFSは容量の事前確保が不要で使った分だけの課金。複数のAZ（データセンター群）にマウントターゲットを置けば可用性も確保できる",
        "社外との受け渡しが少しでも残るならS3を核にした構成のほうがよい。署名付きURL（代替1）やTransfer Family（推奨構成）へそのまま発展できる"
      ],
      pros: [
        "複数サーバーから同じファイルを同時に読み書きできる",
        "容量管理・拡張作業が不要"
      ],
      cons: [
        "VPC内での利用が前提で、社外とのファイル転送には使えない",
        "S3と比べてGB単価が高い"
      ],
      cost: "<strong>月数千円+EC2費用</strong>（EFS標準ストレージ約0.36USD/GB-月。100GBで月約5,400円。アクセス頻度の低いファイルはIAストレージクラスへ自動移動で削減可）",
      references: [
        { title: "Amazon EFSとは", url: "https://docs.aws.amazon.com/ja_jp/efs/latest/ug/whatisefs.html", note: "EFS公式ユーザーガイド" },
        { title: "EFSファイルシステムのマウント", url: "https://docs.aws.amazon.com/ja_jp/efs/latest/ug/mounting-fs.html" },
        { title: "Amazon EFSの料金", url: "https://aws.amazon.com/jp/efs/pricing/" }
      ]
    }
  ],
  cost: "<p>推奨構成（Transfer Family）は<strong>月3.5万円程度〜</strong>で、エンドポイントの固定費が大半を占める。署名付きURL案は<strong>月数十円〜数百円</strong>と圧倒的に安いが、相手に手順変更を求める。EFS案は<strong>月数千円+EC2費用</strong>で、そもそも解決する課題（社内共有）が異なる。</p>",
  summary: "<p>ファイル転送基盤の選定は<strong>「相手の手順を変えられるか」がすべての分かれ道</strong>です。変えられないならTransfer Familyの固定費は「取引先調整コストを買っている」と考えると納得しやすく、変えられるなら署名付きURLで二桁安くなります。もうひとつの落とし穴は要件の取り違えで、「転送基盤」の相談が実は社内サーバー間の共有（EFSで解決）だったというケースは実務で頻出します。誰と・どの頻度で・どちら向きにファイルが動くのかを最初に確認しましょう。</p>",
  quiz: [
    {
      q: "Transfer Familyはエンドポイントの固定費だけで月3万円強かかります。それでも推奨構成に選ばれているのはなぜでしょうか。",
      a: "このケースの最大の制約が「取引先のシステムと手順を変更してもらえない」ことだからです。取引先から見れば接続先ホスト名が変わるだけで、SFTPクライアントも鍵も手順もそのまま使え、自社側だけサーバーを廃止できます。固定費は数十社への調整コストを買っていると考えると納得しやすく、逆に相手が数社で手順変更を頼めるなら署名付きURLで二桁安くなります。金額だけでなく、その費用で何を買っているのかで比べるのが判断の筋道です。"
    },
    {
      q: "「ファイル転送基盤が欲しい」と相談されたとき、設計に入る前に何を確認すべきでしょうか。あなたならどう聞き出しますか。",
      a: "誰と・どの頻度で・どちら向きにファイルが動くのかを最初に確認します。相手が社外か社内かで構成は丸ごと変わり、実は社内の複数サーバーで同じファイルを共有したいだけだった場合はEFS（代替2）が答えになるためです。社外が相手でも、手順変更を頼めるなら署名付きURL、頼めないならTransfer Familyという分岐になります。要件の取り違えは実務で頻出するので、言葉をそのまま受け取らず実際のファイルの流れを描いてもらうのが有効です。"
    },
    {
      q: "受信後の処理をS3イベントから直接Lambdaに渡さず、あいだにEventBridgeを挟んでいるのはなぜでしょうか。",
      a: "後続処理の宛先を増やしやすくするためです。EventBridgeはイベントの振り分け役なので、担当者への通知を足したい・SQSに積んで別システムへ渡したいといった要望が出ても、ルールを1本追加するだけで済み、既存のLambdaに手を入れずに拡張できます。取引先や処理の種類が増えるほどこの差が効いてきます。処理が1つしかないうちはS3イベントの直接連携でも動きますが、増える前提なら最初から挟んでおく設計です。"
    }
  ]
});
