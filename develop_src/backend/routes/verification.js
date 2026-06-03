const express = require('express');
const router = express.Router();
const { runVerification, getVerificationStats } = require('../services/verificationService');

// KRX D+5 검증 실행
router.post('/run', async (req, res) => {
  try {
    const result = await runVerification();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 검증 현황 요약
router.get('/status', async (req, res) => {
  try {
    const stats = await getVerificationStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
