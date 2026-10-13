<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="滋賀・京都で経営改善なら株式会社KAP。上場企業水準の経営企画力と伴走型の実行力で、企業の成長を『仕組み化』します。中小企業のAI活用（Gemini）による業務改善、資金調達（事業計画書・銀行折衝）を強力にサポート。">
    <title>滋賀・京都で経営改善・資金調達・AI活用なら株式会社KAP</title>
    <?php wp_head(); ?>
    <style>
    @media (max-width: 960px) {
        #rakumaru-saas > div {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
        }
        #rakumaru-saas {
            padding: 32px 20px !important;
            margin-top: 40px !important;
        }
        #custom-dev-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
        }
    }
    </style>
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
                    <li><a href="#rakumaru-saas" style="color: #2563eb; font-weight: 700;">自社開発システム</a></li>
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
    <section class="hero" style="background-image: url('https://kap-cocotte.com/wp-content/themes/kap-theme/hero_bg.png'); background-size: cover; background-position: center;">
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

            </div>

            <!-- ========================================================================= -->
            <!-- 🚀 KAP自社開発DXシステム特設セクション（ワイドショーケース） -->
            <!-- ========================================================================= -->
            <div id="rakumaru-saas" style="margin-top: 60px; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1e1b4b 100%); border-radius: 28px; padding: 48px 40px; color: #ffffff; box-shadow: 0 20px 45px -10px rgba(30, 58, 138, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); position: relative; overflow: hidden;">
                <!-- 装飾背景グロー -->
                <div style="position: absolute; top: -100px; right: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(0, 0, 0, 0) 70%); border-radius: 50%; pointer-events: none;"></div>
                <div style="position: absolute; bottom: -100px; left: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(6, 199, 85, 0.2) 0%, rgba(0, 0, 0, 0) 70%); border-radius: 50%; pointer-events: none;"></div>

                <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 48px; align-items: center; position: relative; z-index: 2;">
                    
                    <!-- 左カラム：開発背景ストーリー ＆ プロダクト特長 -->
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
                            <span style="background: linear-gradient(135deg, #2563eb, #06C755); color: #ffffff; font-size: 11px; font-weight: 900; padding: 4px 14px; border-radius: 20px; box-shadow: 0 4px 12px rgba(37,99,235,0.4); letter-spacing: 0.05em;">
                                KAP自社開発・人事労務SaaS
                            </span>
                            <span style="background: rgba(255, 255, 255, 0.15); color: #93c5fd; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(147, 197, 253, 0.3);">
                                現場のリアルな声から誕生
                            </span>
                        </div>

                        <h3 style="font-size: 26px; font-weight: 900; line-height: 1.45; margin: 0 0 16px 0; color: #ffffff; letter-spacing: -0.02em;">
                            「もう現場にアプリを入れさせない！」<br>
                            公式LINE連携・1人月額300円〜<br>
                            <span style="color: #60a5fa; text-decoration: underline; text-decoration-color: #f59e0b; text-underline-offset: 6px;">みんなの らくまる労務</span>
                        </h3>

                        <!-- 開発ストーリー（いきなり感を完全払拭） -->
                        <div style="background: rgba(255, 255, 255, 0.07); border-left: 3px solid #60a5fa; padding: 14px 18px; border-radius: 0 14px 14px 0; margin-bottom: 24px; font-size: 13px; line-height: 1.75; color: #cbd5e1;">
                            <strong style="color: #ffffff;">【なぜ経営コンサルのKAPが開発したのか】</strong><br>
                            多くの中小企業・店舗をご支援する中で、最も経営者を苦しめていたのが「月末の打刻集計・給与計算・シフト催促・役所書類の手書き」でした。「大手SaaSは高額で、現場スタッフがアプリを入れてくれない」という切実な悲鳴に応え、KAPが自ら現場目線でゼロから設計・開発した次世代人事労務クラウドです。
                        </div>

                        <!-- 4大強みリスト -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px;">
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #f1f5f9;">
                                <span style="color: #06C755; font-size: 15px;">✓</span> 公式LINE友だち追加で即日定着
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #f1f5f9;">
                                <span style="color: #06C755; font-size: 15px;">✓</span> 打刻連動で給与一括＆全銀振込CSV
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #f1f5f9;">
                                <span style="color: #06C755; font-size: 15px;">✓</span> 離職票・月変届の公的A4原本直接印字
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #f1f5f9;">
                                <span style="color: #06C755; font-size: 15px;">✓</span> 初期費用0円・下限人数縛りなし
                            </div>
                        </div>

                        <!-- 料金・アクションボタン -->
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px;">
                            <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); padding: 10px 18px; border-radius: 14px;">
                                <div style="font-size: 10px; color: #94a3b8; font-weight: bold;">利用料金（明朗会計）</div>
                                <div style="font-size: 18px; font-weight: 900; color: #38bdf8;">
                                    1人月額 300円〜 <small style="font-size: 11px; color: #e2e8f0; font-weight: normal;">(初期0円)</small>
                                </div>
                            </div>

                            <a href="https://kap-cocotte.com/rakumaru/" style="display: inline-flex; align-items: center; gap: 8px; padding: 15px 28px; background: linear-gradient(135deg, #f97316, #eab308); color: #ffffff; font-weight: 900; font-size: 15px; text-decoration: none; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(249, 115, 22, 0.5); transition: all 0.3s; border: 1px solid rgba(255, 255, 255, 0.3);">
                                <span>らくまる労務 詳細・1ヶ月無料体験を見る</span>
                                <span style="font-size: 16px;">➔</span>
                            </a>
                        </div>
                    </div>

                    <!-- 右カラム：本物のシステム画面ビジュアル（凄みの証明） -->
                    <div>
                        <div style="background: #ffffff; border-radius: 20px; padding: 20px; color: #1e293b; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.8);">
                            <!-- ダッシュボードヘッダー -->
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 14px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
                                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
                                    <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                                    <span style="font-size: 11px; font-weight: 900; color: #334155; margin-left: 6px;">みんなの らくまる労務 管理ポータル</span>
                                </div>
                                <span style="background: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 12px; border: 1px solid #bbf7d0;">
                                    ● 本番稼働中
                                </span>
                            </div>

                            <!-- LINE連携プレビューカード -->
                            <div style="background: linear-gradient(135deg, #06C755, #059669); border-radius: 14px; padding: 14px; color: #ffffff; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(6, 199, 85, 0.25);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <span style="font-size: 11px; font-weight: 900; display: flex; align-items: center; gap: 6px;">
                                        💬 公式LINEスタッフ自動連携
                                    </span>
                                    <span style="background: rgba(255, 255, 255, 0.25); font-size: 9px; padding: 2px 6px; border-radius: 6px; font-weight: bold;">アプリ不要</span>
                                </div>
                                <div style="font-size: 11px; line-height: 1.5; color: #f0fdf4;">
                                    シフト希望回収・確定通知・緊急代打募集・Web給与明細通知がすべてLINEで自動配信！
                                </div>
                            </div>

                            <!-- 3大ステータス -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; text-align: center;">
                                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 8px 4px;">
                                    <div style="font-size: 9px; color: #0369a1; font-weight: bold;">打刻・勤怠</div>
                                    <div style="font-size: 13px; font-weight: 900; color: #082f49;">ミス 0 件</div>
                                </div>
                                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 8px 4px;">
                                    <div style="font-size: 9px; color: #15803d; font-weight: bold;">給与一括計算</div>
                                    <div style="font-size: 13px; font-weight: 900; color: #14532d;">全銀協CSV</div>
                                </div>
                                <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 8px 4px;">
                                    <div style="font-size: 9px; color: #a16207; font-weight: bold;">無料体験</div>
                                    <div style="font-size: 13px; font-weight: 900; color: #713f12;">30日間</div>
                                </div>
                            </div>

                            <!-- 公的A4原本直接印字の強み -->
                            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 20px;">🖨️</span>
                                <div style="font-size: 11px; color: #475569; line-height: 1.4;">
                                    <strong style="color: #0f172a;">ハローワーク・年金事務所 提出用A4原本直接印字</strong><br>
                                    離職票-2・月変届・賞与支払届・資格取得届を役所様式へ1ミリの狂いもなく直印字！
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ========================================================================= -->
                <!-- 🛠️ KAPの受託・オーダーメイドシステム開発アピール（実績・価格破壊の証明） -->
                <!-- ========================================================================= -->
                <div style="margin-top: 40px; padding-top: 36px; border-top: 1px dashed rgba(255, 255, 255, 0.2); position: relative; z-index: 2;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 11px; font-weight: 900; padding: 4px 14px; border-radius: 20px; letter-spacing: 0.05em; display: inline-block; margin-bottom: 10px;">
                            KAPの受託・オーダーメイド開発力
                        </span>
                        <h4 style="font-size: 22px; font-weight: 900; color: #ffffff; margin: 0 0 10px 0; letter-spacing: -0.02em; line-height: 1.4;">
                            自社開発だからできる。「御社専用のオーダーメイド業務システム」もゼロから構築いたします
                        </h4>
                        <p style="font-size: 13px; color: #cbd5e1; max-width: 800px; margin: 0 auto; line-height: 1.75;">
                            「みんなのらくまる労務」をゼロから開発・運用しているKAPだからこそ、大手IT会社のような無駄な中間マージンや多重下請けは一切ありません。<br>
                            経営コンサルが業務フローを徹底的に整理し、本当に現場で使える仕組みを圧倒的な適正価格で創り上げます。
                        </p>
                    </div>

                    <!-- 2大価格破壊・実績対比カード -->
                    <div id="custom-dev-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        
                        <!-- 事例1：中〜大規模開発 -->
                        <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; padding: 22px; position: relative;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                <span style="background: #ef4444; color: #ffffff; font-size: 10px; font-weight: 900; padding: 3px 10px; border-radius: 8px;">
                                    大幅コスト削減
                                </span>
                                <span style="font-size: 11px; color: #94a3b8; font-weight: bold;">基幹・専用業務システム開発</span>
                            </div>
                            <div style="font-size: 13px; color: #94a3b8; text-decoration: line-through; margin-bottom: 4px;">他社開発会社の見積もり：数千万円</div>
                            <div style="font-size: 24px; font-weight: 900; color: #38bdf8; margin-bottom: 10px; line-height: 1.2;">
                                KAPなら <span style="color: #facc15; font-size: 30px;">200万円</span> で完成！
                            </div>
                            <p style="font-size: 12px; color: #e2e8f0; line-height: 1.6; margin: 0;">
                                「大手に見積もったら高額すぎて断念した…」という特殊な業界ルールや独自業務フローも、無駄な機能を削ぎ落とし、現場にフィットする完全専用システムとして1/10以下の適正予算で実現します。
                            </p>
                        </div>

                        <!-- 事例2：小規模・プチ自動化システム -->
                        <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 18px; padding: 22px; position: relative;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                <span style="background: #10b981; color: #ffffff; font-size: 10px; font-weight: 900; padding: 3px 10px; border-radius: 8px;">
                                    手軽に現場DX
                                </span>
                                <span style="font-size: 11px; color: #94a3b8; font-weight: bold;">小規模・現場作業自動化</span>
                            </div>
                            <div style="font-size: 13px; color: #94a3b8; margin-bottom: 4px;">毎日の面倒なExcel集計・LINE連携・紙作業</div>
                            <div style="font-size: 24px; font-weight: 900; color: #4ade80; margin-bottom: 10px; line-height: 1.2;">
                                わずか <span style="color: #facc15; font-size: 30px;">10万円</span> で即解決！
                            </div>
                            <p style="font-size: 12px; color: #e2e8f0; line-height: 1.6; margin: 0;">
                                「大掛かりなシステムではなく、毎日のコピペや集計作業、LINE自動通知だけを安く仕組み化したい」という現場の切実な声にも即応。小回りの利くプチシステムを10万円〜で迅速に開発します。
                            </p>
                        </div>

                    </div>

                    <!-- お問い合わせへのアクションボタン -->
                    <div style="text-align: center;">
                        <a href="#contact" style="display: inline-flex; align-items: center; gap: 10px; padding: 15px 36px; background: linear-gradient(135deg, #2563eb, #06C755); color: #ffffff; font-weight: 900; font-size: 15px; text-decoration: none; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); transition: all 0.3s; border: 1px solid rgba(255, 255, 255, 0.3);">
                            <span>自社専用システム・作業自動化のご相談・お見積もり（無料）はこちら</span>
                            <span style="font-size: 18px;">➔</span>
                        </a>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
                            ※「こんな作業、システム化できる？」という漠然としたご相談でも大歓迎です。経営コンサルタントが親身にお伺いします。
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
                
