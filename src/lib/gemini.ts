// Google Gemini API クライアント
import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 全デバイス・別PCで確実にGemini APIキーを取得するリゾルバ（SaaSマルチテナント対応）
 * テナント個別 ➔ プラットフォーム共通（system_settings） ➔ キャッシュ ➔ 環境変数の順で自動解決
 */
export async function getResolvedGeminiApiKey(tenantId?: string): Promise<string> {
  // 1. localStorage からの即時キャッシュ
  const localKey = (tenantId ? localStorage.getItem(`gemini_api_key_${tenantId}`) : null) ||
    localStorage.getItem('platform_gemini_api_key') ||
    localStorage.getItem('gemini_api_key_custom');
  if (localKey && localKey.trim() && !localKey.includes('placeholder')) {
    return localKey.trim();
  }

  // 2. テナント個別設定（tenants テーブル）から取得
  if (tenantId) {
    try {
      const { data: tData } = await supabase.from('tenants').select('gemini_api_key').eq('id', tenantId).maybeSingle();
      if (tData?.gemini_api_key && tData.gemini_api_key.trim()) {
        localStorage.setItem(`gemini_api_key_${tenantId}`, tData.gemini_api_key.trim());
        return tData.gemini_api_key.trim();
      }
    } catch (e) {
      console.warn('Failed to fetch tenant gemini_api_key:', e);
    }
  }

  // 3. プラットフォーム統括本部設定（system_settings テーブル）から取得（別PC・全社共通の決定打）
  try {
    const { data: sData } = await supabase.from('system_settings').select('gemini_api_key').limit(1).maybeSingle();
    if (sData?.gemini_api_key && sData.gemini_api_key.trim()) {
      localStorage.setItem('platform_gemini_api_key', sData.gemini_api_key.trim());
      return sData.gemini_api_key.trim();
    }
  } catch (e) {
    console.warn('Failed to fetch system_settings gemini_api_key:', e);
  }

  // 4. 環境変数フォールバック
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim() && !envKey.includes('placeholder')) {
    return envKey.trim();
  }

  return '';
}

/**
 * 就業規則をもとにGemini AIに質問する（SaaSマルチテナント対応）
 * @param query ユーザーの質問
 * @param companyRules 就業規則・社内規定テキスト
 * @param chatHistory これまでのチャット履歴
 * @param tenantApiKey テナントごとの個別APIキー（任意）
 * @param tenantId テナントID（任意）
 */
export async function askEmploymentRulesAI(
  query: string,
  companyRules: string,
  chatHistory: ChatMessage[] = [],
  tenantApiKey?: string,
  tenantId?: string
): Promise<string> {
  let apiKey = tenantApiKey?.trim() || '';
  if (!apiKey || apiKey.includes('placeholder')) {
    apiKey = await getResolvedGeminiApiKey(tenantId);
  }

  if (!apiKey || apiKey.includes('placeholder')) {
    return '【AI機能のご案内】現在、社内規定AI相談機能のAPIキーが未設定です。\n管理者アカウントにて「特権本部」または「会社・全社マスタ設定」より、Google Gemini APIキーの登録をお願いいたします。';
  }

  const systemInstruction = `あなたは企業の就業規則・社内規定に精通した親切で優秀な人事労務アシスタントAIです。
以下の【会社の就業規則・社内規定】に基づいて、従業員からの質問にわかりやすく、礼儀正しく丁寧に日本語で答えてください。

【回答のルール】
1. 必ず【会社の就業規則・社内規定】の内容を最優先の根拠として回答してください。
2. 該当する条文や規定がある場合は、「就業規則 第○条に基づき〜」のように根拠を明示してください。
3. 申請が必要なもの（有給、慶弔休暇、遅刻・早退、休職、退職など）については、具体的な申請手順や期限（例: ○日前までに申請など）も優しく案内してください。
4. 就業規則に明記されていない事項や、個別判断が必要な事柄については、勝手に決めつけず「こちらの詳細は会社の人事・労務担当者様へ直接ご相談ください」と案内してください。
5. 親しみやすく、要点が箇条書きなどでパッと見やすいレイアウトで回答してください。

【会社の就業規則・社内規定】
${companyRules || '（就業規則が登録されていません。労働基準法および一般的な標準就業規則の基準に基づき回答します）'}
`;

  // 会話履歴をGeminiの形式にマッピング
  const contents = [];
  
  // システム指示
  contents.push({
    role: 'user',
    parts: [{ text: `【システム設定・就業規則】\n${systemInstruction}\n\n理解しましたか？` }]
  });
  contents.push({
    role: 'model',
    parts: [{ text: '承知いたしました。社内の就業規則・社内規定に基づき、従業員様のご質問にわかりやすく丁寧にお答えいたします。' }]
  });

  // 過去のチャット履歴
  chatHistory.slice(-6).forEach(msg => {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  });

  // 今回のユーザー質問
  contents.push({
    role: 'user',
    parts: [{ text: query }]
  });

  try {
    const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-pro-latest'];
    let lastError: any = null;
    let answer: string | null = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          answer = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (answer) break;
        } else {
          const errJson = await res.json().catch(() => ({}));
          console.warn(`Model ${model} returned status ${res.status}:`, errJson);
          lastError = errJson.error?.message || res.statusText;
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!answer) {
      if (lastError && (lastError.includes('API_KEY_INVALID') || lastError.includes('API key not valid'))) {
        return '【エラー】登録されているGemini APIキーが無効です。管理者様にて正しいAPIキーを再登録してください。';
      }
      if (lastError && lastError.includes('Quota')) {
        return '【エラー】Gemini APIの利用制限（クォータ）に達しました。しばらく時間をおいてから再度お試しください。';
      }
      return `申し訳ありません。AIの応答を取得できませんでした。\n（詳細: ${lastError || 'モデル接続エラー'}）`;
    }

    return answer;
  } catch (error: any) {
    console.error('AI Error:', error);
    return `申し訳ありません。AIの応答中にエラーが発生しました。\n（詳細: ${error.message}）`;
  }
}

