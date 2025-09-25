const mongoose = require('mongoose');

const HotTopicAnalysisSchema = new mongoose.Schema({
  // 기본 정보
  keyword: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  analysisDate: { type: Date, default: Date.now },
  
  // 지수 데이터
  metrics: {
    exposure: { type: Number, default: 0, min: 0, max: 100 },
    engagement: { type: Number, default: 0, min: 0, max: 100 },
    demand: { type: Number, default: 0, min: 0, max: 100 },
    overall: { type: Number, default: 0, min: 0, max: 100 }
  },
  
  // 소스별 원시 데이터
  sources: {
    news: {
      articleCount: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      avgViews: { type: Number, default: 0 },
      topArticles: [{
        title: String,
        url: String,
        views: Number,
        date: Date
      }]
    },
    
    trend: {
      searchVolume: { type: Number, default: 0 },
      trendScore: { type: Number, default: 0 },
      shoppingInsight: { type: Number, default: 0 }
    },
    
    youtube: {
      videoCount: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },
      avgViews: { type: Number, default: 0 },
      topVideos: [{
        title: String,
        videoId: String,
        views: Number,
        likes: Number,
        comments: Number,
        channelTitle: String
      }]
    },
    
    twitter: {
      tweetCount: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalRetweets: { type: Number, default: 0 },
      totalReplies: { type: Number, default: 0 },
      avgEngagement: { type: Number, default: 0 },
      topTweets: [{
        text: String,
        tweetId: String,
        likes: Number,
        retweets: Number,
        replies: Number,
        author: String
      }]
    },
    
    instagram: {
      postCount: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },
      avgEngagement: { type: Number, default: 0 },
      topPosts: [{
        caption: String,
        postId: String,
        likes: Number,
        comments: Number,
        shares: Number,
        author: String
      }]
    },
    
    tiktok: {
      videoCount: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      totalShares: { type: Number, default: 0 },
      avgViews: { type: Number, default: 0 },
      topVideos: [{
        title: String,
        videoId: String,
        views: Number,
        likes: Number,
        comments: Number,
        author: String
      }]
    }
  },
  
  // AI 분석 인사이트
  aiInsights: {
    summary: String,
    keyFindings: [String],
    recommendations: [String],
    trendAnalysis: String,
    riskFactors: [String],
    opportunities: [String]
  },
  
  // 메타데이터
  weightSettingId: { type: mongoose.Schema.Types.ObjectId, ref: 'WeightSetting' },
  dataQuality: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  processingTime: { type: Number, default: 0 }, // 처리 시간 (밀리초)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 복합 인덱스
HotTopicAnalysisSchema.index({ keyword: 1, date: 1 }, { unique: true });
HotTopicAnalysisSchema.index({ date: -1 });
HotTopicAnalysisSchema.index({ 'metrics.overall': -1 });

// 가상 필드: 지수 등급
HotTopicAnalysisSchema.virtual('exposureGrade').get(function() {
  if (this.metrics.exposure >= 81) return '매우 높음';
  if (this.metrics.exposure >= 61) return '높음';
  if (this.metrics.exposure >= 31) return '보통';
  return '낮음';
});

HotTopicAnalysisSchema.virtual('engagementGrade').get(function() {
  if (this.metrics.engagement >= 76) return '매우 높음';
  if (this.metrics.engagement >= 51) return '높음';
  if (this.metrics.engagement >= 26) return '보통';
  return '낮음';
});

HotTopicAnalysisSchema.virtual('demandGrade').get(function() {
  if (this.metrics.demand >= 81) return '매우 높음';
  if (this.metrics.demand >= 61) return '높음';
  if (this.metrics.demand >= 31) return '보통';
  return '낮음';
});

HotTopicAnalysisSchema.virtual('overallGrade').get(function() {
  if (this.metrics.overall >= 81) return '매우 높음';
  if (this.metrics.overall >= 61) return '높음';
  if (this.metrics.overall >= 41) return '보통';
  return '낮음';
});

// 지수 계산 메서드
HotTopicAnalysisSchema.methods.calculateMetrics = function(weightSetting) {
  const weights = weightSetting || this.weightSettingId;
  
  // 노출 지수 계산
  this.metrics.exposure = this.calculateExposureIndex(weights);
  
  // 참여 지수 계산
  this.metrics.engagement = this.calculateEngagementIndex(weights);
  
  // 수요 지수 계산
  this.metrics.demand = this.calculateDemandIndex(weights);
  
  // 종합 지수 계산
  this.metrics.overall = this.calculateOverallIndex(weights);
  
  return this.metrics;
};

