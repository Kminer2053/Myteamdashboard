const axios = require('axios');

class AIInsightService {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.apiUrl = 'https://api.perplexity.ai/chat/completions';
    }

    // 종합 화제성 분석 인사이트 생성
    async generateComprehensiveInsights(analysisData) {
        try {
            console.log(`🤖 종합 AI 인사이트 생성: ${analysisData.keyword}`);
            
            const prompt = this.buildComprehensivePrompt(analysisData);
            
            const response = await axios.post(this.apiUrl, {
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content: `당신은 화제성 분석 전문가입니다. 주어진 데이터를 바탕으로 정확하고 실용적인 인사이트를 제공해주세요. 
                        
                        분석 시 다음을 고려해주세요:
                        1. 데이터의 신뢰성과 한계
                        2. 시장 트렌드와의 연관성
                        3. 실무진이 활용할 수 있는 구체적인 제안
                        4. 위험 요소와 기회 요소의 균형
                        5. 한국 시장 특성을 반영한 분석`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1500,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.perplexityApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const aiResponse = response.data.choices[0].message.content;
            const insights = this.parseComprehensiveResponse(aiResponse);
            
            return insights;

        } catch (error) {
            console.error(`❌ AI 인사이트 생성 오류 (${analysisData.keyword}):`, error.message);
            return this.getFallbackInsights(analysisData);
        }
    }

    // 종합 프롬프트 구성
    buildComprehensivePrompt(analysisData) {
        const { keyword, metrics, sources, date } = analysisData;
        
        return `
# 화제성 분석 데이터

**키워드:** ${keyword}
**분석 날짜:** ${date.toLocaleDateString('ko-KR')}

## 📊 지수 점수
- **종합 지수:** ${metrics.overall}/100 (${this.getGradeText(metrics.overall)})
- **노출 지수:** ${metrics.exposure}/100 (${this.getGradeText(metrics.exposure)})
- **참여 지수:** ${metrics.engagement}/100 (${this.getGradeText(metrics.engagement)})
- **수요 지수:** ${metrics.demand}/100 (${this.getGradeText(metrics.demand)})

## 📰 뉴스 데이터
- **기사 수:** ${sources.news.articleCount}개
- **총 조회수:** ${sources.news.totalViews.toLocaleString()}회
- **평균 조회수:** ${sources.news.avgViews.toLocaleString()}회/기사

## 📈 검색 트렌드
- **검색량:** ${sources.trend.searchVolume}
- **트렌드 점수:** ${sources.trend.trendScore}
- **쇼핑인사이트:** ${sources.trend.shoppingInsight}

## 📺 YouTube 데이터
- **동영상 수:** ${sources.youtube.videoCount}개
- **총 조회수:** ${sources.youtube.totalViews.toLocaleString()}회
- **총 좋아요:** ${sources.youtube.totalLikes.toLocaleString()}개
- **총 댓글:** ${sources.youtube.totalComments.toLocaleString()}개

## 🐦 Twitter 데이터
- **트윗 수:** ${sources.twitter.tweetCount}개
- **총 좋아요:** ${sources.twitter.totalLikes.toLocaleString()}개
- **총 리트윗:** ${sources.twitter.totalRetweets.toLocaleString()}개
- **총 댓글:** ${sources.twitter.totalReplies.toLocaleString()}개

## 📸 Instagram 데이터
- **포스트 수:** ${sources.instagram.postCount}개
- **총 좋아요:** ${sources.instagram.totalLikes.toLocaleString()}개
- **총 댓글:** ${sources.instagram.totalComments.toLocaleString()}개

## 🎵 TikTok 데이터
- **동영상 수:** ${sources.tiktok.videoCount}개
- **총 조회수:** ${sources.tiktok.totalViews.toLocaleString()}회
- **총 좋아요:** ${sources.tiktok.totalLikes.toLocaleString()}개

---

위 데이터를 바탕으로 다음 형식으로 종합 분석해주세요:

## 🎯 핵심 요약
[키워드의 전체적인 화제성 상황을 3-4문장으로 요약]

## 📊 데이터 해석
### 노출 지수 분석
[노출 지수의 의미와 주요 소스별 기여도 분석]

### 참여 지수 분석
[참여 지수의 의미와 플랫폼별 참여도 분석]

### 수요 지수 분석
[수요 지수의 의미와 검색 트렌드 분석]

## 🔍 주요 발견사항
- **[발견사항 1]** - 구체적인 데이터 근거와 함께
- **[발견사항 2]** - 구체적인 데이터 근거와 함께
- **[발견사항 3]** - 구체적인 데이터 근거와 함께

## 💡 전략적 제안
### 단기 전략 (1-2주)
- [제안 1]
- [제안 2]

### 중기 전략 (1-3개월)
- [제안 1]
- [제안 2]

### 장기 전략 (3-6개월)
- [제안 1]
- [제안 2]

## 📈 트렌드 전망
### 긍정적 요인
- [요인 1]
- [요인 2]

### 부정적 요인
- [요인 1]
- [요인 2]

### 예상 시나리오
- **최적 시나리오:** [상황과 예상 결과]
- **기본 시나리오:** [상황과 예상 결과]
- **최악 시나리오:** [상황과 예상 결과]

## ⚠️ 주의사항
- [주의사항 1] - 구체적인 이유와 함께
- [주의사항 2] - 구체적인 이유와 함께

## 🎯 기회요소
- [기회 1] - 활용 방안과 함께
- [기회 2] - 활용 방안과 함께

## 📋 액션 아이템
1. **[우선순위 높음]** [구체적인 액션]
2. **[우선순위 중간]** [구체적인 액션]
3. **[우선순위 낮음]** [구체적인 액션]
`;
    }

    // 응답 파싱
    parseComprehensiveResponse(response) {
        try {
            const sections = response.split('##');
            const insights = {
                summary: '',
                dataInterpretation: {
                    exposure: '',
                    engagement: '',
                    demand: ''
                },
                keyFindings: [],
                strategicRecommendations: {
                    shortTerm: [],
                    mediumTerm: [],
                    longTerm: []
                },
                trendOutlook: {
                    positiveFactors: [],
                    negativeFactors: [],
                    scenarios: {
                        best: '',
                        base: '',
                        worst: ''
                    }
                },
                riskFactors: [],
                opportunities: [],
                actionItems: []
            };

            sections.forEach(section => {
                const lines = section.trim().split('\n').filter(line => line.trim());
                if (lines.length === 0) return;

                const title = lines[0].trim();
                const content = lines.slice(1).join('\n').trim();

                if (title.includes('핵심 요약')) {
                    insights.summary = content;
                } else if (title.includes('노출 지수 분석')) {
                    insights.dataInterpretation.exposure = content;
                } else if (title.includes('참여 지수 분석')) {
                    insights.dataInterpretation.engagement = content;
                } else if (title.includes('수요 지수 분석')) {
                    insights.dataInterpretation.demand = content;
                } else if (title.includes('주요 발견사항')) {
                    insights.keyFindings = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('단기 전략')) {
                    insights.strategicRecommendations.shortTerm = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('중기 전략')) {
                    insights.strategicRecommendations.mediumTerm = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('장기 전략')) {
                    insights.strategicRecommendations.longTerm = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('긍정적 요인')) {
                    insights.trendOutlook.positiveFactors = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('부정적 요인')) {
                    insights.trendOutlook.negativeFactors = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('최적 시나리오')) {
                    insights.trendOutlook.scenarios.best = content;
                } else if (title.includes('기본 시나리오')) {
                    insights.trendOutlook.scenarios.base = content;
                } else if (title.includes('최악 시나리오')) {
                    insights.trendOutlook.scenarios.worst = content;
                } else if (title.includes('주의사항')) {
                    insights.riskFactors = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('기회요소')) {
                    insights.opportunities = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('액션 아이템')) {
                    insights.actionItems = content.split('\n').map(item => item.trim()).filter(item => item);
                }
            });

            return insights;

        } catch (error) {
            console.error('AI 응답 파싱 오류:', error);
            return this.getFallbackInsights();
        }
    }

    // 등급 텍스트 변환
    getGradeText(score) {
        if (score >= 81) return '매우 높음';
        if (score >= 61) return '높음';
        if (score >= 41) return '보통';
        if (score >= 21) return '낮음';
        return '매우 낮음';
    }

    // 폴백 인사이트
    getFallbackInsights(analysisData = null) {
        return {
            summary: analysisData ? 
                `"${analysisData.keyword}" 키워드의 화제성 분석이 완료되었습니다. 종합 지수 ${analysisData.metrics.overall}/100으로 ${this.getGradeText(analysisData.metrics.overall)} 수준입니다.` :
                'AI 분석을 통한 인사이트 생성에 실패했습니다.',
            dataInterpretation: {
                exposure: '노출 지수는 다양한 미디어 플랫폼에서의 키워드 노출 정도를 나타냅니다.',
                engagement: '참여 지수는 사용자들의 적극적인 참여 정도를 나타냅니다.',
                demand: '수요 지수는 사용자들의 관심도와 검색 의도를 나타냅니다.'
            },
            keyFindings: [
                '데이터 수집 완료',
                'AI 분석 실패로 수동 검토 필요'
            ],
            strategicRecommendations: {
                shortTerm: ['수동 분석을 통한 전략 수립 권장'],
                mediumTerm: ['지속적인 모니터링 필요'],
                longTerm: ['시스템 개선 후 재분석 권장']
            },
            trendOutlook: {
                positiveFactors: ['데이터 수집 성공'],
                negativeFactors: ['AI 분석 실패'],
                scenarios: {
                    best: 'AI 분석 시스템 개선 후 정확한 전망 가능',
                    base: '현재 데이터 기반 수동 분석 필요',
                    worst: 'AI 분석 실패로 인한 전략 수립 지연'
                }
            },
            riskFactors: ['AI 분석 실패', '수동 검토 필요'],
            opportunities: ['시스템 개선을 통한 정확한 분석 가능'],
            actionItems: [
                '1. [우선순위 높음] AI 분석 시스템 점검',
                '2. [우선순위 중간] 수동 분석 수행',
                '3. [우선순위 낮음] 시스템 개선 계획 수립'
            ]
        };
    }

    // 트렌드 비교 분석
    async generateTrendComparisonInsights(currentData, historicalData) {
        try {
            console.log(`📊 트렌드 비교 분석: ${currentData.keyword}`);
            
            const prompt = this.buildTrendComparisonPrompt(currentData, historicalData);
            
            const response = await axios.post(this.apiUrl, {
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 트렌드 분석 전문가입니다. 과거 데이터와 현재 데이터를 비교하여 트렌드 변화를 분석해주세요.'
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
            return this.parseTrendComparisonResponse(aiResponse);

        } catch (error) {
            console.error('트렌드 비교 분석 오류:', error);
            return {
                trendDirection: 'stable',
                changeRate: 0,
                keyChanges: ['트렌드 분석 실패'],
                implications: ['수동 분석 필요']
            };
        }
    }

    // 트렌드 비교 프롬프트 구성
    buildTrendComparisonPrompt(currentData, historicalData) {
        return `
# 트렌드 비교 분석

**키워드:** ${currentData.keyword}

## 현재 데이터 (${currentData.date.toLocaleDateString('ko-KR')})
- 종합 지수: ${currentData.metrics.overall}/100
- 노출 지수: ${currentData.metrics.exposure}/100
- 참여 지수: ${currentData.metrics.engagement}/100
- 수요 지수: ${currentData.metrics.demand}/100

## 과거 데이터 (${historicalData.date.toLocaleDateString('ko-KR')})
- 종합 지수: ${historicalData.metrics.overall}/100
- 노출 지수: ${historicalData.metrics.exposure}/100
- 참여 지수: ${historicalData.metrics.engagement}/100
- 수요 지수: ${historicalData.metrics.demand}/100

위 데이터를 바탕으로 트렌드 변화를 분석해주세요:

## 📈 트렌드 방향
[상승/하락/안정 중 하나로 판단]

## 📊 변화율
[각 지수별 변화율 계산]

## 🔍 주요 변화사항
- [변화사항 1]
- [변화사항 2]
- [변화사항 3]

## 💡 시사점
[변화의 의미와 영향 분석]
`;
    }

    // 트렌드 비교 응답 파싱
    parseTrendComparisonResponse(response) {
        try {
            const sections = response.split('##');
            const insights = {
                trendDirection: 'stable',
                changeRate: 0,
                keyChanges: [],
                implications: ''
            };

            sections.forEach(section => {
                const lines = section.trim().split('\n').filter(line => line.trim());
                if (lines.length === 0) return;

                const title = lines[0].trim();
                const content = lines.slice(1).join('\n').trim();

                if (title.includes('트렌드 방향')) {
                    if (content.includes('상승')) insights.trendDirection = 'increasing';
                    else if (content.includes('하락')) insights.trendDirection = 'decreasing';
                    else insights.trendDirection = 'stable';
                } else if (title.includes('주요 변화사항')) {
                    insights.keyChanges = content.split('-').map(item => item.trim()).filter(item => item);
                } else if (title.includes('시사점')) {
                    insights.implications = content;
                }
            });

            return insights;

        } catch (error) {
            console.error('트렌드 비교 응답 파싱 오류:', error);
            return {
                trendDirection: 'stable',
                changeRate: 0,
                keyChanges: ['파싱 실패'],
                implications: '수동 분석 필요'
            };
        }
    }
}

module.exports = AIInsightService;


