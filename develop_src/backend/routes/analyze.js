const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { extractTextFromPdf } = require('../services/pdfParser');
const { analyzeReport } = require('../services/claudeService');
const { calculateScore } = require('../services/scoreCalculator');
const { saveReport, saveRisks, getReportByFilename } = require('../services/reportService');

const DATA_SRC_PATH =
  process.env.DATA_SRC_PATH ||
  path.resolve(__dirname, '..', '..', '..', 'data_src');

router.post('/', async (req, res) => {
  try {
    if (!fs.existsSync(DATA_SRC_PATH)) {
      return res.status(400).json({
        success: false,
        error: `data_src 폴더를 찾을 수 없습니다: ${DATA_SRC_PATH}`,
      });
    }

    // 당일 수정된 PDF만 대상
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const allPdfs = fs.readdirSync(DATA_SRC_PATH).filter(f => f.toLowerCase().endsWith('.pdf'));
    const todayFiles = allPdfs.filter(f => {
      const stat = fs.statSync(path.join(DATA_SRC_PATH, f));
      return stat.mtime >= todayStart;
    });

    if (todayFiles.length === 0) {
      return res.json({
        success: true,
        message: `오늘 수정된 PDF 파일이 없습니다. (전체 ${allPdfs.length}개 중 당일 파일 0개)`,
        results: [],
        total: 0, succeeded: 0, failed: 0, skipped: 0,
      });
    }

    const results = [];

    for (const file of todayFiles) {
      const filePath = path.join(DATA_SRC_PATH, file);

      // stock_name이 있는 레코드만 스킵 (null이면 재분석)
      const existing = await getReportByFilename(file);
      if (existing && existing.stock_name) {
        console.log(`스킵 (기분석 완료): ${file}`);
        results.push({ file, success: true, skipped: true, reason: '기분석 완료' });
        continue;
      }

      console.log(`분석 중: ${file}`);
      try {
        const text = await extractTextFromPdf(filePath);
        const analysis = await analyzeReport(text);
        const scored = calculateScore(analysis);

        const saved = await saveReport(file, {
          ...analysis,
          ...scored,
          opinion_analyst: analysis.opinion_analyst || null,
        });

        if (saved && Array.isArray(analysis.risks)) {
          await saveRisks(saved.id, analysis.risks);
        }

        results.push({ file, success: true, skipped: false, data: saved });
        console.log(`완료: ${file} → ${analysis.stock_name} (${analysis.opinion_analyst}) score:${scored.score}`);
      } catch (err) {
        console.error(`실패: ${file} → ${err.message}`);
        results.push({ file, success: false, skipped: false, error: err.message });
      }
    }

    const newResults  = results.filter(r => !r.skipped);
    const succeeded   = newResults.filter(r => r.success).length;
    const failed      = newResults.filter(r => !r.success).length;
    const skipped     = results.filter(r => r.skipped).length;

    res.json({
      success: true,
      total: todayFiles.length,
      succeeded,
      failed,
      skipped,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
