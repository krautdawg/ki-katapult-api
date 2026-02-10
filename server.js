const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['https://ki-katapult.de', 'https://www.ki-katapult.de', 'http://localhost:3000'],
  methods: ['POST']
}));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Rate limiting (simple in-memory)
const submissions = {};
const RATE_LIMIT_MS = 60000; // 1 per minute per IP

app.post('/contact', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const now = Date.now();
  if (submissions[ip] && now - submissions[ip] < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  submissions[ip] = now;

  const { name, email, serverInfo, needsServer, channels, useCase } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const body = [
    `🤖 Neue OpenClaw Setup Anfrage`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    `Server Info: ${serverInfo || 'Nicht angegeben'}`,
    `Server-Setup benötigt: ${needsServer ? 'Ja (+150€)' : 'Nein'}`,
    `Messenger: ${channels || 'Nicht angegeben'}`,
    ``,
    `Use Case:`,
    useCase || 'Nicht angegeben',
    ``,
    `---`,
    `Gesendet über ki-katapult.de/openclaw-setup/`
  ].join('\n');

  try {
    await transporter.sendMail({
      from: `"OpenClaw Setup" <${process.env.FROM_EMAIL || 'tim@ki-katapult.de'}>`,
      to: process.env.TO_EMAIL || 'bot@ki-katapult.de',
      cc: process.env.CC_EMAIL || 'tim@ki-katapult.de',
      replyTo: email,
      subject: `OpenClaw Setup Anfrage von ${name}`,
      text: body
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send. Please try again.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
