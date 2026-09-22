/**
 * 📮 郵便番号（7桁）から住所漢字および住所フリガナ（カタカナ）を自動検索・補完する共通ヘルパー
 */
export async function searchAddressFromZip(zip: string): Promise<{ address: string; addressKana: string } | null> {
  const clean = (zip || '').replace(/[^0-9]/g, '');
  if (clean.length !== 7) return null;

  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results[0]) {
      const r = data.results[0];
      const address = `${r.address1 || ''}${r.address2 || ''}${r.address3 || ''}`;
      const addressKana = `${r.kana1 || ''}${r.kana2 || ''}${r.kana3 || ''}`;
      return { address, addressKana };
    }
  } catch (e) {
    console.warn('Zipcode lookup error:', e);
  }
  return null;
}
