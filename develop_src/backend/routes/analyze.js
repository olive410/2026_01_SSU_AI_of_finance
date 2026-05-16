const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { extractTextFromPdf } = require('../services/pdfParser');
const { analyzeReport } = require('../services/claudeService');
const { saveReport } = require('../services/reportService');

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
        const saved = await saveReport(file, analysis);
        results.push({ file, success: true, data: saved });
        console.log(`완료: ${file} → ${analysis.stock_name} (${analysis.opinion})`);
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
