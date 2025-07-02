const express = require('express');
const router = express.Router();
const UserActionLog = require('../models/UserActionLog');

// 액션 기록
router.post('/log/action', async (req, res) => {
  try {
    const { type, action, userId, userAgent, meta } = req.body;
    const log = new UserActionLog({ type, action, userId, userAgent, meta });
    await log.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '기록 실패', detail: err.message });
  }
});

// 통계 집계 (기간/명령어/카테고리별)
router.get('/stats/summary', async (req, res) => {
  try {
    const { start, end, type } = req.query;
    const match = {};
    if (start) match.timestamp = { $gte: new Date(start) };
    if (end) {
      match.timestamp = match.timestamp || {};
      match.timestamp.$lte = new Date(end);
    }
    if (type) match.type = type;
    const group = {
      _id: { type: '$type', action: '$action' },
      count: { $sum: 1 }
    };
    const result = await UserActionLog.aggregate([
      { $match: match },
      { $group: group },
      { $sort: { 'count': -1 } }
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '집계 실패', detail: err.message });
  }
});

module.exports = router; 