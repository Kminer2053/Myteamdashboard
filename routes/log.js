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

    // 전체 명령어/액션 목록 (고정값)
    const ALL_ACTIONS = [
      { type: 'kakao', action: '스케줄공지' },
      { type: 'kakao', action: '리스크' },
      { type: 'kakao', action: '제휴' },
      { type: 'kakao', action: '기술' },
      { type: 'kakao', action: '일정' },
      { type: 'kakao', action: '뉴스' },
      { type: 'kakao', action: '도움말' },
      { type: 'kakao', action: '기타' },
      { type: 'dashboard', action: '리스크이슈정보갱신' },
      { type: 'dashboard', action: '제휴처탐색정보갱신' },
      { type: 'dashboard', action: '신기술동향정보갱신' },
      { type: 'admin', action: '리스크키워드추가' },
      { type: 'admin', action: '제휴조건추가' },
      { type: 'admin', action: '신기술주제추가' },
      { type: 'admin', action: '뉴스갱신시간변경' },
      { type: 'admin', action: 'DB설정저장' },
      { type: 'admin', action: '통계메일저장' },
      { type: 'perplexity', action: '퍼플렉시티리스크뉴스수집' },
      { type: 'perplexity', action: '퍼플렉시티제휴처뉴스수집' },
      { type: 'perplexity', action: '퍼플렉시티기술뉴스수집' },
      { type: 'perplexity', action: '퍼플렉시티AI분석보고서생성' },
      { type: 'db', action: '자동삭제' }
    ];

    const group = {
      _id: { type: '$type', action: '$action' },
      count: { $sum: 1 }
    };
    const result = await UserActionLog.aggregate([
      { $match: match },
      { $group: group },
      { $sort: { 'count': -1 } }
    ]);

    // 누락된 명령어/액션은 count:0으로 추가
    const merged = ALL_ACTIONS.map(item => {
      const found = result.find(r => r._id.type === item.type && r._id.action === item.action);
      return found || { _id: item, count: 0 };
    });

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: '집계 실패', detail: err.message });
  }
});

module.exports = router; 