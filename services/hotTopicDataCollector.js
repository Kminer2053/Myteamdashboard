const axios = require('axios');
const HotTopicAnalysis = require('../models/HotTopicAnalysis');
const WeightSetting = require('../models/WeightSetting');
const AIInsightService = require('./aiInsightService');
const ReportGenerator = require('./reportGenerator');

class HotTopicDataCollector {
    constructor() {
        this.naverClientId = process.env.NAVER_CLIENT_ID;
        this.naverClientSecret = process.env.NAVER_CLIENT_SECRET;
        this.youtubeApiKey = process.env.YOUTUBE_API_KEY;
        this.twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;
        this.instagramAppId = process.env.INSTAGRAM_APP_ID;
        this.instagramAppSecret = process.env.INSTAGRAM_APP_SECRET;
        this.tiktokClientKey = process.env.TIKTOK_CLIENT_KEY;
        this.tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET;
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        
        // 서비스 초기화
        this.aiInsightService = new AIInsightService();
        this.reportGenerator = new ReportGenerator();
    }

    // 메인 데이터 수집 함수
    async collectHotTopicData(keywords, startDate, endDate) {
        try {
            console.log(`🔥 화제성 분석 시작: ${keywords.join(', ')}`);
            const startTime = Date.now();
            
            // 가중치 설정 로드
            const weightSetting = await WeightSetting.findOne({ isActive: true });
            if (!weightSetting) {
                throw new Error('활성화된 가중치 설정을 찾을 수 없습니다.');
            }

            const results = [];
            
            // 각 키워드별로 데이터 수집
            for (const keyword of keywords) {
                console.log(`📊 키워드 분석 시작: ${keyword}`);
                
                const analysisData = {
                    keyword: keyword,
                    date: new Date(),
                    sources: {
                        news: {},
                        trend: {},
                        youtube: {},
                        twitter: {},
                        instagram: {},
                        tiktok: {}
                    },
                    metrics: {
                        exposure: 0,
                        engagement: 0,
                        demand: 0,
                        overall: 0
                    },
                    weightSettingId: weightSetting._id,
                    dataQuality: 'medium',
                    processingTime: 0
                };

                // 병렬로 모든 소스에서 데이터 수집
                const [
                    newsData,
                    trendData,
                    youtubeData,
                    twitterData,
                    instagramData,
                    tiktokData
                ] = await Promise.allSettled([
                    this.collectNewsData(keyword, startDate, endDate),
                    this.collectTrendData(keyword, startDate, endDate),
                    this.collectYouTubeData(keyword, startDate, endDate),
                    this.collectTwitterData(keyword, startDate, endDate),
                    this.collectInstagramData(keyword, startDate, endDate),
                    this.collectTikTokData(keyword, startDate, endDate)
                ]);

                // 수집된 데이터 할당
                if (newsData.status === 'fulfilled') {
                    analysisData.sources.news = newsData.value;
                }
                if (trendData.status === 'fulfilled') {
                    analysisData.sources.trend = trendData.value;
                }
                if (youtubeData.status === 'fulfilled') {
                    analysisData.sources.youtube = youtubeData.value;
                }
                if (twitterData.status === 'fulfilled') {
                    analysisData.sources.twitter = twitterData.value;
                }
                if (instagramData.status === 'fulfilled') {
                    analysisData.sources.instagram = instagramData.value;
                }
                if (tiktokData.status === 'fulfilled') {
                    analysisData.sources.tiktok = tiktokData.value;
                }

                // 지수 계산
                const analysis = new HotTopicAnalysis(analysisData);
                analysis.calculateMetrics(weightSetting);
                analysis.processingTime = Date.now() - startTime;

                // AI 인사이트 생성
                const insights = await this.aiInsightService.generateComprehensiveInsights(analysis);
                analysis.aiInsights = insights;

                // 데이터베이스 저장
                await analysis.save();
                
                // 보고서 생성
                const reportResult = await this.reportGenerator.generateHTMLReport(analysis, insights);
                if (reportResult.success) {
                    analysis.reportPath = reportResult.filePath;
                    analysis.reportId = reportResult.reportId;
                    await analysis.save();
                }
                
                results.push(analysis);
                console.log(`✅ 키워드 분석 완료: ${keyword} (${analysis.processingTime}ms)`);
            }

            console.log(`🎉 화제성 분석 완료: ${results.length}개 키워드 처리`);
            return results;

        } catch (error) {
            console.error('❌ 화제성 분석 오류:', error);
            throw error;
        }
    }