// 노출 지수 계산
HotTopicAnalysisSchema.methods.calculateExposureIndex = function(weights) {
  const exposure = weights.exposure;
  const sources = this.sources;
  
  let exposureScore = 0;
  
  // 뉴스 기사 수 기반 점수 (0-100)
  const newsScore = Math.min(sources.news.articleCount * 2, 100);
  exposureScore += newsScore * exposure.news;
  
  // YouTube 조회수 기반 점수 (0-100)
  const youtubeScore = Math.min(sources.youtube.totalViews / 10000, 100);
  exposureScore += youtubeScore * exposure.youtube;
  
  // Twitter 트윗 수 기반 점수 (0-100)
  const twitterScore = Math.min(sources.twitter.tweetCount * 5, 100);
  exposureScore += twitterScore * exposure.twitter;
  
  // Instagram 포스트 수 기반 점수 (0-100)
  const instagramScore = Math.min(sources.instagram.postCount * 3, 100);
  exposureScore += instagramScore * exposure.instagram;
  
  // TikTok 조회수 기반 점수 (0-100)
  const tiktokScore = Math.min(sources.tiktok.totalViews / 5000, 100);
  exposureScore += tiktokScore * exposure.tiktok;
  
  return Math.round(exposureScore);
};

// 참여 지수 계산
HotTopicAnalysisSchema.methods.calculateEngagementIndex = function(weights) {
  const engagement = weights.engagement;
  const detail = weights.engagementDetail;
  const sources = this.sources;
  
  let engagementScore = 0;
  
  // YouTube 참여도 계산
  const youtubeEngagement = (sources.youtube.totalLikes * detail.likes + 
                           sources.youtube.totalComments * detail.comments + 
                           sources.youtube.totalShares * detail.shares) / Math.max(sources.youtube.videoCount, 1);
  const youtubeScore = Math.min(youtubeEngagement / 100, 100);
  engagementScore += youtubeScore * engagement.youtube;
  
  // Twitter 참여도 계산
  const twitterEngagement = (sources.twitter.totalLikes * detail.likes + 
                           sources.twitter.totalReplies * detail.comments + 
                           sources.twitter.totalRetweets * detail.shares) / Math.max(sources.twitter.tweetCount, 1);
  const twitterScore = Math.min(twitterEngagement / 50, 100);
  engagementScore += twitterScore * engagement.twitter;
  
  // Instagram 참여도 계산
  const instagramEngagement = (sources.instagram.totalLikes * detail.likes + 
                             sources.instagram.totalComments * detail.comments + 
                             sources.instagram.totalShares * detail.shares) / Math.max(sources.instagram.postCount, 1);
  const instagramScore = Math.min(instagramEngagement / 200, 100);
  engagementScore += instagramScore * engagement.instagram;
  
  // TikTok 참여도 계산
  const tiktokEngagement = (sources.tiktok.totalLikes * detail.likes + 
                          sources.tiktok.totalComments * detail.comments + 
                          sources.tiktok.totalShares * detail.shares) / Math.max(sources.tiktok.videoCount, 1);
  const tiktokScore = Math.min(tiktokEngagement / 100, 100);
  engagementScore += tiktokScore * engagement.tiktok;
  
  return Math.round(engagementScore);
};

// 수요 지수 계산
HotTopicAnalysisSchema.methods.calculateDemandIndex = function(weights) {
  const demand = weights.demand;
  const sources = this.sources;
  
  let demandScore = 0;
  
  // 네이버 검색 트렌드 기반 점수 (0-100)
  const naverScore = Math.min(sources.trend.searchVolume, 100);
  demandScore += naverScore * demand.naverTrend;
  
  // YouTube 검색량 기반 점수 (0-100)
  const youtubeScore = Math.min(sources.youtube.videoCount * 10, 100);
  demandScore += youtubeScore * demand.youtube;
  
  // Twitter 검색량 기반 점수 (0-100)
  const twitterScore = Math.min(sources.twitter.tweetCount * 8, 100);
  demandScore += twitterScore * demand.twitter;
  
  // Instagram 해시태그 기반 점수 (0-100)
  const instagramScore = Math.min(sources.instagram.postCount * 15, 100);
  demandScore += instagramScore * demand.instagram;
  
  // TikTok 해시태그 기반 점수 (0-100)
  const tiktokScore = Math.min(sources.tiktok.videoCount * 12, 100);
  demandScore += tiktokScore * demand.tiktok;
  
  return Math.round(demandScore);
};

// 종합 지수 계산
HotTopicAnalysisSchema.methods.calculateOverallIndex = function(weights) {
  const overall = weights.overall;
  
  const overallScore = (this.metrics.exposure * overall.exposure + 
                       this.metrics.engagement * overall.engagement + 
                       this.metrics.demand * overall.demand);
  
  return Math.round(overallScore);
};

module.exports = mongoose.model('HotTopicAnalysis', HotTopicAnalysisSchema);
