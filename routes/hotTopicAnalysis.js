const express = require('express');
const router = express.Router();
const axios = require('axios');
const GoogleTrendsService = require('../services/googleTrendsService');
const PDFGenerator = require('../services/pdfGenerator');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'e037eF7sxB3VuJHBpay5';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'qkPfGHxNkN';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const googleTrendsService = new GoogleTrendsService();
const pdfGenerator = new PDFGenerator();

// 정보검색 API (언론보도 효과성 + 검색트렌드)
router.post('/search-info', async (req, res) => {
    try {
        const { keyword, startDate, endDate } = req.body;
        
        if (!keyword || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '키워드, 시작일, 종료일이 모두 필요합니다.'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않은 날짜 형식입니다.'
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: '시작일은 종료일보다 이전이어야 합니다.'
            });
        }

        console.log(`🔍 정보검색 시작: ${keyword} (${startDate} ~ ${endDate})`);

        // 1. 언론보도 효과성 데이터 수집 (기간을 나눠서 수집하여 1년치 데이터 확보)
        let newsData = null;
        try {
            let allNewsItems = [];
            const maxPages = 10; // 최대 10페이지 (1000건)
            const maxTotalItems = 5000; // 최대 5000건까지 수집
            
            // 기간이 1년 이상이면 월별로 나눠서 수집
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            const shouldSplitByMonth = daysDiff > 180; // 6개월 이상이면 월별로 나눠서 수집
            
            if (shouldSplitByMonth) {
                console.log(`📅 기간이 ${daysDiff}일로 길어서 월별로 나눠서 수집합니다.`);
                const months = [];
                let currentDate = new Date(start);
                
                while (currentDate <= end) {
                    const monthStart = new Date(currentDate);
                    const monthEnd = new Date(currentDate);
                    monthEnd.setMonth(monthEnd.getMonth() + 1);
                    monthEnd.setDate(0); // 해당 월의 마지막 날
                    
                    if (monthEnd > end) monthEnd = new Date(end);
                    
                    months.push({ start: monthStart, end: monthEnd });
                    currentDate = new Date(monthEnd);
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                
                // 각 월별로 수집
                for (const month of months) {
                    for (let page = 1; page <= maxPages && allNewsItems.length < maxTotalItems; page++) {
                        const newsResponse = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                            headers: {
                                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
                            },
                            params: {
                                query: keyword,
                                display: 100,
                                sort: 'date',
                                start: (page - 1) * 100 + 1
                            }
                        });

                        const pageItems = newsResponse.data.items || [];
                        if (pageItems.length === 0) break;
                        
                        // 해당 월 기간 내의 아이템만 필터링
                        const filteredItems = pageItems.filter(item => {
                            const pubDate = new Date(item.pubDate);
                            return pubDate >= month.start && pubDate <= month.end;
                        });
                        
                        allNewsItems = allNewsItems.concat(filteredItems);
                        
                        // API 호출 간격 조절
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            } else {
                // 기간이 짧으면 기존 방식대로 수집
                for (let page = 1; page <= maxPages && allNewsItems.length < maxTotalItems; page++) {
                    const newsResponse = await axios.get('https://openapi.naver.com/v1/search/news.json', {
                        headers: {
                            'X-Naver-Client-Id': NAVER_CLIENT_ID,
                            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
                        },
                        params: {
                            query: keyword,
                            display: 100,
                            sort: 'date',
                            start: (page - 1) * 100 + 1
                        }
                    });

                    const pageItems = newsResponse.data.items || [];
                    if (pageItems.length === 0) break;
                    
                    allNewsItems = allNewsItems.concat(pageItems);
                    
                    // API 호출 간격 조절
                    if (page < maxPages) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }

            const filteredNews = allNewsItems
                .filter(item => {
                    const pubDate = new Date(item.pubDate);
                    return pubDate >= start && pubDate <= end;
                })
                .map(item => {
                    // originallink가 있으면 우선 사용, 없으면 link 사용
                    const newsLink = item.originallink || item.link;
                    return {
                        title: item.title.replace(/<[^>]+>/g, ''),
                        link: newsLink,
                        description: item.description.replace(/<[^>]+>/g, ''),
                        pubDate: new Date(item.pubDate).toISOString().split('T')[0],
                        source: extractSourceFromLink(newsLink),
                        originallink: item.originallink
                    };
                });

            // 날짜별 집계
            const aggregated = {};
            filteredNews.forEach(item => {
                const date = item.pubDate;
                aggregated[date] = (aggregated[date] || 0) + 1;
            });

            // 최대 표출량 제한 (5000건)
            const maxDisplayCount = 5000;
            const displayNews = filteredNews.length > maxDisplayCount 
                ? filteredNews.slice(0, maxDisplayCount)
                : filteredNews;
            
            newsData = {
                news: displayNews,
                aggregated: aggregated,
                totalCount: filteredNews.length,
                displayCount: displayNews.length,
                isLimited: filteredNews.length > maxDisplayCount
            };
        } catch (error) {
            console.error('언론보도 효과성 데이터 수집 오류:', error.message);
            newsData = {
                news: [],
                aggregated: {},
                totalCount: 0,
                error: error.message
            };
        }

        // 2. 네이버 검색트렌드 데이터 수집
        let naverTrend = null;
        try {
            const trendResponse = await axios.post('https://openapi.naver.com/v1/datalab/search', {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                timeUnit: 'date',
                keywordGroups: [{
                    groupName: keyword,
                    keywords: [keyword]
                }]
            }, {
                headers: {
                    'X-Naver-Client-Id': NAVER_CLIENT_ID,
                    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
                    'Content-Type': 'application/json'
                }
            });

            const trendData = trendResponse.data.results[0]?.data || [];
            naverTrend = {
                keyword: keyword,
                data: trendData.map(item => ({
                    date: item.period,
                    value: item.ratio || 0
                })),
                totalVolume: trendData.reduce((sum, item) => sum + (item.ratio || 0), 0),
                avgValue: Math.round(trendData.reduce((sum, item) => sum + (item.ratio || 0), 0) / Math.max(trendData.length, 1))
            };
        } catch (error) {
            console.error('네이버 검색트렌드 수집 오류:', error.message);
            naverTrend = {
                keyword: keyword,
                data: [],
                totalVolume: 0,
                avgValue: 0,
                error: error.message
            };
        }

        // 3. 구글 검색트렌드 데이터 수집
        let googleTrend = null;
        try {
            console.log(`🔍 구글 트렌드 데이터 수집 시작: ${keyword} (${start.toISOString().split('T')[0]} ~ ${end.toISOString().split('T')[0]})`);
            googleTrend = await googleTrendsService.getTrendData(keyword, start, end);
            console.log(`✅ 구글 트렌드 데이터 수집 완료: ${googleTrend.data?.length || 0}개 데이터 포인트`);
        } catch (error) {
            console.error('❌ 구글 검색트렌드 수집 오류:', error.message);
            console.error('구글 트렌드 오류 상세:', error.stack);
            googleTrend = {
                keyword: keyword,
                data: [],
                totalVolume: 0,
                avgValue: 0,
                error: error.message
            };
        }

        res.json({
            success: true,
            data: {
                keyword: keyword,
                period: {
                    startDate: startDate,
                    endDate: endDate
                },
                newsData: newsData,
                naverTrend: naverTrend,
                googleTrend: googleTrend
            }
        });

    } catch (error) {
        console.error('정보검색 오류:', error);
        res.status(500).json({
            success: false,
            message: '정보검색 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 화제성 분석 보고서 생성 API
router.post('/generate-report', async (req, res) => {
    try {
        const { keyword, startDate, endDate, insights, newsData, naverTrend, googleTrend } = req.body;
        
        if (!keyword || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '키워드, 시작일, 종료일이 필요합니다.'
            });
        }

        if (!PERPLEXITY_API_KEY) {
            return res.status(500).json({
                success: false,
                message: 'Perplexity API 키가 설정되지 않았습니다.'
            });
        }

        console.log(`📊 화제성 분석 보고서 생성: ${keyword}`);

        // 프롬프트 구성
        const prompt = buildAnalysisPrompt(keyword, startDate, endDate, insights, newsData, naverTrend, googleTrend);

        // Perplexity AI 호출
            const response = await axios.post(PERPLEXITY_API_URL, {
            model: 'sonar-pro',
            messages: [
                {
                    role: 'system',
                    content: '당신은 화제성 분석 전문가입니다. 주어진 데이터를 바탕으로 구조화된 마크다운 형식의 종합 분석 보고서를 작성해주세요.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const markdownReport = response.data.choices[0].message.content;

        res.json({
            success: true,
            data: {
                keyword: keyword,
                report: markdownReport,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('화제성 분석 보고서 생성 오류:', error);
        res.status(500).json({
            success: false,
            message: '보고서 생성 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// PDF 변환 API
router.post('/convert-pdf', async (req, res) => {
    try {
        const { markdown, filename } = req.body;
        
        if (!markdown) {
            return res.status(400).json({
                success: false,
                message: '마크다운 내용이 필요합니다.'
            });
        }

        console.log('📄 PDF 변환 시작...');

        const result = await pdfGenerator.convertToPDF(markdown, filename);

        if (result.success) {
            res.json({
                success: true,
                data: {
                    filePath: result.filePath,
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    url: result.url
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'PDF 변환 실패',
                error: result.error
            });
        }

    } catch (error) {
        console.error('PDF 변환 오류:', error);
        res.status(500).json({
            success: false,
            message: 'PDF 변환 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// PDF 다운로드 API
router.get('/download-pdf/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const path = require('path');
        const fs = require('fs');
        
        const reportsDir = path.join(__dirname, '../reports');
        const filePath = path.join(reportsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: '파일을 찾을 수 없습니다.'
            });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('PDF 다운로드 오류:', err);
                res.status(500).json({
                    success: false,
                    message: '파일 다운로드 중 오류가 발생했습니다.'
                });
            }
        });

    } catch (error) {
        console.error('PDF 다운로드 오류:', error);
        res.status(500).json({
            success: false,
            message: '파일 다운로드 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 프롬프트 구성 함수
function buildAnalysisPrompt(keyword, startDate, endDate, insights, newsData, naverTrend, googleTrend) {
    const newsCount = newsData?.totalCount || 0;
    const newsList = newsData?.news?.slice(0, 10).map((item, idx) => 
        `${idx + 1}. ${item.title} (${item.source}, ${item.pubDate})`
    ).join('\n') || '없음';

    const naverTrendData = naverTrend?.data?.map(item => 
        `${item.date}: ${item.value}`
    ).join('\n') || '데이터 없음';

    const googleTrendData = googleTrend?.data?.map(item => 
        `${item.date}: ${item.value}`
    ).join('\n') || '데이터 없음';

    return `
# 화제성 분석 보고서 작성 요청

## 분석 대상
- **키워드**: ${keyword}
- **분석 기간**: ${startDate} ~ ${endDate}
- **착안사항**: ${insights || '없음'}

## 수집된 데이터

### 1. 언론보도 효과성
- **총 보도건수**: ${newsCount}건
- **주요 보도내역**:
${newsList}

### 2. 네이버 검색트렌드
- **평균 검색량**: ${naverTrend?.avgValue || 0}
- **시계열 데이터**:
${naverTrendData}

### 3. 구글 검색트렌드
- **평균 검색량**: ${googleTrend?.avgValue || 0}
- **시계열 데이터**:
${googleTrendData}

---

위 데이터를 바탕으로 다음 구조로 마크다운 형식의 화제성 분석 보고서를 작성해주세요:

# ${keyword} 화제성 분석 보고서

## 📊 분석 개요
- 분석 기간: ${startDate} ~ ${endDate}
- 총 보도건수: ${newsCount}건
- 네이버 평균 검색량: ${naverTrend?.avgValue || 0}
- 구글 평균 검색량: ${googleTrend?.avgValue || 0}

## 📰 언론보도 현황
[언론보도 효과성에 대한 분석]

## 📈 검색트렌드 분석
[네이버와 구글 검색트렌드 비교 분석]

## 🔍 주요 발견사항
[데이터를 바탕으로 한 주요 발견사항]

## 💡 종합 분석
[착안사항을 반영한 종합 분석 및 인사이트]

## 📋 결론 및 제언
[결론 및 향후 제언]

---

**참고**: 마크다운 형식으로 작성하고, 표나 리스트를 적절히 활용해주세요.
`;
}

// 언론사 추출 함수 (네이버 뉴스 링크 처리 개선)
function extractSourceFromLink(link) {
    try {
        if (!link) return '알 수 없음';
        
        const url = new URL(link);
        const hostname = url.hostname;
        const pathname = url.pathname;
        
        // 네이버 뉴스 링크 처리 (n.news.naver.com/mnews/article/언론사ID/기사ID)
        if (hostname.includes('news.naver.com') || hostname.includes('n.news.naver.com')) {
            const articleMatch = pathname.match(/\/article\/([^\/]+)\//);
            if (articleMatch) {
                const mediaId = articleMatch[1];
                // 네이버 뉴스 언론사 ID 매핑 (주요 언론사)
                const naverMediaMap = {
                    '001': '연합뉴스',
                    '020': '동아일보',
                    '021': '조선일보',
                    '022': '중앙일보',
                    '023': '한겨레',
                    '025': '한국경제',
                    '028': '한국일보',
                    '030': '매일경제',
                    '031': '아시아경제',
                    '032': '이데일리',
                    '079': '노컷뉴스',
                    '081': '서울신문',
                    '082': '세계일보',
                    '087': '프레시안',
                    '088': '한국일보',
                    '092': '뉴스타파',
                    '094': '오마이뉴스',
                    '119': '조선비즈',
                    '215': '한국경제TV',
                    '277': '아시아투데이',
                    '293': '블로터',
                    '296': '전자신문',
                    '347': '디지털데일리',
                    '366': '아이뉴스24',
                    '421': '뉴스1',
                    '422': '연합뉴스TV',
                    '437': '이투데이',
                    '469': '뉴시스',
                    '586': '스포츠동아',
                    '629': '스포츠조선',
                    '656': '스포츠한국',
                    '658': '스포츠서울',
                    '660': '스포츠경향',
                    '662': '스포츠월드',
                    // 영문 ID 매핑
                    'idsn': '아이뉴스24',
                    'n': '네이버 뉴스',
                    'm-i': '머니투데이',
                    'biz': '비즈워치',
                    'edaily': '이데일리',
                    'munhwa': '문화일보',
                    'ikld': '아이클릭데일리',
                    'lawissue': '법률저널',
                    'mk': '매일경제',
                    'chosun': '조선일보',
                    'donga': '동아일보',
                    'joongang': '중앙일보',
                    'hani': '한겨레',
                    'khan': '경향신문',
                    'hankyung': '한국경제',
                    'fnnews': '파이낸셜뉴스',
                    'news1': '뉴스1',
                    'yonhap': '연합뉴스',
                    'newsis': '뉴시스',
                    'etnews': '전자신문',
                    'zdnet': 'ZDNet Korea',
                    'kbs': 'KBS',
                    'mbc': 'MBC',
                    'sbs': 'SBS',
                    'ytn': 'YTN',
                    'jtbc': 'JTBC'
                };
                
                if (naverMediaMap[mediaId]) {
                    return naverMediaMap[mediaId];
                }
                // 매핑되지 않은 경우 ID를 한글로 변환 시도
                return `언론사(${mediaId})`;
            }
        }
        
        // 주요 언론사 매핑
        const sourceMap = {
            'www.chosun.com': '조선일보',
            'www.donga.com': '동아일보',
            'www.joongang.co.kr': '중앙일보',
            'www.hani.co.kr': '한겨레',
            'www.khan.co.kr': '경향신문',
            'www.hankyung.com': '한국경제',
            'www.mk.co.kr': '매일경제',
            'www.etnews.com': '전자신문',
            'www.zdnet.co.kr': 'ZDNet Korea',
            'news.naver.com': '네이버 뉴스',
            'entertain.naver.com': '네이버 엔터테인먼트',
            'n.news.naver.com': '네이버 뉴스'
        };
        
        if (sourceMap[hostname]) {
            return sourceMap[hostname];
        }
        
        // 도메인에서 언론사명 추출 시도
        const domainParts = hostname.replace('www.', '').split('.');
        if (domainParts.length >= 2) {
            return domainParts[0];
        }
        
        return hostname.replace('www.', '');
    } catch (e) {
        return '알 수 없음';
    }
}

module.exports = router;
