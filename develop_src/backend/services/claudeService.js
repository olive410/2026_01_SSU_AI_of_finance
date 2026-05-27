const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getClaudePath() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
    'claude',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'claude';
}

const CLAUDE_BIN = getClaudePath();
console.log(`[Claude] CLI 경로: ${CLAUDE_BIN}`);

// §4 권장 v2 프롬프트 (PROMPT_GUIDE.md 기준)
const SYSTEM_CONTEXT = `당신은 한국 증권사 애널리스트 리포트를 분석하는 전문 AI입니다.
아래 리포트 텍스트를 읽고 핵심 정보를 추출하여 **단일 JSON 객체**만 반환하세요.

# 출력 스키마 (필수)
{
  "stock_name": "종목명(한국어 정식 명칭)",
  "stock_code": "6자리 종목코드 문자열 (예: \\"005930\\")",
  "target_price": 정수(원 단위, 콤마 없음, 예: 169000),
  "previous_target_price": 직전 목표주가 정수 또는 null,
  "target_price_change": "up" | "flat" | "down" | null,
  "current_price": 현재주가 정수(리포트에 명시된 기준주가/현재가, 없으면 null),
  "report_date": "YYYY-MM-DD",
  "opinion_analyst": "Buy" | "Hold" | "Sell",
  "author": "작성 애널리스트 이름",
  "securities_firm": "발행 증권사명",
  "summary": "투자 포인트 2~3문장 한국어 요약. 괴리율이 계산 가능하면 상승 여력을 포함하세요.",
  "risks": [
    {
      "type": "Macro" | "Industry" | "Company",
      "sentence": "리포트에서 발췌한 원문 (50자 이내)"
    }
  ]
}

# 위치 힌트
- stock_name/stock_code/target_price/opinion_analyst: 리포트 첫 페이지 표지
- author/securities_firm: 표지 또는 마지막 페이지 책임 고지
- report_date: 표지의 발간일/작성일 (공시일 아님)
- current_price: 표지의 현재가/기준가 항목
- risks: 본문 전체에서 발췌 — "리스크 요인", "투자 위험", "단점", "우려" 섹션 우선

# 정규화 규칙
1. target_price
   - "16.9만원" → 169000, "169,000원" → 169000, "169천원" → 169000
   - 범위(150,000~170,000) → 상단값 사용
2. previous_target_price / target_price_change
   - "TP 16.9만원 → 19만원" 패턴 발견 시: previous_target_price=169000, target_price=190000, target_price_change="up"
   - "유지", "Maintain"이면서 직전값 명시 없음: target_price_change="flat"
   - 명시 정보 없으면 둘 다 null
3. opinion_analyst (대소문자 무관)
   - 매수/BUY/비중확대/Overweight/Strong Buy → "Buy"
   - 중립/HOLD/Neutral/Marketperform → "Hold"
   - 매도/SELL/비중축소/Underweight/Reduce → "Sell"
4. report_date: "2026/05/14", "2026.5.14" → "2026-05-14"
5. stock_code: 6자리 zero-padding ("5930" → "005930")

# 리스크 분류 기준
- Macro: 금리, 환율, 인플레이션, 경기침체, 지정학, 원자재가, 정책/규제
- Industry: 업황 둔화, 경쟁 심화, 기술 변화, 공급망, 산업 사이클
- Company: 실적 부진, 비용 증가, 경영진/지배구조, 소송, 사업부 문제

# 리스크 추출 규칙
- 리스크/우려/단점/주의/위험 관련 문장만 추출, 최대 5개, 중요도 순
- 호재/긍정 문장 제외, 동일 유형 중복 시 가장 구체적인 1개만
- 리스크가 없으면 빈 배열 []

# 절대 금지
- 마크다운 코드블럭(\`\`\`)으로 감싸지 마세요
- 설명, 인사말, 접두어("분석 결과:") 금지
- 추측 금지: 명시되지 않은 항목은 null
- 여러 종목 비교 리포트면 표지 대표 종목 1개만

# 출력 예시 (Few-shot)
{"stock_name":"한국금융지주","stock_code":"071050","target_price":365000,"previous_target_price":340000,"target_price_change":"up","current_price":295000,"report_date":"2026-05-14","opinion_analyst":"Buy","author":"조아해","securities_firm":"메리츠증권","summary":"2026년 실적 호조와 카카오뱅크 가치 재평가로 목표가 상향. 현재주가 대비 약 23.7% 상승 여력 존재. 다만 금리 인하 시 NIM 축소 가능성 있음.","risks":[{"type":"Macro","sentence":"기준금리 인하 시 순이자마진 축소 우려"},{"type":"Industry","sentence":"증권업 위탁수수료 경쟁 심화"},{"type":"Company","sentence":"부동산 PF 익스포저 관련 충당금 증가 가능"}]}`;

const MAX_INPUT_CHARS = 7500;  // Few-shot 추가로 8500 → 7500 (§13.2)

async function analyzeReport(pdfText) {
  const prompt = `${SYSTEM_CONTEXT}\n\n===분석 대상 리포트===\n${pdfText.slice(0, MAX_INPUT_CHARS)}`;

  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: CLAUDE_BIN.endsWith('.cmd'),
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude 응답 시간 초과 (90초)'));
    }, 90000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', () => {
      clearTimeout(timer);
      if (!stdout.trim()) {
        return reject(new Error('Claude 응답 없음: ' + stderr.slice(0, 200)));
      }
      // §9/§13.3: 마지막 JSON 매칭 (Few-shot 예시 JSON 오인 방지)
      const matches = stdout.match(/\{[\s\S]*?\}/g);
      if (!matches) {
        return reject(new Error('JSON 없음: ' + stdout.slice(0, 300)));
      }
      try {
        resolve(JSON.parse(matches[matches.length - 1]));
      } catch (e) {
        reject(new Error('JSON 파싱 실패: ' + e.message));
      }
    });

    child.on('error', err => {
      clearTimeout(timer);
      reject(new Error(`claude 실행 오류 (${CLAUDE_BIN}): ${err.message}`));
    });
  });
}

module.exports = { analyzeReport };