/**
 * システム公式操作マニュアル＆FAQをもとにGemini AIに質問する（システムAIサポートデスク）
 * @param query ユーザーの質問
 * @param faqKnowledge システム公式FAQ知識ベース
 * @param tenantId テナントID（任意）
 * @param pageContext 現在ユーザーが開いている画面のコンテキスト情報（任意）
 */
export async function askSystemOperationAI(
  query: string,
  faqKnowledge: string,
  tenantId?: string,
  pageContext?: string
): Promise<string> {
  const apiKey = await getResolvedGeminiApiKey(tenantId);
  if (!apiKey) {
    return '【お知らせ】AIサポートデスクのAPIキーが未設定です。特権管理者（super-admin）にてAIプラットフォーム設定をご確認いただくか、下記の操作FAQ一覧をご参照ください。';
  }

  const systemInstruction = `
あなたは「みんなの らくまる労務」（勤怠・シフト・給与・労務手続き一元管理クラウド）の公式AIサポートデスク担当者です。
利用企業（テナント）の従業員および管理者からの「システムの操作方法・機能の使い方・困りごと」に対して、親切・丁寧・的確に操作手順を回答してください。

【ユーザーが現在開いている画面・コンテキスト】
${pageContext || '現在画面: 不明（全システム共通画面）'}

【最重要：画面コンテキストに基づく回答判定ルール（推測・嘘の完全禁止）】
1. ユーザーが「基本情報ってどう入れるの？」「基本情報の入力方法」「基本設定はどうするの？」などの質問をした場合：
   - 現在の画面が「🏢 会社・全社労務マスタ設定センター」（パス: /settings/company）である場合、または会社設定を開いている場合は、100%【会社基本情報（企業名・住所・代表者役職/氏名・代表電話番号・会社実印/社印の登録・一括保存）】の登録手順を案内してください。従業員の入社手続きの基本情報と誤認して回答することを固く禁じます。
   - 現在の画面が「入退社労務管理（入社手続き）」である場合のみ、従業員の入社手続き基本情報（氏名・生年月日・現住所・口座情報等）の入力手順を回答してください。
2. 操作案内を行う際は、実際の画面構成（タブ名、ボタン名、入力項目名）と100%一致させて案内してください：
   - 会社マスタの場合: 「1. 会社基本情報」タブ、右上の「設定を一括保存」ボタン、企業名/屋号、本社所在地、代表者役職・氏名、会社実印・社印の印影登録（印影画像をアップロード / 本格公式角印を自動生成）
3. 箇条書きやステップ番号（1. 2. 3.）を用いて、ユーザーが迷わず直感的に操作できるようにわかりやすく解説してください。

【システム全体マップ（主要7大機能）】
- 🏢 会社・全社労務マスタ設定センター（/settings/company）: 会社基本情報、組織図・役職・部署、就業時間パターン・営業カレンダー、給与締め日、労働条件通知書、入社手続きステップ
- ⏰ 勤怠・打刻管理（/kintai/user, /kintai/admin）: 出退勤打刻、休憩打刻、月次勤怠照会、打刻修正申請、月間出勤簿承認・締め確定
- 🌴 有給・各種申請（/kintai/user, /kintai/admin）: 有給休暇申請、半日有休、特別休暇、有給残数確認、年5日義務管理
- 📅 シフト管理（/shift/user, /shift/admin）: シフト希望カレンダー提出、必要枠設定、シフト作成・確定Publish
- 💰 給与計算・明細（/payroll/user, /payroll/admin）: 勤怠一括自動計算、Web給与明細・賞与明細発行、国税庁様式源泉徴収簿、賃金台帳、公式A4印刷
- 📄 入退社・労務手続き（/onboarding/admin, /onboarding/input）: 新入社員基本情報入力・通帳写真提出、マイナンバー、労働条件通知書電子同意、労働者名簿、離職票・公的書類発行
- ⚙️ 共通・アカウント（/portal, /reset-password）: 統合ポータル、パスワード再設定、招待コード発行、退職・復職処理

【システム公式操作マニュアル・FAQ知識ベース】
${faqKnowledge}

【回答ガイドライン】
1. 礼儀正しく、親身で分かりやすい日本語で回答してください。
2. 画面のどこを押せばよいか、操作の具体的な手順（1. 2. 3.）をステップ形式で示してください。
3. 知識ベースにない特殊な設定や自社独自の就業規則に関しては、「自社の管理者様または開発元サポート窓口へお問い合わせください」と案内してください。
4. 箇条書きや絵文字を適度に使って、読みやすく構成してください。
`;

  try {
    const models = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-pro-latest'];
    let answer: string | null = null;
    let lastError: string | null = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = {
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nユーザーの質問: ${query}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const data = await res.json();
          answer = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
          if (answer) break;
        } else {
          const errJson = await res.json().catch(() => ({}));
          lastError = errJson.error?.message || res.statusText;
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!answer) {
      return `申し訳ありません。AI応答を取得できませんでした。（詳細: ${lastError || '接続エラー'}）下記のFAQ一覧もあわせてご参照ください。`;
    }
    return answer;
  } catch (error: any) {
    return `申し訳ありません。エラーが発生しました。（詳細: ${error.message}）`;
  }
}
