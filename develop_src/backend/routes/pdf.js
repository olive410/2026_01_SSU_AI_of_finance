const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_SRC_PATH = path.resolve(__dirname, '..', '..', '..', 'data_src');

router.get('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // path traversal 방지
  if (!filename.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({ error: 'PDF 파일만 허용됩니다' });
  }
  const filePath = path.join(DATA_SRC_PATH, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
