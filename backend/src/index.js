const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/schema');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Initialize DB on startup
getDb();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/pair', require('./routes/pair'));
app.use('/api/devices', require('./routes/screen'));
app.use('/api/devices', require('./routes/import'));
app.use('/api/install', require('./routes/install'));
// DNS-over-HTTPS resolver used by mobileconfig profiles
app.use('/api/dns', (req, res, next) => {
  req.url = '/dns' + req.url;
  require('./routes/install')(req, res, next);
});

// Serve downloadable installer files
app.use('/download', express.static(path.join(__dirname, '../../downloads')));

app.get('/api/health', (req, res) => res.json({ ok: true, version: '1.0.0' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Oversight backend running on port ${PORT}`));
