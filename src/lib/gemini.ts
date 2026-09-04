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
    // 最新の Gemini 3.5 Flash を最優先で呼び出し
    const models = ['gemini-3.5-flash', 'gemini-3.5-flash-latest', 'gemini-3.5-pro'];
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
