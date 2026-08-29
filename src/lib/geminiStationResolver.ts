/**
 * 日本全国の同名地名・同名バス停（京都山科・大阪高槻・東京等）を現住所コンテキストと連動して識別するエンジン
 */

import { supabase } from './supabase';

export interface StationSuggestion {
  region: string; // 例: "京都府京都市山科区"
  regionLabel: string; // 例: "京都山科" / "大阪高槻" / "東京豊島"
  formalStationName: string; // 例: "大塚" / "大塚駅" / "北大塚一丁目"
  lineName: string; // 例: "京阪バス" / "高槻市営バス" / "JR山手線"
  type: 'jr' | 'private_rail' | 'subway' | 'bus';
  description?: string; // 例: "京都市山科区の主要バス停"
}

// 日本全国の主要な同名地名・バス停・駅の全国マルチ地域辞書
const MULTI_REGION_PRESET_MAP: Record<string, StationSuggestion[]> = {
  '大塚': [
    { region: '京都府京都市山科区', regionLabel: '京都山科', formalStationName: '大塚（バス停）', lineName: '京阪バス[山科駅/京都駅方面]', type: 'bus', description: '山科区大塚・国道1号線沿い' },
    { region: '大阪府高槻市', regionLabel: '大阪高槻', formalStationName: '大塚（バス停）', lineName: '高槻市営バス / 京阪バス', type: 'bus', description: '高槻市大塚町' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: 'JR山手線' },
    { region: '広島県広島市安佐南区', regionLabel: '広島', formalStationName: '大塚駅', lineName: 'アストラムライン / 広電バス', type: 'private_rail', description: '広島市安佐南区大塚' }
  ],
  '北大塚': [
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '北大塚一丁目', lineName: '都営バス[都02/上60]', type: 'bus', description: '豊島区北大塚バス停' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: 'JR山手線 最寄駅' },
    { region: '京都府京都市山科区', regionLabel: '京都山科', formalStationName: '大塚（バス停）', lineName: '京阪バス', type: 'bus', description: '山科区大塚北部' }
  ],
  '南大塚': [
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: '南口側' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '南大塚三丁目', lineName: '都営バス[都02]', type: 'bus', description: '都営バス停' },
    { region: '埼玉県川越市', regionLabel: '埼玉川越', formalStationName: '南大塚駅', lineName: '西武新宿線', type: 'private_rail', description: '川越市南大塚' }
  ],
  '赤坂': [
    { region: '東京都港区', regionLabel: '東京港区', formalStationName: '赤坂駅', lineName: '東京メトロ千代田線', type: 'subway', description: '東京都港区赤坂' },
    { region: '福岡県福岡市中央区', regionLabel: '福岡中央', formalStationName: '赤坂駅', lineName: '福岡市営地下鉄空港線', type: 'subway', description: '福岡市中央区赤坂' },
    { region: '東京都港区', regionLabel: '東京港区', formalStationName: '赤坂八丁目', lineName: '都営バス[品97]', type: 'bus', description: '赤坂バス停' }
  ],
  '丸の内': [
    { region: '東京都千代田区', regionLabel: '東京千代田', formalStationName: '東京駅（丸の内口）', lineName: 'JR各線 / 丸ノ内線', type: 'jr', description: '丸の内オフィス街' },
    { region: '愛知県名古屋市中区', regionLabel: '名古屋', formalStationName: '丸の内駅', lineName: '名古屋市営地下鉄鶴舞線・桜通線', type: 'subway', description: '名古屋市中区丸の内' }
  ],
  '本町': [
    { region: '大阪府大阪市中央区', regionLabel: '大阪中央', formalStationName: '本町駅', lineName: 'Osaka Metro御堂筋線・中央線・四つ橋線', type: 'subway', description: '大阪市本町' },
    { region: '愛知県名古屋市中区', regionLabel: '名古屋', formalStationName: '伏見駅 / 丸の内駅', lineName: '名古屋市営地下鉄', type: 'subway', description: '本町通沿い' }
  ]
};

/**
 * 住所コンテキスト（都道府県・市区町村）と候補地域の一致度スコアを計算
 */
function calculateRegionMatchScore(candidateRegion: string, contextAddress?: string): number {
  if (!contextAddress) return 0;
  const ctx = contextAddress.replace(/[\s　]/g, '');
  let score = 0;

  // 都道府県の一致（例: 京都府、滋賀県、大阪府、東京都）
  const prefs = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  for (const p of prefs) {
    if (ctx.includes(p) && candidateRegion.includes(p)) {
      score += 100;
    }
  }

  // 市区町村の一致（例: 山科区、高槻市、豊島区、大津市など）
  const words = candidateRegion.split(/[都道府県市区町村]/).filter(w => w.length >= 2);
  for (const w of words) {
    if (ctx.includes(w)) {
      score += 50;
    }
  }

  return score;
}

