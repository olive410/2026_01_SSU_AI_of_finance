const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Claude Code CLI 실행 파일 경로 (Claude.ai Pro 인증 공유)
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

const SYSTEM_CONTEXT = `당신은 한국 증권사 애널리스트 리포트를 분석하는 전문 AI입니다.
리포트 텍스트에서 아래 정보를 추출하여 반드시 JSON 객체만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "stock_name": "종목명(회사명)",
  "stock_code": "종목코드(숫자만, 예:272210)",
  "target_price": 목표주가숫자(원단위정수, 예:169000),
  "report_date": "YYYY-MM-DD 형식 날짜",
  "opinion": "Buy 또는 Hold 또는 Sell 중 하나",
  "author": "작성 애널리스트 이름",
  "securities_firm": "발행 증권사명",
  "summary": "핵심 투자 포인트 2~3문장 한국어"
}

opinion 변환: 매수/BUY/비중확대→Buy, 중립/HOLD/Neutral→Hold, 비중축소/SELL→Sell
찾을 수 없는 항목은 null로 표기`;

async function analyzeReport(pdfText) {
  const prompt = `${SYSTEM_CONTEXT}\n\n===리포트 텍스트===\n${pdfText.slice(0, 8500)}`;

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
      const match = stdout.match(/\{[\s\S]*?\}/);
      if (!match) {
        return reject(new Error('JSON 없음: ' + stdout.slice(0, 300)));
      }
      try {
        resolve(JSON.parse(match[0]));
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
