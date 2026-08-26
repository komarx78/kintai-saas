// Google Gemini API クライアント

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 就業規則をもとにGemini AIに質問する（SaaSマルチテナント対応）
 * @param query ユーザーの質問
 * @param companyRules 就業規則・社内規定テキスト
 * @param chatHistory これまでのチャット履歴
 * @param tenantApiKey テナントごとの個別APIキー（任意）
 */
export async function askEmploymentRulesAI(
  query: string,
  companyRules: string,
  chatHistory: ChatMessage[] = [],
  tenantApiKey?: string
): Promise<string> {
  // 1. 販売元プラットフォーム設定キー ➔ 2. 環境変数 ➔ 3. テナント個別キー
  const apiKey = tenantApiKey ||
    localStorage.getItem('platform_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    localStorage.getItem('gemini_api_key_custom') ||
    '';

  if (!apiKey || apiKey.includes('placeholder')) {
    return '【AI機能のご案内】現在、就業規則AI相談機能の準備中です。システム管理者にお問い合わせいただくか、就業規則の直接のご確認をお願いいたします。';
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
    // 最新のGemini 3.5 Flashモデルを第一優先で呼び出し
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    
    let res = await fetch(url, {
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

    // 3.5-flashが利用できない場合のフォールバック（2.5-flash / 1.5-flash）
    if (!res.ok) {
      console.warn('Gemini 3.5 flash returned status:', res.status, 'Retrying with 2.5 flash...');
      const fallbackUrl25 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      res = await fetch(fallbackUrl25, {
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
    }

    if (!res.ok) {
      console.warn('Gemini 2.5 flash returned status:', res.status, 'Retrying with 1.5 flash...');
      const fallbackUrl15 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      res = await fetch(fallbackUrl15, {
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
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error('Gemini API Error details:', errJson);
      throw new Error(`AI API エラー (${res.status}): ${errJson.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!answer) {
      return 'AIからの回答を取得できませんでした。もう一度お試しください。';
    }

    return answer;
  } catch (error: any) {
    console.error('AI Error:', error);
    return `申し訳ありません。AIの応答中にエラーが発生しました。\n（詳細: ${error.message}）`;
  }
}
