// §12.2 GET /api/consensus/:stock_code
const express = require('express');
const router = express.Router();
const { buildConsensus } = require('../services/consensusService');

router.get('/:stock_code', async (req, res) => {
  try {
    const { stock_code } = req.params;
    const result = await buildConsensus(stock_code);
    if (!result) {
      return res.status(404).json({ success: false, error: '해당 종목 리포트 없음 (최근 90일)' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
