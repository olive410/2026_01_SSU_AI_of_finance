const express = require('express');
const router = express.Router();
const { runReflection, getLatestReflections } = require('../services/reflectionService');

// 최근 반성 기록 조회
router.get('/', async (req, res) => {
  try {
    const logs = await getLatestReflections(5);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 반성 실행 (Claude 호출 포함, 수 분 소요 가능)
router.post('/run', async (req, res) => {
  try {
    const result = await runReflection();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
