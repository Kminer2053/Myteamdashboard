const mongoose = require('mongoose');
const PartnerNewsSchema = new mongoose.Schema({
  title: String,
  link: { type: String, unique: true },
  description: String,
  pubDate: String,
  keyword: String,
  createdAt: { type: Date, default: Date.now },
  
  // AI 분석 결과 필드들
  aiSummary: String,           // AI 요약
  source: String,              // 출처 (언론사)
  relatedKeywords: [String],   // 관련 키워드
  aiGeneratedAt: Date,        // AI 분석 시간
  analysisModel: String        // 사용된 AI 모델
});
module.exports = mongoose.model('PartnerNews', PartnerNewsSchema); 