/**
 * 入力された駅名・地名から地区と正式駅名＆路線バス停を推測して候補リストを返却
 */
export async function resolveStationSuggestions(
  query: string,
  contextAddress?: string
): Promise<{ regionHint: string; suggestions: StationSuggestion[] }> {
  const clean = query.trim();
  if (!clean || clean.length < 2) {
    return { regionHint: '', suggestions: [] };
  }

  // 1. 全国マルチ地域プリセット辞書チェック
  const matchedKey = Object.keys(MULTI_REGION_PRESET_MAP).find(k => clean.includes(k) || k.includes(clean));
  if (matchedKey && MULTI_REGION_PRESET_MAP[matchedKey]) {
    const list = [...MULTI_REGION_PRESET_MAP[matchedKey]];

    // ユーザーの現住所コンテキストに基づいてスコアリングソート
    list.sort((a, b) => {
      const scoreA = calculateRegionMatchScore(a.region, contextAddress);
      const scoreB = calculateRegionMatchScore(b.region, contextAddress);
      return scoreB - scoreA;
    });

    const topRegion = list[0]?.region || '';
    return {
      regionHint: contextAddress && topRegion ? topRegion : '全国の主要候補',
      suggestions: list
    };
  }

  // 2. Gemini 3.5 Flash によるリアルタイム全国推論
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
      const prompt = `あなたは日本の地理および全国47都道府県の鉄道・路線バスネットワークのエキスパートAIです。
ユーザーが入力した地名・通称・駅名「${clean}」${contextAddress ? `（ユーザーの現住所文脈: ${contextAddress}）` : ''} から、
日本全国に同名地名・同名バス停が存在することを考慮し、
① ユーザーの現住所に近い地域の候補を最優先にしつつ、
② 異なる代表的な地域（例: 関西・関東・東海・九州など）の同名駅・バス停も併せて合計2〜4件推定してJSONで返してください。
特にバス利用者のために、路線バス停（type: "bus"）を含めてください。

【必須出力JSONスキーマ】
{
  "regionHint": "最有力候補の都道府県および市区町村（例: 京都府京都市山科区）",
  "suggestions": [
    {
      "region": "都道府県および市区町村（例: 京都府京都市山科区 / 大阪府高槻市 / 東京都豊島区）",
      "regionLabel": "短い地域ラベル（例: 京都山科 / 大阪高槻 / 東京豊島）",
      "formalStationName": "正式駅名またはバス停名（例: 大塚（バス停） / 大塚駅）",
      "lineName": "所属路線名またはバス運行会社（例: 京阪バス / 高槻市営バス / JR山手線）",
      "type": "jr または private_rail または subway または bus",
      "description": "補足説明"
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
          const suggestions: StationSuggestion[] = (parsed.suggestions || []).map((item: any) => ({
            region: item.region || '',
            regionLabel: item.regionLabel || (item.region ? item.region.slice(0, 4) : '全国'),
            formalStationName: item.formalStationName || clean,
            lineName: item.lineName || '各社路線',
            type: item.type || 'jr',
            description: item.description || ''
          }));

          // 住所スコアでソート
          suggestions.sort((a, b) => {
            const scoreA = calculateRegionMatchScore(a.region, contextAddress);
            const scoreB = calculateRegionMatchScore(b.region, contextAddress);
            return scoreB - scoreA;
          });

          return {
            regionHint: parsed.regionHint || suggestions[0]?.region || '',
            suggestions
          };
        }
      }
    } catch (err) {
      console.warn('Gemini resolveStationSuggestions failed:', err);
    }
  }

  // 3. フォールバック
  const baseName = clean.replace(/[駅バス停]/g, '');
  return {
    regionHint: `${baseName} エリア`,
    suggestions: [
      {
        region: '',
        regionLabel: '全国',
        formalStationName: `${baseName}駅`,
        lineName: 'JR線 / 各社鉄道線',
        type: 'jr',
        description: '最寄鉄道駅'
      },
      {
        region: '',
        regionLabel: '全国',
        formalStationName: `${baseName}（バス停）`,
        lineName: '各社路線バス',
        type: 'bus',
        description: '最寄路線バス停'
      }
    ]
  };
}
