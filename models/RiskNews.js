const mongoose = require('mongoose');
const RiskNewsSchema = new mongoose.Schema({
  title: String,
  link: { type: String, unique: true },
  description: String,
  pubDate: String,
  keyword: String,
  createdAt: { type: Date, default: Date.now },
  
  // AI 분석 결과 필드들
  aiSummary: String,           // AI 요약
  importanceScore: Number,     // 중요도 점수 (1-10)
  sentiment: {                 // 감정 분석
    type: String,              // 'positive', 'negative', 'neutral'
    score: Number              // 감정 점수 (-1 to 1)
  },
  source: String,              // 출처 (언론사)
  relatedKeywords: [String],   // 관련 키워드
  trendAnalysis: String,       // 트렌드 분석
  futureOutlook: String,       // 향후 전망
  aiGeneratedAt: Date,        // AI 분석 시간
  analysisModel: String        // 사용된 AI 모델
});
module.exports = mongoose.model('RiskNews', RiskNewsSchema); 