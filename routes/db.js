const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DBUsageSetting = require('../models/DBUsageSetting');
const RiskNews = require('../models/RiskNews');
const PartnerNews = require('../models/PartnerNews');
const TechNews = require('../models/TechNews');

// DB 사용량 조회 (MB)
router.get('/db/usage', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    const usedMB = (stats.dataSize + stats.indexSize) / (1024 * 1024);
    res.json({ usedMB: Math.round(usedMB * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: 'DB 사용량 조회 실패', detail: err.message });
  }
});

// 제한/삭제량 설정 조회
router.get('/db/setting', async (req, res) => {
  const setting = await DBUsageSetting.findOne().sort({ updatedAt: -1 });
  res.json(setting || {});
});

// 제한/삭제량 설정 저장
router.post('/db/setting', async (req, res) => {
  const { limitMB, deleteMB } = req.body;
  const setting = new DBUsageSetting({ limitMB, deleteMB });
  await setting.save();
  res.json({ success: true });
});

// 자동 삭제 함수 (내보내기)
async function autoDeleteOldData() {
  const setting = await DBUsageSetting.findOne().sort({ updatedAt: -1 });
  if (!setting) return;
  const db = mongoose.connection.db;
  const stats = await db.stats();
  let usedMB = (stats.dataSize + stats.indexSize) / (1024 * 1024);
  if (usedMB < setting.limitMB) return;
  let deleted = 0;
  // 각 컬렉션에서 오래된 데이터부터 삭제 (deleteMB만큼)
  for (const Model of [RiskNews, PartnerNews, TechNews]) {
    let freed = 0;
    while (freed < setting.deleteMB) {
      const oldest = await Model.find().sort({ _id: 1 }).limit(100);
      if (oldest.length === 0) break;
      const ids = oldest.map(d => d._id);
      await Model.deleteMany({ _id: { $in: ids } });
      freed += 0.1 * oldest.length; // rough estimate: 0.1MB per doc
      deleted += oldest.length;
      // 실제 freed 계산은 stats로 재확인 필요
      const statsNow = await db.stats();
      usedMB = (statsNow.dataSize + statsNow.indexSize) / (1024 * 1024);
      if (usedMB < setting.limitMB) break;
    }
  }
  return deleted;
}

module.exports = { router, autoDeleteOldData }; 