<div class="wpcf7 no-js" id="wpcf7-f6-o1" lang="ja" dir="ltr" data-wpcf7-id="6">
<div class="screen-reader-response"><p role="status" aria-live="polite" aria-atomic="true"></p> <ul></ul></div>
<form action="/#wpcf7-f6-o1" method="post" class="wpcf7-form init" aria-label="コンタクトフォーム" novalidate="novalidate" data-status="init">
<fieldset class="hidden-fields-container"><input type="hidden" name="_wpcf7" value="6" /><input type="hidden" name="_wpcf7_version" value="6.1.6" /><input type="hidden" name="_wpcf7_locale" value="ja" /><input type="hidden" name="_wpcf7_unit_tag" value="wpcf7-f6-o1" /><input type="hidden" name="_wpcf7_container_post" value="0" /><input type="hidden" name="_wpcf7_posted_data_hash" value="" />
</fieldset>
<p><label> 氏名<br />
<span class="wpcf7-form-control-wrap" data-name="your-name"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" autocomplete="name" aria-required="true" aria-invalid="false" value="" type="text" name="your-name" /></span> </label>
</p>
<p><label> メールアドレス<br />
<span class="wpcf7-form-control-wrap" data-name="your-email"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-email wpcf7-validates-as-required wpcf7-text wpcf7-validates-as-email" autocomplete="email" aria-required="true" aria-invalid="false" value="" type="email" name="your-email" /></span> </label>
</p>
<p><label> 題名<br />
<span class="wpcf7-form-control-wrap" data-name="your-subject"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" aria-invalid="false" value="" type="text" name="your-subject" /></span> </label>
</p>
<p><label> メッセージ本文 (任意)<br />
<span class="wpcf7-form-control-wrap" data-name="your-message"><textarea cols="40" rows="10" maxlength="2000" class="wpcf7-form-control wpcf7-textarea" aria-invalid="false" name="your-message"></textarea></span> </label>
</p>
<p><input class="wpcf7-form-control wpcf7-submit has-spinner" type="submit" value="送信" />
</p><div class="wpcf7-response-output" aria-hidden="true"></div>
</form>
</div>
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
                    <a href="#works">実績</a>
                    <a href="#about">会社概要</a>
                    <a href="#note">記事</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2026 株式会社KAP. All Rights Reserved.</p>
            </div>
        </div>
    </footer>

        <?php wp_footer(); ?>
</body>
</html>
