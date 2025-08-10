const mongoose = require('mongoose');
const PartnerNewsSchema = new mongoose.Schema({
  title: String,
  link: { type: String, unique: true },
  aiSummary: String,        // description → aiSummary로 통일
  pubDate: String,
  collectedDate: String,    // 수집일자 (YYYY-MM-DD 형식)
  keyword: String,
  source: String,           // 언론사/출처
  relatedKeywords: [String], // 관련 키워드 배열
  analysisModel: String,    // AI 모델명
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('PartnerNews', PartnerNewsSchema); 