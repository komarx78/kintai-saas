# -*- coding: utf-8 -*-
with open("scratch/kap_hp.html", "r", encoding="utf-8") as f:
    code = f.read()

# 1. テンプレートタグ変換
code = code.replace('<html lang="en-US">', '<html <?php language_attributes(); ?>>')
code = code.replace('<meta charset="UTF-8">', '<meta charset="<?php bloginfo( \'charset\' ); ?>">')

# 2. headの整理とレスポンシブスタイルの配備
head_start = code.find('<title>')
head_end = code.find('</head>')
if head_start != -1 and head_end != -1:
    wp_head_replacement = '''<title>滋賀・京都で経営改善・資金調達・AI活用なら株式会社KAP</title>
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
    }
    </style>
'''
    code = code[:head_start] + wp_head_replacement + code[head_end:]

code = code.replace('<body class="home blog wp-theme-kap-theme">', '<body <?php body_class(); ?>>')
code = code.replace('src="https://kap-cocotte.com/wp-content/themes/kap-theme/kap_logo.png"', 'src="<?php echo get_template_directory_uri(); ?>/kap_logo.png"')
code = code.replace('src="https://kap-cocotte.com/wp-content/themes/kap-theme/', 'src="<?php echo get_template_directory_uri(); ?>/')

# 3. ヘッダーナビの追加（1箇所のみ）
old_h_nav = '<li><a href="#service-price">サービス・料金</a></li>'
new_h_nav = '<li><a href="#service-price">サービス・料金</a></li>\n                    <li><a href="#rakumaru-saas" style="color: #2563eb; font-weight: 700;">自社開発システム</a></li>'
code = code.replace(old_h_nav, new_h_nav, 1)

# 4. フッターナビの追加（1箇所のみ）
old_f_nav = '<a href="#service-price">サービス・料金</a>'
new_f_nav = '<a href="#service-price">サービス・料金</a>\n                    <a href="#rakumaru-saas" style="color: #60a5fa; font-weight: bold;">自社開発システム</a>'
code = code.replace(old_f_nav, new_f_nav, 1)

# 5. 自社開発プロダクト特設セクション（横幅いっぱいのワイドショーケース）
rakumaru_showcase = '''
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
            </div>
'''

# 6. サービス・料金セクションの閉じタグの手前（ピンポイント挿入）
target = '''            </div>
        </div>
    </section>

    <!-- Worksセクション（実績） -->'''

replacement = '''            </div>
''' + rakumaru_showcase + '''
        </div>
    </section>

    <!-- Worksセクション（実績） -->'''

code = code.replace(target, replacement)

# 7. footerのスクリプト群を wp_footer() に置換
footer_start = code.find('<script type="speculationrules">')
body_end = code.find('</body>')
if footer_start != -1 and body_end != -1:
    code = code[:footer_start] + '    <?php wp_footer(); ?>\n' + code[body_end:]

with open("scratch/index.php", "w", encoding="utf-8") as f:
    f.write(code)

print("Regenerated scratch/index.php cleanly and successfully!")
