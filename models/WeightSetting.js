const mongoose = require('mongoose');

const WeightSettingSchema = new mongoose.Schema({
  // 노출 지수 가중치
  exposure: {
    news: { type: Number, default: 0.3, min: 0, max: 1 },
    youtube: { type: Number, default: 0.2, min: 0, max: 1 },
    twitter: { type: Number, default: 0.2, min: 0, max: 1 },
    instagram: { type: Number, default: 0.15, min: 0, max: 1 },
    tiktok: { type: Number, default: 0.15, min: 0, max: 1 }
  },
  
  // 참여 지수 가중치
  engagement: {
    youtube: { type: Number, default: 0.25, min: 0, max: 1 },
    twitter: { type: Number, default: 0.25, min: 0, max: 1 },
    instagram: { type: Number, default: 0.25, min: 0, max: 1 },
    tiktok: { type: Number, default: 0.25, min: 0, max: 1 }
  },
  
  // 수요 지수 가중치
  demand: {
    naverTrend: { type: Number, default: 0.4, min: 0, max: 1 },
    youtube: { type: Number, default: 0.2, min: 0, max: 1 },
    twitter: { type: Number, default: 0.2, min: 0, max: 1 },
    instagram: { type: Number, default: 0.1, min: 0, max: 1 },
    tiktok: { type: Number, default: 0.1, min: 0, max: 1 }
  },
  
  // 종합 지수 가중치
  overall: {
    exposure: { type: Number, default: 0.4, min: 0, max: 1 },
    engagement: { type: Number, default: 0.35, min: 0, max: 1 },
    demand: { type: Number, default: 0.25, min: 0, max: 1 }
  },
  
  // 참여도 세부 가중치
  engagementDetail: {
    likes: { type: Number, default: 0.4, min: 0, max: 1 },
    comments: { type: Number, default: 0.3, min: 0, max: 1 },
    shares: { type: Number, default: 0.3, min: 0, max: 1 }
  },
  
  // 설정 메타데이터
  name: { type: String, default: '기본 설정' },
  description: { type: String, default: '기본 가중치 설정' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 가중치 합계 검증 미들웨어
WeightSettingSchema.pre('save', function(next) {
  // 노출 지수 가중치 합계 검증
  const exposureSum = Object.values(this.exposure).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(exposureSum - 1) > 0.01) {
    return next(new Error('노출 지수 가중치의 합이 1이어야 합니다.'));
  }
  
  // 참여 지수 가중치 합계 검증
  const engagementSum = Object.values(this.engagement).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(engagementSum - 1) > 0.01) {
    return next(new Error('참여 지수 가중치의 합이 1이어야 합니다.'));
  }
  
  // 수요 지수 가중치 합계 검증
  const demandSum = Object.values(this.demand).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(demandSum - 1) > 0.01) {
    return next(new Error('수요 지수 가중치의 합이 1이어야 합니다.'));
  }
  
  // 종합 지수 가중치 합계 검증
  const overallSum = Object.values(this.overall).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(overallSum - 1) > 0.01) {
    return next(new Error('종합 지수 가중치의 합이 1이어야 합니다.'));
  }
  
  // 참여도 세부 가중치 합계 검증
  const engagementDetailSum = Object.values(this.engagementDetail).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(engagementDetailSum - 1) > 0.01) {
    return next(new Error('참여도 세부 가중치의 합이 1이어야 합니다.'));
  }
  
  this.updatedAt = new Date();
  next();
});

// 가중치 정규화 메서드
WeightSettingSchema.methods.normalizeWeights = function() {
  // 노출 지수 가중치 정규화
  const exposureSum = Object.values(this.exposure).reduce((sum, weight) => sum + weight, 0);
  Object.keys(this.exposure).forEach(key => {
    this.exposure[key] = this.exposure[key] / exposureSum;
  });
  
  // 참여 지수 가중치 정규화
  const engagementSum = Object.values(this.engagement).reduce((sum, weight) => sum + weight, 0);
  Object.keys(this.engagement).forEach(key => {
    this.engagement[key] = this.engagement[key] / engagementSum;
  });
  
  // 수요 지수 가중치 정규화
  const demandSum = Object.values(this.demand).reduce((sum, weight) => sum + weight, 0);
  Object.keys(this.demand).forEach(key => {
    this.demand[key] = this.demand[key] / demandSum;
  });
  
  // 종합 지수 가중치 정규화
  const overallSum = Object.values(this.overall).reduce((sum, weight) => sum + weight, 0);
  Object.keys(this.overall).forEach(key => {
    this.overall[key] = this.overall[key] / overallSum;
  });
  
  // 참여도 세부 가중치 정규화
  const engagementDetailSum = Object.values(this.engagementDetail).reduce((sum, weight) => sum + weight, 0);
  Object.keys(this.engagementDetail).forEach(key => {
    this.engagementDetail[key] = this.engagementDetail[key] / engagementDetailSum;
  });
};

module.exports = mongoose.model('WeightSetting', WeightSettingSchema);
