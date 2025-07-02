const express = require('express');
const router = express.Router();
const StatMailSetting = require('../models/StatMailSetting');
const UserActionLog = require('../models/UserActionLog');
const nodemailer = require('nodemailer');

// 메일주소 저장
router.post('/mail/stat-setting', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: '이메일 필수' });
  const setting = new StatMailSetting({ email });
  await setting.save();
  res.json({ success: true });
});
// 메일주소 조회
router.get('/mail/stat-setting', async (req, res) => {
  const setting = await StatMailSetting.findOne().sort({ updatedAt: -1 });
  res.json(setting || {});
});

// 월말 통계 메일 발송 함수 (내보내기)
async function sendMonthlyStatMail() {
  const setting = await StatMailSetting.findOne().sort({ updatedAt: -1 });
  if (!setting || !setting.email) return;
  // 이번달 집계
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const logs = await UserActionLog.aggregate([
    { $match: { timestamp: { $gte: start, $lt: end } } },
    { $group: { _id: { type: '$type', action: '$action' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  let html = `<h3>${now.getFullYear()}년 ${now.getMonth() + 1}월 이용통계</h3><table border="1" cellpadding="5"><tr><th>구분</th><th>명령어/액션</th><th>건수</th></tr>`;
  logs.forEach(row => {
    html += `<tr><td>${row._id.type}</td><td>${row._id.action}</td><td>${row.count}</td></tr>`;
  });
  html += '</table>';
  html += '<br><a href="https://myteamdashboard.vercel.app/index.html">대시보드 바로가기</a>';
  // 메일 발송
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: setting.email,
    subject: `[대시보드] ${now.getFullYear()}년 ${now.getMonth() + 1}월 이용통계`,
    html
  });
}

module.exports = { router, sendMonthlyStatMail }; 