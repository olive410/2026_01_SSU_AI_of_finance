const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DOWNLOADS_DIR = 'C:\\Users\\user\\Downloads';
const DATA_SRC_DIR  = 'C:\\Users\\user\\ih_dev\\ih_dev_01\\data_src';

router.post('/move-pdfs', async (req, res) => {
  try {
    if (!fs.existsSync(DATA_SRC_DIR)) {
      fs.mkdirSync(DATA_SRC_DIR, { recursive: true });
    }

    const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
      return res.json({ moved: [], message: '이동할 PDF 파일이 없습니다.' });
    }

    const moved = [];
    const errors = [];

    for (const file of files) {
      const src  = path.join(DOWNLOADS_DIR, file);
      const dest = path.join(DATA_SRC_DIR, file);
      try {
        fs.renameSync(src, dest);
        moved.push(file);
      } catch (e) {
        errors.push({ file, error: e.message });
      }
    }

    res.json({ moved, errors, message: `${moved.length}개 파일을 저장소로 이동했습니다.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
