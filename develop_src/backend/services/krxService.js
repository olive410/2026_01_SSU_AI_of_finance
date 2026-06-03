const axios = require('axios');

const KRX_API_URL = 'https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd';

// 특정 종목·날짜의 KRX 종가 조회
async function getClosingPrice(stockCode, dateStr) {
  const apiKey = process.env.KRX_API_KEY;
  if (!apiKey || apiKey === '****') {
    throw new Error('KRX_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }

  const trdDd = dateStr.replace(/-/g, ''); // YYYY-MM-DD → YYYYMMDD
  try {
    const res = await axios.get(KRX_API_URL, {
      params: {
        AUTH_KEY: apiKey,
        ISU_CD:   stockCode,
        TRD_DD:   trdDd,
      },
      timeout: 15000,
    });

    const block = res.data?.OutBlock_1;
    if (!block || block.length === 0) return null;

    const closeStr = block[0].TDD_CLSPRC;
    if (!closeStr) return null;

    const price = parseInt(closeStr.replace(/,/g, ''), 10);
    return isNaN(price) ? null : price;
  } catch (e) {
    console.warn(`[KRX] 종가 조회 실패 ${stockCode} ${dateStr}: ${e.message}`);
    return null;
  }
}

// D+5 영업일 종가 조회 (달력 7일부터 시작, 최대 5회 시도)
async function getD5ClosingPrice(stockCode, d0DateStr) {
  const d0 = new Date(d0DateStr);

  for (let offset = 7; offset <= 11; offset++) {
    const d = new Date(d0);
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);

    const price = await getClosingPrice(stockCode, dateStr);
    if (price && price > 0) {
      return { date: dateStr, price };
    }
  }
  return null; // 영업일 데이터 없음
}

module.exports = { getClosingPrice, getD5ClosingPrice };
