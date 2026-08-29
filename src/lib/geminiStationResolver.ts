/**
 * 入力された地名・通称・駅名から地区（所在地）を推測し、本当の正式駅名・路線名をサジェストするエンジン
 */

import { supabase } from './supabase';

export interface StationSuggestion {
  region: string; // 例: "東京都豊島区"
  formalStationName: string; // 例: "大塚駅"
  lineName: string; // 例: "JR山手線"
  type: 'jr' | 'private_rail' | 'subway' | 'bus';
  description?: string; // 例: "北大塚エリアの最寄駅"
}

// 主要な地名・通称と正式駅名の高速プリセット辞書
const STATION_PRESET_MAP: Record<string, StationSuggestion[]> = {
  '北大塚': [
    { region: '東京都豊島区', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: 'JR山手線 最寄駅' },
    { region: '東京都豊島区', formalStationName: '大塚駅前', lineName: '都電荒川線（東京さくらトラム）', type: 'private_rail', description: '都電停留場' },
    { region: '東京都豊島区', formalStationName: '巣鴨新田', lineName: '都電荒川線', type: 'private_rail', description: '北大塚1丁目寄り' }
  ],
  '南大塚': [
    { region: '東京都豊島区', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: '南口側' },
    { region: '東京都豊島区', formalStationName: '新大塚駅', lineName: '東京メトロ丸ノ内線', type: 'subway', description: '春日通り沿い' }
  ],
  '赤坂': [
    { region: '東京都港区', formalStationName: '赤坂駅', lineName: '東京メトロ千代田線', type: 'subway', description: '東京都港区赤坂' },
    { region: '東京都港区', formalStationName: '赤坂見附駅', lineName: '東京メトロ銀座線・丸ノ内線', type: 'subway', description: '見附交差点' },
    { region: '福岡県福岡市中央区', formalStationName: '赤坂駅', lineName: '福岡市営地下鉄空港線', type: 'subway', description: '福岡市中央区' }
  ],
  '丸の内': [
    { region: '東京都千代田区', formalStationName: '東京駅', lineName: 'JR各線 / 東京メトロ丸ノ内線', type: 'jr', description: '丸の内口直結' },
    { region: '愛知県名古屋市中区', formalStationName: '丸の内駅', lineName: '名古屋市営地下鉄鶴舞線・桜通線', type: 'subway', description: '名古屋市中区' }
  ],
  '新大阪': [
    { region: '大阪府大阪市淀川区', formalStationName: '新大阪駅', lineName: '東海道・山陽新幹線 / JR京都線 / Osaka Metro御堂筋線', type: 'jr', description: '新幹線・在来線・地下鉄ターミナル' }
  ],
  '新宿三丁目': [
    { region: '東京都新宿区', formalStationName: '新宿三丁目駅', lineName: '東京メトロ丸ノ内線・副都心線 / 都営新宿線', type: 'subway', description: '伊勢丹前' }
  ],
  '渋谷ヒカリエ': [
    { region: '東京都渋谷区', formalStationName: '渋谷駅', lineName: 'JR各線 / 東急東横線・田園都市線 / 東京メトロ各線', type: 'jr', description: '東口・ヒカリエ直結' }
  ],
  '中野サンモール': [
    { region: '東京都中野区', formalStationName: '中野駅', lineName: 'JR中央線・総武線 / 東京メトロ東西線', type: 'jr', description: '北口商店街' }
  ]
};

/**
 * 入力された駅名・地名から地区と正式駅名を推測して候補リストを返却
 */
export async function resolveStationSuggestions(
  query: string,
  contextAddress?: string
): Promise<{ regionHint: string; suggestions: StationSuggestion[] }> {
  const clean = query.trim();
  if (!clean || clean.length < 2) {
    return { regionHint: '', suggestions: [] };
  }

  // 1. 高速プリセット辞書チェック
  if (STATION_PRESET_MAP[clean]) {
    const list = STATION_PRESET_MAP[clean];
    return {
      regionHint: list[0]?.region || '',
      suggestions: list
    };
  }

  // 2. Gemini 3.5 Flash によるリアルタイム推論
  let apiKey = localStorage.getItem('platform_gemini_api_key') || localStorage.getItem('gemini_api_key_custom');
  if (!apiKey) {
    try {
      const { data } = await supabase.from('system_settings').select('gemini_api_key').limit(1).maybeSingle();
      if (data?.gemini_api_key) apiKey = data.gemini_api_key;
    } catch (e) {
      console.warn('DB fetch gemini_api_key failed:', e);
    }
  }

  if (apiKey) {
    try {
      const prompt = `あなたは日本の地理および鉄道・バス路線のエキスパートAIです。
ユーザーが入力した地名・通称・駅名「${clean}」${contextAddress ? `（ユーザー現住所の文脈: ${contextAddress}）` : ''} から、
どこの地区（都道府県・市区町村）の場所であるかを特定し、対応する「本当の正式な最寄駅名または電停・バス停名」と所属路線を1〜3件推定してJSONで返してください。

【必須出力JSONスキーマ】
{
  "regionHint": "都道府県および市区町村（例: 東京都豊島区）",
  "suggestions": [
    {
      "region": "都道府県および市区町村",
      "formalStationName": "正式駅名（例: 大塚駅）",
      "lineName": "所属路線名（例: JR山手線）",
      "type": "jr または private_rail または subway または bus",
      "description": "補足説明（例: 最寄りの主要駅）"
    }
  ]
}
※ 必ずJSONオブジェクトのみを出力してください。`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, response_mime_type: 'application/json' }
        })
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            regionHint: parsed.regionHint || '',
            suggestions: parsed.suggestions || []
          };
        }
      }
    } catch (err) {
      console.warn('Gemini resolveStationSuggestions failed:', err);
    }
  }

  // 3. フォールバック
  return {
    regionHint: clean.includes('駅') ? '' : `${clean} エリア`,
    suggestions: [
      {
        region: '',
        formalStationName: clean.endsWith('駅') ? clean : `${clean}駅`,
        lineName: 'JR線 / 各社路線',
        type: 'jr',
        description: '入力された名称'
      }
    ]
  };
}