    // 네이버 뉴스 데이터 수집
    async collectNewsData(keyword, startDate, endDate) {
        try {
            console.log(`📰 네이버 뉴스 데이터 수집: ${keyword}`);
            
            const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                headers: {
                    'X-Naver-Client-Id': this.naverClientId,
                    'X-Naver-Client-Secret': this.naverClientSecret
                },
                params: {
                    query: keyword,
                    display: 100,
                    sort: 'sim'
                }
            });

            const items = response.data.items || [];
            const totalResults = response.data.total || 0;
            
            // 조회수 추정 (실제 조회수는 API에서 제공하지 않음)
            const estimatedViews = items.length * 1000; // 기사당 평균 1000 조회수 추정
            
            const topArticles = items.slice(0, 10).map(item => ({
                title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
                url: item.link,
                views: Math.floor(Math.random() * 5000) + 500, // 임시 조회수
                date: new Date(item.pubDate)
            }));

            return {
                articleCount: items.length,
                totalViews: estimatedViews,
                avgViews: Math.round(estimatedViews / Math.max(items.length, 1)),
                topArticles: topArticles
            };

        } catch (error) {
            console.error(`❌ 네이버 뉴스 데이터 수집 오류 (${keyword}):`, error.message);
            return {
                articleCount: 0,
                totalViews: 0,
                avgViews: 0,
                topArticles: []
            };
        }
    }

    // 네이버 데이터랩 트렌드 데이터 수집
    async collectTrendData(keyword, startDate, endDate) {
        try {
            console.log(`📈 네이버 데이터랩 트렌드 수집: ${keyword}`);
            
            // 검색 트렌드 API 호출
            const trendResponse = await axios.post('https://openapi.naver.com/v1/datalab/search', {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                timeUnit: 'date',
                keywordGroups: [{
                    groupName: keyword,
                    keywords: [keyword]
                }]
            }, {
                headers: {
                    'X-Naver-Client-Id': this.naverClientId,
                    'X-Naver-Client-Secret': this.naverClientSecret,
                    'Content-Type': 'application/json'
                }
            });

            const trendData = trendResponse.data.results[0]?.data || [];
            const searchVolume = trendData.reduce((sum, item) => sum + item.ratio, 0);
            const avgTrend = Math.round(searchVolume / Math.max(trendData.length, 1));

            // 쇼핑인사이트 API 호출 (선택적)
            let shoppingInsight = 0;
            try {
                const shoppingResponse = await axios.post('https://openapi.naver.com/v1/datalab/shopping/categories', {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    timeUnit: 'date',
                    category: [{
                        name: keyword,
                        param: [keyword]
                    }]
                }, {
                    headers: {
                        'X-Naver-Client-Id': this.naverClientId,
                        'X-Naver-Client-Secret': this.naverClientSecret,
                        'Content-Type': 'application/json'
                    }
                });

                const shoppingData = shoppingResponse.data.results[0]?.data || [];
                shoppingInsight = shoppingData.reduce((sum, item) => sum + item.ratio, 0);
            } catch (shoppingError) {
                console.log(`⚠️ 쇼핑인사이트 데이터 수집 실패: ${shoppingError.message}`);
            }

            return {
                searchVolume: searchVolume,
                trendScore: avgTrend,
                shoppingInsight: Math.round(shoppingInsight / Math.max(trendData.length, 1))
            };

        } catch (error) {
            console.error(`❌ 네이버 데이터랩 트렌드 수집 오류 (${keyword}):`, error.message);
            return {
                searchVolume: 0,
                trendScore: 0,
                shoppingInsight: 0
            };
        }
    }

    // YouTube 데이터 수집
    async collectYouTubeData(keyword, startDate, endDate) {
        try {
            console.log(`📺 YouTube 데이터 수집: ${keyword}`);
            
            // 동영상 검색
            const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    part: 'snippet',
                    q: keyword,
                    type: 'video',
                    maxResults: 50,
                    publishedAfter: startDate.toISOString(),
                    publishedBefore: endDate.toISOString(),
                    key: this.youtubeApiKey
                },
                headers: {
                    'User-Agent': 'MyTeamDashboard/1.0',
                    'Referer': 'http://localhost:4000'
                }
            });

            const videos = searchResponse.data.items || [];
            const videoIds = videos.map(video => video.id.videoId).join(',');

            if (videoIds) {
                // 동영상 상세 정보 조회
                const detailResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                    params: {
                        part: 'statistics',
                        id: videoIds,
                        key: this.youtubeApiKey
                    },
                    headers: {
                        'User-Agent': 'MyTeamDashboard/1.0',
                        'Referer': 'http://localhost:4000'
                    }
                });

                const videoDetails = detailResponse.data.items || [];
                
                const totalViews = videoDetails.reduce((sum, video) => sum + parseInt(video.statistics.viewCount || 0), 0);
                const totalLikes = videoDetails.reduce((sum, video) => sum + parseInt(video.statistics.likeCount || 0), 0);
                const totalComments = videoDetails.reduce((sum, video) => sum + parseInt(video.statistics.commentCount || 0), 0);

                const topVideos = videos.slice(0, 10).map((video, index) => {
                    const detail = videoDetails[index];
                    return {
                        title: video.snippet.title,
                        videoId: video.id.videoId,
                        views: parseInt(detail?.statistics.viewCount || 0),
                        likes: parseInt(detail?.statistics.likeCount || 0),
                        comments: parseInt(detail?.statistics.commentCount || 0),
                        channelTitle: video.snippet.channelTitle
                    };
                });

                return {
                    videoCount: videos.length,
                    totalViews: totalViews,
                    totalLikes: totalLikes,
                    totalComments: totalComments,
                    totalShares: 0, // YouTube API에서 공유 수는 제공하지 않음
                    avgViews: Math.round(totalViews / Math.max(videos.length, 1)),
                    topVideos: topVideos
                };
            }

            return {
                videoCount: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                avgViews: 0,
                topVideos: []
            };

        } catch (error) {
            console.error(`❌ YouTube 데이터 수집 오류 (${keyword}):`, error.message);
            return {
                videoCount: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                avgViews: 0,
                topVideos: []
            };
        }
    }

    // Twitter 데이터 수집
    async collectTwitterData(keyword, startDate, endDate) {
        try {
            console.log(`🐦 Twitter 데이터 수집: ${keyword}`);
            
            // 최근 트윗 검색
            const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
                headers: {
                    'Authorization': `Bearer ${this.twitterBearerToken}`,
                    'User-Agent': 'MyTeamDashboard/1.0'
                },
                params: {
                    'query': `${keyword} -is:retweet`,
                    'max_results': 100,
                    'tweet.fields': 'public_metrics,created_at,author_id',
                    'start_time': startDate.toISOString(),
                    'end_time': endDate.toISOString()
                }
            });

            const tweets = response.data.data || [];
            
            const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.like_count || 0), 0);
            const totalRetweets = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.retweet_count || 0), 0);
            const totalReplies = tweets.reduce((sum, tweet) => sum + (tweet.public_metrics?.reply_count || 0), 0);

            const topTweets = tweets.slice(0, 10).map(tweet => ({
                text: tweet.text,
                tweetId: tweet.id,
                likes: tweet.public_metrics?.like_count || 0,
                retweets: tweet.public_metrics?.retweet_count || 0,
                replies: tweet.public_metrics?.reply_count || 0,
                author: tweet.author_id
            }));

            return {
                tweetCount: tweets.length,
                totalLikes: totalLikes,
                totalRetweets: totalRetweets,
                totalReplies: totalReplies,
                avgEngagement: Math.round((totalLikes + totalRetweets + totalReplies) / Math.max(tweets.length, 1)),
                topTweets: topTweets
            };

        } catch (error) {
            console.error(`❌ Twitter 데이터 수집 오류 (${keyword}):`, error.message);
            return {
                tweetCount: 0,
                totalLikes: 0,
                totalRetweets: 0,
                totalReplies: 0,
                avgEngagement: 0,
                topTweets: []
            };
        }
    }

    // Instagram 데이터 수집 (공개 데이터만)
    async collectInstagramData(keyword, startDate, endDate) {
        try {
            console.log(`📸 Instagram 데이터 수집: ${keyword}`);
            
            // Instagram Basic Display API는 OAuth 인증이 필요하므로
            // 현재는 공개 데이터만 수집 가능
            // 실제 구현에서는 Instagram Graph API 사용 권장
            
            return {
                postCount: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                avgEngagement: 0,
                topPosts: []
            };

        } catch (error) {
            console.error(`❌ Instagram 데이터 수집 오류 (${keyword}):`, error.message);
            return {
                postCount: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                avgEngagement: 0,
                topPosts: []
            };
        }
    }

    // TikTok 데이터 수집
    async collectTikTokData(keyword, startDate, endDate) {
        try {
            console.log(`🎵 TikTok 데이터 수집: ${keyword}`);
            
            // TikTok for Developers API는 OAuth 인증이 필요하므로
            // 현재는 공개 데이터만 수집 가능
            
            return {
                videoCount: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                avgViews: 0,
                topVideos: []
            };

        } catch (error) {
            console.error(`❌ TikTok 데이터 수집 오류 (${keyword}):`, error.message);
            return {
                videoCount: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                avgViews: 0,
                topVideos: []
            };
        }
    }

    // AI 인사이트 생성
    async generateAIInsights(analysis) {
        try {
            console.log(`🤖 AI 인사이트 생성: ${analysis.keyword}`);
            
            const prompt = `
다음은 "${analysis.keyword}" 키워드에 대한 화제성 분석 데이터입니다:

📊 지수 점수:
- 노출 지수: ${analysis.metrics.exposure}/100 (${analysis.exposureGrade})
- 참여 지수: ${analysis.metrics.engagement}/100 (${analysis.engagementGrade})
- 수요 지수: ${analysis.metrics.demand}/100 (${analysis.demandGrade})
- 종합 지수: ${analysis.metrics.overall}/100 (${analysis.overallGrade})

📰 뉴스 데이터:
- 기사 수: ${analysis.sources.news.articleCount}개
- 총 조회수: ${analysis.sources.news.totalViews.toLocaleString()}회

📈 검색 트렌드:
- 검색량: ${analysis.sources.trend.searchVolume}
- 트렌드 점수: ${analysis.sources.trend.trendScore}

📺 YouTube 데이터:
- 동영상 수: ${analysis.sources.youtube.videoCount}개
- 총 조회수: ${analysis.sources.youtube.totalViews.toLocaleString()}회
- 총 좋아요: ${analysis.sources.youtube.totalLikes.toLocaleString()}개

🐦 Twitter 데이터:
- 트윗 수: ${analysis.sources.twitter.tweetCount}개
- 총 좋아요: ${analysis.sources.twitter.totalLikes.toLocaleString()}개
- 총 리트윗: ${analysis.sources.twitter.totalRetweets.toLocaleString()}개

이 데이터를 바탕으로 다음 형식으로 분석해주세요:

## 📋 종합 요약
[키워드의 전체적인 화제성 상황을 2-3문장으로 요약]

## 🔍 주요 발견사항
- [발견사항 1]
- [발견사항 2]
- [발견사항 3]

## 💡 추천사항
- [추천사항 1]
- [추천사항 2]

## 📈 트렌드 분석
[향후 전망 및 트렌드 분석]

## ⚠️ 주의사항
- [주의해야 할 점들]

## 🎯 기회요소
- [활용할 수 있는 기회들]
`;

            const response = await axios.post('https://api.perplexity.ai/chat/completions', {
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 화제성 분석 전문가입니다. 주어진 데이터를 바탕으로 정확하고 실용적인 인사이트를 제공해주세요.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.perplexityApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;
            
            // AI 응답을 구조화된 형태로 파싱
            const insights = this.parseAIResponse(aiResponse);
            
            return insights;

        } catch (error) {
            console.error(`❌ AI 인사이트 생성 오류 (${analysis.keyword}):`, error.message);
            return {
                summary: 'AI 인사이트 생성 중 오류가 발생했습니다.',
                keyFindings: ['데이터 수집 완료', 'AI 분석 실패'],
                recommendations: ['수동 분석 권장'],
                trendAnalysis: 'AI 분석을 통한 트렌드 분석이 불가능합니다.',
                riskFactors: ['AI 분석 실패'],
                opportunities: ['수동 분석을 통한 인사이트 도출']
            };
        }
    }

    // AI 응답 파싱
    parseAIResponse(response) {
        try {
            const sections = response.split('##');
            const insights = {
                summary: '',
                keyFindings: [],
                recommendations: [],
                trendAnalysis: '',
                riskFactors: [],
                opportunities: []
            };

            sections.forEach(section => {
                const lines = section.trim().split('\n').filter(line => line.trim());
                if (lines.length === 0) return;

                const title = lines[0].trim();
                const content = lines.slice(1).join('\n').trim();

                if (title.includes('종합 요약')) {
                    insights.summary = content;
                } else if (title.includes('주요 발견사항')) {
                    insights.keyFindings = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('추천사항')) {
                    insights.recommendations = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('트렌드 분석')) {
                    insights.trendAnalysis = content;
                } else if (title.includes('주의사항')) {
                    insights.riskFactors = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('기회요소')) {
                    insights.opportunities = content.split('-').map(item => item.trim()).filter(item => item);
                }
            });

            return insights;

        } catch (error) {
            console.error('AI 응답 파싱 오류:', error);
            return {
                summary: response.substring(0, 200) + '...',
                keyFindings: ['AI 응답 파싱 실패'],
                recommendations: ['수동 검토 권장'],
                trendAnalysis: '파싱 실패',
                riskFactors: ['파싱 오류'],
                opportunities: ['수동 분석 필요']
            };
        }
    }
}

module.exports = HotTopicDataCollector;
