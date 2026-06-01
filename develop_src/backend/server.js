require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/database');
const reportsRouter    = require('./routes/reports');
const analyzeRouter    = require('./routes/analyze');
const consensusRouter  = require('./routes/consensus');
const reflectionRouter = require('./routes/reflection');
const utilsRouter      = require('./routes/utils');
const pdfRouter        = require('./routes/pdf');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/reports',    reportsRouter);
app.use('/api/analyze',    analyzeRouter);
app.use('/api/consensus',  consensusRouter);
app.use('/api/reflection', reflectionRouter);
app.use('/api/utils',      utilsRouter);
app.use('/api/pdf',        pdfRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`백엔드 서버 실행 중: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('서버 시작 실패:', err.message);
    process.exit(1);
  }
}

start();
