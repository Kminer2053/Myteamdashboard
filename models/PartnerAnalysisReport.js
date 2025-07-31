const mongoose = require('mongoose');

const PartnerAnalysisReportSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  analysisDate: {
    type: Date,
    default: Date.now
  },
  summary: {
    type: String,
    required: true
  },
  totalNewsCount: {
    type: Number,
    default: 0
  },
  analysisModel: {
    type: String,
    default: 'perplexity-ai'
  }
});

// 복합 인덱스: 날짜별 빠른 조회
PartnerAnalysisReportSchema.index({ date: -1 });

module.exports = mongoose.model('PartnerAnalysisReport', PartnerAnalysisReportSchema); 