const mongoose = require('mongoose');

const RiskAnalysisReportSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  analysisDate: {
    type: Date,
    default: Date.now
  },
  analysis: {              // summary → analysis로 통일
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
RiskAnalysisReportSchema.index({ date: -1 });

module.exports = mongoose.model('RiskAnalysisReport', RiskAnalysisReportSchema); 