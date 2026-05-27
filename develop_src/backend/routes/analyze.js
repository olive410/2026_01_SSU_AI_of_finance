const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { extractTextFromPdf } = require('../services/pdfParser');
const { analyzeReport } = require('../services/claudeService');
const { calculateScore } = require('../services/scoreCalculator');
const { saveReport, saveRisks } = require('../services/reportService');

const DATA_SRC_PATH =
  process.env.DATA_SRC_PATH ||
  path.join(__dirname, '../../..', 'data_src');

router.post('/', async (req, res) => {
  try {
    if (!fs.existsSync(DATA_SRC_PATH)) {
      return res.status(400).json({
        success: false,
        error: `data_src 폴더를 찾을 수 없습니다: ${DATA_SRC_PATH}`,
      });
    }

    const files = fs.readdirSync(DATA_SRC_PATH).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
      return res.json({ success: true, message: 'PDF 파일이 없습니다', results: [] });
    }

    const results = [];

    for (const file of files) {
      const filePath = path.join(DATA_SRC_PATH, file);
      console.log(`분석 중: ${file}`);

      try {
        const text = await extractTextFromPdf(filePath);
        const analysis = await analyzeReport(text);

        // §6 점수 계산 (scoreCalculator로 분리)
        const scored = calculateScore(analysis);

        const saved = await saveReport(file, {
          ...analysis,
          ...scored,
          // v2 프롬프트 필드 매핑
          opinion_analyst: analysis.opinion_analyst || null,
        });

        // §11 report_risks 정규화 테이블에 저장
        if (saved && Array.isArray(analysis.risks)) {
          await saveRisks(saved.id, analysis.risks);
        }

        results.push({ file, success: true, data: saved });
        console.log(`완료: ${file} → ${analysis.stock_name} (${analysis.opinion_analyst}) score:${scored.score}`);
      } catch (err) {
        console.error(`실패: ${file} → ${err.message}`);
        results.push({ file, success: false, error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    res.json({
      success: true,
      total: files.length,
      succeeded,
      failed: files.length - succeeded,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
