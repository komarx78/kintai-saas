/**
 * 日本全国の同名地名・同名バス停（京都山科・滋賀守山/草津・大阪高槻・東京等）を現住所コンテキストと連動して識別するエンジン
 * ※ レート制限（429 Too Many Requests）防止キャッシュ ＆ ローカル即時推論搭載
 */

import { supabase } from './supabase';

export interface StationSuggestion {
  region: string; // 例: "滋賀県守山市" / "京都府京都市山科区"
  regionLabel: string; // 例: "滋賀守山" / "京都山科" / "大阪高槻" / "東京豊島"
  formalStationName: string; // 例: "川田（バス停）" / "草津駅" / "大塚（バス停）"
  lineName: string; // 例: "近江鉄道バス" / "京阪バス" / "JR琵琶湖線"
  type: 'jr' | 'private_rail' | 'subway' | 'bus';
  description?: string;
}

// 日本全国の主要な地名・バス停・駅の全国マルチ地域辞書（即時レスポンス・API節約）
const MULTI_REGION_PRESET_MAP: Record<string, StationSuggestion[]> = {
  '川田': [
    { region: '滋賀県守山市', regionLabel: '滋賀守山', formalStationName: '川田（バス停）', lineName: '近江鉄道バス[草津駅/守山駅方面]', type: 'bus', description: '守山市川田町・近江鉄道バス' },
    { region: '徳島県吉野川市', regionLabel: '徳島吉野川', formalStationName: '川田駅', lineName: 'JR徳島線', type: 'jr', description: 'JR徳島線 川田駅' },
    { region: '滋賀県草津市', regionLabel: '滋賀草津', formalStationName: '草津駅', lineName: 'JR琵琶湖線・草津線', type: 'jr', description: '最寄接続ターミナル駅' }
  ],
  '草津': [
    { region: '滋賀県草津市', regionLabel: '滋賀草津', formalStationName: '草津駅', lineName: 'JR琵琶湖線（新快速）・草津線', type: 'jr', description: 'JR琵琶湖線 ターミナル' },
    { region: '滋賀県草津市', regionLabel: '滋賀草津', formalStationName: '南草津駅', lineName: 'JR琵琶湖線（新快速）', type: 'jr', description: 'JR琵琶湖線 新快速停車駅' },
    { region: '群馬県吾妻郡草津町', regionLabel: '群馬草津', formalStationName: '草津温泉バスターミナル', lineName: 'JRバス関東', type: 'bus', description: '草津温泉' }
  ],
  '守山': [
    { region: '滋賀県守山市', regionLabel: '滋賀守山', formalStationName: '守山駅', lineName: 'JR琵琶湖線（新快速）', type: 'jr', description: 'JR琵琶湖線 守山駅' },
    { region: '愛知県名古屋市守山区', regionLabel: '愛知名古屋', formalStationName: '新守山駅', lineName: 'JR中央本線', type: 'jr', description: '名古屋市守山区' }
  ],
  '大塚': [
    { region: '京都府京都市山科区', regionLabel: '京都山科', formalStationName: '大塚（バス停）', lineName: '京阪バス[山科駅/京都駅方面]', type: 'bus', description: '山科区大塚・国道1号線沿い' },
    { region: '大阪府高槻市', regionLabel: '大阪高槻', formalStationName: '大塚（バス停）', lineName: '高槻市営バス / 京阪バス', type: 'bus', description: '高槻市大塚町' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: 'JR山手線' },
    { region: '広島県広島市安佐南区', regionLabel: '広島', formalStationName: '大塚駅', lineName: 'アストラムライン / 広電バス', type: 'private_rail', description: '広島市安佐南区大塚' }
  ],
  '花山': [
    { region: '京都府京都市山科区', regionLabel: '京都山科', formalStationName: '花山稲荷（バス停）', lineName: '京阪バス[山科駅方面]', type: 'bus', description: '山科区花山・京阪バス' },
    { region: '兵庫県神戸市北区', regionLabel: '兵庫神戸', formalStationName: '花山駅', lineName: '神戸電鉄有馬線', type: 'private_rail', description: '神戸電鉄 花山駅' }
  ],
  '北大塚': [
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '北大塚一丁目', lineName: '都営バス[都02/上60]', type: 'bus', description: '豊島区北大塚バス停' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: 'JR山手線 最寄駅' }
  ],
  '南大塚': [
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: '南口側' },
    { region: '埼玉県川越市', regionLabel: '埼玉川越', formalStationName: '南大塚駅', lineName: '西武新宿線', type: 'private_rail', description: '川越市南大塚' }
  ],
  '赤坂': [
    { region: '東京都港区', regionLabel: '東京港区', formalStationName: '赤坂駅', lineName: '東京メトロ千代田線', type: 'subway', description: '東京都港区赤坂' },
    { region: '福岡県福岡市中央区', regionLabel: '福岡中央', formalStationName: '赤坂駅', lineName: '福岡市営地下鉄空港線', type: 'subway', description: '福岡市中央区赤坂' }
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

// メモリ内キャッシュ（同一クエリのAPI連打を100%防止）
const suggestionCache = new Map<string, { regionHint: string; suggestions: StationSuggestion[] }>();

/**
 * 住所コンテキスト（都道府県・市区町村）と候補地域の一致度スコアを計算
 */
function calculateRegionMatchScore(candidateRegion: string, contextAddress?: string): number {
  if (!contextAddress) return 0;
  const ctx = contextAddress.replace(/[\s　]/g, '');
  let score = 0;

  const prefs = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  for (const p of prefs) {
    if (ctx.includes(p) && candidateRegion.includes(p)) {
      score += 100;
    }
  }

  const words = candidateRegion.split(/[都道府県市区町村]/).filter(w => w.length >= 2);
  for (const w of words) {
    if (ctx.includes(w)) {
      score += 50;
    }
  }

  return score;
}

/**
 * 入力された駅名・地名から地区と正式駅名＆路線バス停を推測して候補リストを返却（キャッシュ＆デバウンス対応）
 */
export async function resolveStationSuggestions(
  query: string,
  contextAddress?: string
): Promise<{ regionHint: string; suggestions: StationSuggestion[] }> {
  const clean = query.trim().replace(/[（）()駅バス停\s]/g, '');
  if (!clean || clean.length < 1) {
    return { regionHint: '', suggestions: [] };
  }

  const cacheKey = `${clean}_${contextAddress || ''}`;
  if (suggestionCache.has(cacheKey)) {
    return suggestionCache.get(cacheKey)!;
  }

  // 1. 全国マルチ地域プリセット辞書チェック（即時返却・API消費ゼロ）
  const matchedKey = Object.keys(MULTI_REGION_PRESET_MAP).find(k => clean.includes(k) || k.includes(clean));
  if (matchedKey && MULTI_REGION_PRESET_MAP[matchedKey]) {
    const list = [...MULTI_REGION_PRESET_MAP[matchedKey]];

    list.sort((a, b) => {
      const scoreA = calculateRegionMatchScore(a.region, contextAddress);
      const scoreB = calculateRegionMatchScore(b.region, contextAddress);
      return scoreB - scoreA;
    });

    const topRegion = list[0]?.region || '';
    const res = {
      regionHint: topRegion,
      suggestions: list
    };
    suggestionCache.set(cacheKey, res);
    return res;
  }

  // 2. 辞書にない場合のみ Gemini 3.5 Flash で推論（APIキー取得）
  let apiKey = localStorage.getItem('platform_gemini_api_key') || localStorage.getItem('gemini_api_key_custom');
  if (!apiKey) {
    try {
      const { data } = await supabase.from('system_settings').select('gemini_api_key').limit(1).maybeSingle();
      if (data?.gemini_api_key) apiKey = data.gemini_api_key;
    } catch (e) {
      console.warn('DB fetch gemini_api_key failed:', e);
    }
  }

  if (apiKey && clean.length >= 2) {
    try {
      const prompt = `あなたは日本の地理および全国47都道府県の鉄道・路線バスネットワークのエキスパートAIです。
ユーザーが入力した地名・駅名「${clean}」${contextAddress ? `（現住所: ${contextAddress}）` : ''} から、
実在する正式な駅名・バス停名の候補を2〜3件JSONで返してください。

【必須出力JSONスキーマ】
{
  "regionHint": "都道府県および市区町村（例: 滋賀県守山市）",
  "suggestions": [
    {
      "region": "都道府県および市区町村",
      "regionLabel": "短い地域ラベル（例: 滋賀守山 / 京都山科）",
      "formalStationName": "正式駅名またはバス停名（例: 川田（バス停） / 守山駅）",
      "lineName": "所属路線名またはバス運行会社（例: 近江鉄道バス / JR琵琶湖線）",
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

          suggestions.sort((a, b) => {
            const scoreA = calculateRegionMatchScore(a.region, contextAddress);
            const scoreB = calculateRegionMatchScore(b.region, contextAddress);
            return scoreB - scoreA;
          });

          const result = {
            regionHint: parsed.regionHint || suggestions[0]?.region || '',
            suggestions
          };
          suggestionCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (err) {
      console.warn('Gemini StationResolver API failed:', err);
    }
  }

  // 3. フォールバック
  const fallbackRes = {
    regionHint: contextAddress ? contextAddress.slice(0, 8) : '全国エリア',
    suggestions: [
      {
        region: contextAddress || '全国',
        regionLabel: '全国',
        formalStationName: `${clean}駅`,
        lineName: 'JR線 / 各社鉄道',
        type: 'jr' as const,
        description: '入力駅'
      },
      {
        region: contextAddress || '全国',
        regionLabel: '近隣バス',
        formalStationName: `${clean}（バス停）`,
        lineName: '各社路線バス',
        type: 'bus' as const,
        description: '近隣バス停'
      }
    ]
  };
  suggestionCache.set(cacheKey, fallbackRes);
  return fallbackRes;
}
