const mongoose = require('mongoose');
const PartnerNewsSchema = new mongoose.Schema({
  title: String,
  link: { type: String, unique: true },
  description: String,
  pubDate: String,
  keyword: String,
  source: String,           // 언론사/출처 추가
  relatedKeywords: [String], // 관련 키워드 배열 추가
  analysisModel: String,    // AI 모델명 추가
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('PartnerNews', PartnerNewsSchema); 