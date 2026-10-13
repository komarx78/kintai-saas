<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="滋賀・京都で経営改善なら株式会社KAP。上場企業水準の経営企画力と伴走型の実行力で、企業の成長を『仕組み化』します。中小企業のAI活用（Gemini）による業務改善、資金調達（事業計画書・銀行折衝）を強力にサポート。">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
    <!-- ヘッダー -->
    <header class="header" id="header">
        <div class="header-inner">
            <div class="logo">
                <a href="#"><img src="<?php echo get_template_directory_uri(); ?>/kap_logo.png" alt="株式会社KAP" style="max-height: 70px; display: block;"></a>
            </div>
            <nav class="nav">
                <ul>
                    <li><a href="#philosophy">経営理念</a></li>
                    <li><a href="#service-price">サービス・料金</a></li>
                    <li><a href="https://kap-cocotte.com/rakumaru/" style="color: #2563eb; font-weight: 700;">らくまる労務</a></li>
                    <li><a href="#works">実績</a></li>
                    <li><a href="#about">会社概要</a></li>
                    <li><a href="#credo">行動指針</a></li>
                    <li><a href="#note">記事</a></li>
                    <li><a href="#contact" class="btn-contact">お問い合わせ</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <!-- ヒーローセクション -->
    <section class="hero" style="background-image: url('<?php echo get_template_directory_uri(); ?>/hero_bg.png'); background-size: cover; background-position: center;">
        <div class="hero-bg-overlay"></div>
        <div class="hero-content fade-in-up">
            <p class="hero-subtitle">KAP Inc. | Management & Operation Consulting</p>
            <h1 class="hero-title">企業の真の課題に寄り添い、<br>成長を<span class="highlight">「仕組み化」</span>する</h1>
            <p class="hero-description">上場企業水準の経営企画力とベンチャー企業の実行力を掛け合わせ、<br>御社に最適な業務プロセスを構築・定着させます。</p>
            <a href="#service-price" class="btn-primary btn-pulse">サービスを見る</a>
        </div>
    </section>

    <!-- Philosophyセクション（経営理念） -->
    <section id="philosophy" class="section philosophy-section">
        <div class="container">
            <div class="philosophy-intro fade-in">
                <h2 class="philosophy-catch">「おせっかいと言われても、私たちは目の前の人を放っておきません。」</h2>
            </div>
            
            <div class="philosophy-core fade-in">
                <p class="philosophy-label">経営理念</p>
                <h3 class="core-title">誠実と信頼</h3>
                <div class="core-message philosophy-large">
                    <p>私たちの真ん中には、いつも「誠実と信頼」があります。</p>
                    <p>困っている人がいたら放っておかない。おせっかいと言われるくらい、目の前の人に全力で寄り添う。それが私たちの誠実さです。</p>
                    <p>その積み重ねの先にしか、本当の信頼関係はありません。関わるすべての人と固い絆で結ばれ、ともに支え合いながら成長していく企業を目指します。</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Strengthsセクション（選ばれる理由） -->
    <section id="strengths" class="section strengths-section">
        <div class="container">
            <h2 class="section-title fade-in">なぜKAPが選ばれるのか</h2>
            <p class="section-subtitle fade-in">Our Strengths</p>
            <div class="strengths-grid">
                <div class="strength-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/icon_strength_strategy.png" alt="経営企画力" class="strength-icon-img">
                    <div class="strength-icon">01</div>
                    <h3 class="strength-title">上場企業水準の経営企画力</h3>
                    <p class="strength-desc">机上の空論ではなく、データと実績に裏付けられた確かな戦略を策定。企業成長のボトルネックを的確に見抜きます。</p>
                </div>
                <div class="strength-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/icon_strength_execution.png" alt="泥臭い実行力" class="strength-icon-img">
                    <div class="strength-icon">02</div>
                    <h3 class="strength-title">現場に入り込む泥臭い実行力</h3>
                    <p class="strength-desc">戦略を描くだけでなく、現場スタッフの声に耳を傾け、誰もが実行できる「仕組み」として定着するまで伴走します。</p>
                </div>
                <div class="strength-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/icon_strength_finance.png" alt="太いパイプ" class="strength-icon-img">
                    <div class="strength-icon">03</div>
                    <h3 class="strength-title">地域金融機関との太いパイプ</h3>
                    <p class="strength-desc">滋賀・京都エリアの金融機関の動向を熟知。事業計画書の作成から折衝まで、攻めの資金調達を強力にサポートします。</p>
                </div>
            </div>
        </div>
    </section>

    <!-- サービス・料金統合セクション -->
    <section id="service-price" class="section service-price-section">
        <div class="container">
            <h2 class="section-title fade-in">サービス内容と料金体系</h2>
            <p class="section-subtitle fade-in">Services & Pricing</p>
            <div class="sp-grid">
                
                <!-- サービス1 -->
                <div class="sp-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/icon_ai.png" alt="AI業務改善" class="sp-icon">
                    <div class="sp-header">
                        <h3 class="sp-title">AIを活用した<br>業務改善コンサルティング</h3>
                        <div class="sp-price">Price: <span>月額5万円～</span></div>
                    </div>
                    <div class="sp-body">
                        <p class="sp-description">Google Workspaceと最強のAI「Gemini」をフル活用し、ルーティン業務の自動化や社内ナレッジの共有を高度化。Googleの最新テクノロジーを味方につけ、人手不足を解消し、社員がコア業務に集中できる革新的な環境を構築します。</p>
                        <ul class="sp-features">
                            <li>Google Workspaceとの高度な連携による業務フロー最適化</li>
                            <li>AI「Gemini」の社内研修・現場への定着化支援</li>
                            <li>Googleエコシステムを活用した社内データの統合・活用</li>
                        </ul>
                    </div>
                </div>

                <!-- サービス2 -->
                <div class="sp-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/icon_finance.png" alt="資金調達" class="sp-icon">
                    <div class="sp-header">
                        <h3 class="sp-title">経営・資金調達<br>コンサルティング</h3>
                        <div class="sp-price">Price: <span>月額5万円～</span></div>
                    </div>
                    <div class="sp-body">
                        <p class="sp-description">滋賀・京都の地域金融機関の動向を熟知した強みを活かし、中小零細企業・個人事業主様の資金繰りを改善。成長のための「攻めの資金調達」をサポートします。</p>
                        <ul class="sp-features">
                            <li>融資確率を高める事業計画書の作成支援</li>
                            <li>金融機関との面談同行・折衝サポート</li>
                            <li>キャッシュフローの見える化と財務体質改善</li>
                        </ul>
                    </div>
                </div>

                <!-- サービス3 -->
                <div class="sp-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/icon_consulting.png" alt="外部参謀" class="sp-icon">
                    <div class="sp-header">
                        <h3 class="sp-title">伴走型「外部参謀」<br>顧問サービス</h3>
                        <div class="sp-price">Price: <span>月額10万円～</span></div>
                    </div>
                    <div class="sp-body">
                        <p class="sp-description">孤独になりがちな経営者の右腕として、壁打ち相手から実行支援までフルコミット。業績や規模に応じた相談しやすい料金体系で、二人三脚で事業を盛り上げます。</p>
                        <ul class="sp-features">
                            <li>月次ミーティングによる経営課題の共有と解決</li>
                            <li>役員・幹部候補の育成サポート</li>
                            <li>コンサルタントフィーの柔軟な設定</li>
                        </ul>
                    </div>
                </div>

                <!-- サービス4：自社開発クラウドシステム（みんなのらくまる労務） -->
                <div class="sp-card fade-in" style="border: 2px solid #2563eb; position: relative; background: #ffffff;">
                    <div style="position: absolute; top: -13px; right: 20px; background: linear-gradient(135deg, #2563eb, #06C755); color: #ffffff; font-size: 11px; font-weight: 900; padding: 4px 14px; border-radius: 20px; box-shadow: 0 4px 10px rgba(37,99,235,0.3); letter-spacing: 0.05em;">
                        自社開発・新登場
                    </div>
                    <div class="sp-icon" style="font-size: 28px; display: flex; align-items: center; justify-content: center; width: 60px; height: 60px; background: #eff6ff; border-radius: 16px; border: 1px solid #bfdbfe;">
                        📱
                    </div>
                    <div class="sp-header">
                        <h3 class="sp-title">次世代 人事労務クラウド<br><span style="color: #2563eb; font-weight: 900;">みんなの らくまる労務</span></h3>
                        <div class="sp-price">Price: <span style="color: #2563eb; font-weight: 900;">1人月額300円</span> <small style="font-size: 11px; color: #64748b; font-weight: bold;">(初期0円・縛りなし)</small></div>
                    </div>
                    <div class="sp-body">
                        <p class="sp-description">「もう現場スタッフにアプリを入れさせない！」公式LINE友だち追加だけで即日稼働する、中小企業・店舗応援モデルの人事労務DXクラウド。タイムカード打刻・シフト回収・給与一括計算・Web明細配信から、ハローワーク離職票のA4原本印字まで全部これ1つで完結します。</p>
                        <ul class="sp-features">
                            <li><strong>公式LINE連携</strong>でシフト希望回収・確定シフト配信・Web給与明細通知</li>
                            <li>打刻から<strong>給与一括自動計算</strong>＆ネットバンキング振込CSV出力</li>
                            <li>離職票・扶養控除申告書を<strong>公的A4原本へ1ミリの狂いもなく直接印字</strong></li>
                            <li>24時間AIサポート＆有給休暇法定自動付与完備</li>
                        </ul>
                        <div style="margin-top: 24px;">
                            <a href="https://kap-cocotte.com/rakumaru/" style="display: block; width: 100%; padding: 13px 20px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; font-weight: 900; font-size: 14px; text-decoration: none; border-radius: 12px; text-align: center; box-shadow: 0 4px 14px rgba(37,99,235,0.3); transition: all 0.3s;">
                                サービス詳細・14日間無料体験を見る ➔
                            </a>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </section>

    <!-- Worksセクション（実績） -->
    <section id="works" class="section works-section">
        <div class="container">
            <h2 class="section-title fade-in">コンサルティング実績</h2>
            <p class="section-subtitle fade-in">Works</p>
            <div class="works-grid">
                <!-- 実績1 -->
                <div class="work-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/work_realestate.png" alt="不動産業様の実績" class="work-image">
                    <div class="work-content">
                        <span class="work-category">不動産業様</span>
                        <h3>全社業務フローの再構築とマニュアル化</h3>
                        <p><strong>課題：</strong>属人化による新人教育コストの増加とヒューマンエラーの多発。</p>
                        <p><strong>解決策：</strong>Geminiを活用したマニュアル作成の自動化と、業務フローの可視化・標準化を支援。</p>
                        <p><strong>結果：</strong>教育コストを50%削減し、社員がコア業務に集中できる体制を構築。</p>
                    </div>
                </div>
                <!-- 実績2 -->
                <div class="work-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/work_finance.png" alt="資金調達・製造業様の実績" class="work-image">
                    <div class="work-content">
                        <span class="work-category">製造業様</span>
                        <h3>中期経営計画の策定と資金調達支援</h3>
                        <p><strong>課題：</strong>設備投資のための資金繰りと、現場と経営層の認識のズレ。</p>
                        <p><strong>解決策：</strong>地域金融機関の動向を踏まえた精緻な事業計画書の作成と、現場へのヒアリング・落とし込み。</p>
                        <p><strong>結果：</strong>無事に希望額の融資を獲得し、組織全体が同じ方向を向いて推進する体制を構築。</p>
                    </div>
                </div>
                <!-- 実績3 -->
                <div class="work-card fade-in">
                    <img src="<?php echo get_template_directory_uri(); ?>/work_consulting.png" alt="外部参謀・サービス業様の実績" class="work-image">
                    <div class="work-content">
                        <span class="work-category">サービス業様</span>
                        <h3>伴走型での新規事業立ち上げ支援</h3>
                        <p><strong>課題：</strong>新しい事業アイデアはあるものの、実行フェーズを牽引できる人材が不足。</p>
                        <p><strong>解決策：</strong>外部参謀として参画し、月次ミーティングの実施とKPI管理システムを導入。</p>
                        <p><strong>結果：</strong>プロジェクトが加速し、予定より2ヶ月早く新規サービスのローンチを実現。</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Aboutセクション（会社概要・代表挨拶） -->
    <section id="about" class="section about-section">
        <div class="container">
            <h2 class="section-title fade-in">会社概要・代表挨拶</h2>
            <p class="section-subtitle fade-in">Who We Are</p>
            
            <div class="about-company fade-in">
                <p class="lead-text">株式会社KAPは、単なるアドバイスにとどまらず、現場の業務プロセスに入り込み、実行可能なシステムとして定着させる伴走型のコンサルティングを提供します。</p>
            </div>

            <div class="about-grid no-image">
                <div class="about-text fade-in">
                    <h3 class="center-title">代表者ご挨拶</h3>
                    <p>はじめまして、株式会社KAP 代表取締役の駒井 秀一朗と申します。</p>
                    <p>これまでの上場企業での経営企画経験と、ベンチャー企業での副社長としての実務経験を通じ、企業が成長の壁に直面する根本的な原因の多くは「経営の方向性と現場の仕組みのズレ」にあると痛感してまいりました。</p>
                    <p>私たちは、机上の空論ではない「生きた戦略」を策定し、それを誰もが実行可能な「仕組み」へと落とし込むことに情熱を注いでいます。</p>
                    <p>経営トップとの対話はもちろんのこと、現場スタッフの声にも真摯に耳を傾け、組織全体が同じ方向を向いて力強く進めるよう、全力で伴走支援いたします。御社の成長の起爆剤となる「仕組み化」を、ぜひ私たちにお任せください。</p>
                    <div class="ceo-signature">
                        <strong>代表取締役　駒井 秀一朗</strong><br>
                        <span class="ceo-link">※私の「ほっとけない性格」から生まれた行動指針は、下の <a href="#credo">行動指針（Credo）</a> をご覧ください。</span>
                    </div>
                </div>
            </div>

            <!-- 会社概要（Company Profile） -->
            <div class="company-profile fade-in">
                <h3 class="profile-title">Company Profile</h3>
                <table class="profile-table">
                    <tbody>
                        <tr>
                            <th>会社名</th>
                            <td>株式会社KAP</td>
                        </tr>
                        <tr>
                            <th>代表取締役</th>
                            <td>駒井 秀一朗</td>
                        </tr>
                        <tr>
                            <th>所在地</th>
                            <td>〒520-0113<br>滋賀県大津市坂本3丁目21-16</td>
                        </tr>
                        <tr>
                            <th>TEL</th>
                            <td>077-572-6617</td>
                        </tr>
                        <tr>
                            <th>創業 / 設立</th>
                            <td>創業：平成28年2月<br>設立：令和6年11月</td>
                        </tr>
                        <tr>
                            <th>事業内容</th>
                            <td>・AI活用・業務改善コンサルティング<br>・経営コンサルティング業<br>・資金調達支援</td>
                        </tr>
                        <tr>
                            <th>主要取引銀行</th>
                            <td>京都信用金庫 西大津支店<br>京都中央信用金庫 堅田支店</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </div>
    </section>

    <!-- Credoセクション（行動指針10箇条） -->
    <section id="credo" class="section credo-section">
        <div class="container">
            <h2 class="section-title fade-in">私たちの行動指針</h2>
            <p class="section-subtitle fade-in">Our Credo</p>
            <div class="credo-grid">
                <!-- クレド1 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">01</span>
                        <h3 class="credo-keyword">感謝</h3>
                    </div>
                    <div class="credo-body">
                        <h4>「ありがとう」を言葉と態度で、1.5倍にして返します</h4>
                        <p>お客様、社員とその家族、お取引先様など、すべての繋がりを大切にします。</p>
                    </div>
                </div>
                <!-- クレド2 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">02</span>
                        <h3 class="credo-keyword">貢献</h3>
                    </div>
                    <div class="credo-body">
                        <h4>お客様からも仲間からも、「あなたに会えてよかった」と言われる人になります</h4>
                        <p>日々の誠実な行動を通じて、心からの信頼を積み重ねます。</p>
                    </div>
                </div>
                <!-- クレド3 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">03</span>
                        <h3 class="credo-keyword">約束</h3>
                    </div>
                    <div class="credo-body">
                        <h4>どんなに小さな約束も、大切な人との約束として守り抜きます</h4>
                        <p>最後まで責任を持ってやり遂げることが、私たちのプロとしての誇りです。</p>
                    </div>
                </div>
                <!-- クレド4 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">04</span>
                        <h3 class="credo-keyword">信頼</h3>
                    </div>
                    <div class="credo-body">
                        <h4>仲間を信じ、困ったときは「お互い様」で全力で支え合います</h4>
                        <p>お互いの個性を認め合い、最高の一体感を持ったチームをつくります。</p>
                    </div>
                </div>
                <!-- クレド5 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">05</span>
                        <h3 class="credo-keyword">正直</h3>
                    </div>
                    <div class="credo-body">
                        <h4>いつでも正直に、誰に対しても胸を張れる真っ直ぐな行動を選びます</h4>
                        <p>いかなる時も自分に嘘をつかず、正しさと透明性を持って仕事に臨みます。</p>
                    </div>
                </div>
                <!-- クレド6 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">06</span>
                        <h3 class="credo-keyword">対話</h3>
                    </div>
                    <div class="credo-body">
                        <h4>「どう言えば相手に届くか」を、相手以上に徹底的に考えます</h4>
                        <p>自分の想いを一方的に伝えるのではなく、相手に寄り添った丁寧な会話を心がけます。</p>
                    </div>
                </div>
                <!-- クレド7 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">07</span>
                        <h3 class="credo-keyword">気づき</h3>
                    </div>
                    <div class="credo-body">
                        <h4>「いま何に困っているか」に気づき、一歩先回りして動きます</h4>
                        <p>指示を待つのではなく、相手の状況を予測して自発的に行動します。</p>
                    </div>
                </div>
                <!-- クレド8 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">08</span>
                        <h3 class="credo-keyword">原点</h3>
                    </div>
                    <div class="credo-body">
                        <h4>「お客様のおかげで今がある」という原点を、行動で証明します</h4>
                        <p>私たちの給料はお客様からの対価であると理解し、最高の価値でお応えします。</p>
                    </div>
                </div>
                <!-- クレド9 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">09</span>
                        <h3 class="credo-keyword">効率</h3>
                    </div>
                    <div class="credo-body">
                        <h4>無駄をなくして時間をつくり、もっと大切な人のために時間を使います</h4>
                        <p>常に仕事の効率化を目指し、より生産性が高くクリエイティブな働き方を追求します。</p>
                    </div>
                </div>
                <!-- クレド10 -->
                <div class="credo-card fade-in">
                    <div class="credo-header">
                        <span class="credo-num">10</span>
                        <h3 class="credo-keyword">思いやり</h3>
                    </div>
                    <div class="credo-body">
                        <h4>「もし自分が相手だったら」を、すべての判断の基準にします</h4>
                        <p>すべての意思決定において、主語を「相手」に置き換え、ベストな選択を導き出します。</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Noteセクション -->
    <section id="note" class="section note-section">
        <div class="container">
            <h2 class="section-title fade-in">記事・インサイト</h2>
            <p class="section-subtitle fade-in">Insights & Note</p>
            <div id="note-container" class="note-grid">
                <!-- JavaScriptでここにnote記事が自動的に挿入されます -->
                <div class="loading">記事を読み込み中...</div>
            </div>
            <div class="note-more fade-in">
                <a href="https://note.com/major_frog4701" target="_blank" rel="noopener noreferrer" class="btn-secondary">noteですべての記事を見る</a>
            </div>
        </div>
    </section>

    <!-- Contactセクション -->
    <section id="contact" class="section contact-section">
        <div class="container">
            <div class="contact-box fade-in">
                <h2 class="section-title">お問い合わせ</h2>
                <p class="section-subtitle">Contact</p>
                <?php echo do_shortcode('[contact-form-7 id="8d39520" title="コンタクトフォーム 1"]'); ?>
            </div>
        </div>
    </section>

    <!-- フッター -->
    <footer class="footer">
        <div class="container">
            <div class="footer-top">
                <div class="footer-logo">
                    <img src="<?php echo get_template_directory_uri(); ?>/kap_logo.png" alt="株式会社KAP" style="max-height: 50px; background-color: #ffffff; padding: 10px; border-radius: 8px;">
                </div>
                <div class="footer-links">
                    <a href="#philosophy">経営理念</a>
                    <a href="#service-price">サービス・料金</a>
                    <a href="https://kap-cocotte.com/rakumaru/" style="color: #60a5fa; font-weight: 700;">らくまる労務</a>
                    <a href="#works">実績</a>
                    <a href="#about">会社概要</a>
                    <a href="#note">記事</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; <?php echo date('Y'); ?> 株式会社KAP. All Rights Reserved.</p>
            </div>
        </div>
    </footer>

    <?php wp_footer(); ?>
</body>
</html>
