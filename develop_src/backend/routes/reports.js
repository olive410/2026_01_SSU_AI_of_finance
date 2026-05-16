const express = require('express');
const router = express.Router();
const { getAllReports, getReportById } = require('../services/reportService');

router.get('/', async (req, res) => {
  try {
    const reports = await getAllReports();
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: '리포트를 찾을 수 없습니다' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
