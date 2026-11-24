require('dotenv').config();
const express = require('express'); const cors = require('cors'); const helmet = require('helmet');
const morgan = require('morgan'); const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db'); const { notFound, errorHandler } = require('./middleware/error');
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is not set. Copy .env.example to .env.'); process.exit(1); }
const isProduction = process.env.NODE_ENV === 'production';
const app = express();
const assessmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { message: 'Too many assessment requests. Please try again later.' },
});
app.use(helmet(), cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }), express.json({ limit: '1mb' }), morgan('dev'));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 50 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { message: 'Too many attempts. Try again later.' },
}));
app.use('/api/assessment', assessmentLimiter);
app.use('/api/assessments', assessmentLimiter);
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api', require('./routes'));
app.use(notFound, errorHandler);
connectDB().then(() => {
  const port = process.env.PORT || 5000;
  const server = app.listen(port, () => console.log('API on :' + port));
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
})
  .catch((e) => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });
