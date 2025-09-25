const fs = require('fs');
const path = require('path');
const AIInsightService = require('./aiInsightService');

class ReportGenerator {
    constructor() {
        this.aiInsightService = new AIInsightService();
        this.reportsDir = path.join(__dirname, '../reports');
        
        // 보고서 디렉토리 생성
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    // HTML 보고서 생성
    async generateHTMLReport(analysisData, insights) {
        try {
            console.log(`📄 HTML 보고서 생성: ${analysisData.keyword}`);
            
            const reportData = {
                ...analysisData,
                insights: insights,
                generatedAt: new Date(),
                reportId: this.generateReportId()
            };

            const htmlContent = this.buildHTMLReport(reportData);
            const fileName = `hot-topic-report-${analysisData.keyword}-${Date.now()}.html`;
            const filePath = path.join(this.reportsDir, fileName);

            fs.writeFileSync(filePath, htmlContent, 'utf8');

            return {
                success: true,
                fileName: fileName,
                filePath: filePath,
                reportId: reportData.reportId
            };

        } catch (error) {
            console.error('HTML 보고서 생성 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // HTML 보고서 내용 구성
    buildHTMLReport(data) {
        const { keyword, metrics, sources, insights, generatedAt, reportId } = data;
        
        // metrics가 없는 경우 기본값 설정
        const safeMetrics = metrics || {
            overall: 0,
            exposure: 0,
            engagement: 0,
            demand: 0
        };
        
        // sources가 없는 경우 기본값 설정
        const safeSources = sources || {
            news: { articleCount: 0, totalViews: 0, topArticles: [] },
            trend: { relativeRatio: 0, searchVolume: 0 },
            youtube: { totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0 },
            twitter: { tweetCount: 0, totalLikes: 0, totalRetweets: 0, totalReplies: 0 },
            instagram: { postCount: 0, totalLikes: 0, totalComments: 0, totalShares: 0 },
            tiktok: { totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0 }
        };
        
        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>화제성 분석 보고서 - ${keyword}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .section {
            background: white;
            margin-bottom: 30px;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section h2 {
            color: #667eea;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .metric-card h3 {
            margin: 0 0 10px 0;
            font-size: 1.2em;
        }
        .metric-score {
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-grade {
            font-size: 1.1em;
            opacity: 0.9;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .data-table th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .insight-card {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 15px 0;
            border-radius: 0 5px 5px 0;
        }
        .insight-card h4 {
            margin: 0 0 10px 0;
            color: #667eea;
        }
        .insight-list {
            list-style: none;
            padding: 0;
        }
        .insight-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .insight-list li:before {
            content: "•";
            color: #667eea;
            font-weight: bold;
            margin-right: 10px;
        }
        .chart-placeholder {
            background: #f8f9fa;
            border: 2px dashed #ddd;
            padding: 40px;
            text-align: center;
            border-radius: 10px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding: 20px;
            color: #666;
            border-top: 1px solid #eee;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            background-color: #667eea;
            color: white;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 5px;
        }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-stable { color: #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔥 화제성 분석 보고서</h1>
        <p>키워드: <strong>${keyword}</strong> | 생성일: ${generatedAt.toLocaleDateString('ko-KR')} ${generatedAt.toLocaleTimeString('ko-KR')}</p>
        <p>보고서 ID: ${reportId}</p>
    </div>

    <div class="section">
        <h2>📊 종합 지수</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>종합 지수</h3>
                <div class="metric-score">${safeMetrics.overall}</div>
                <div class="metric-grade">${this.getGradeText(safeMetrics.overall)}</div>
            </div>
            <div class="metric-card">
                <h3>노출 지수</h3>
                <div class="metric-score">${safeMetrics.exposure}</div>
                <div class="metric-grade">${this.getGradeText(safeMetrics.exposure)}</div>
            </div>
            <div class="metric-card">
                <h3>참여 지수</h3>
                <div class="metric-score">${safeMetrics.engagement}</div>
                <div class="metric-grade">${this.getGradeText(safeMetrics.engagement)}</div>
            </div>
            <div class="metric-card">
                <h3>수요 지수</h3>
                <div class="metric-score">${safeMetrics.demand}</div>
                <div class="metric-grade">${this.getGradeText(safeMetrics.demand)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📰 데이터 소스별 분석</h2>
        
        <h3>뉴스 데이터</h3>
        <table class="data-table">
            <tr>
                <th>지표</th>
                <th>값</th>
                <th>설명</th>
            </tr>
            <tr>
                <td>기사 수</td>
                <td>${safeSources.news.articleCount}개</td>
                <td>분석 기간 내 관련 기사 수</td>
            </tr>
            <tr>
                <td>총 조회수</td>
                <td>${safeSources.news.totalViews.toLocaleString()}회</td>
                <td>모든 기사의 총 조회수</td>
            </tr>
            <tr>
                <td>평균 조회수</td>
                <td>${safeSources.news.avgViews.toLocaleString()}회</td>
                <td>기사당 평균 조회수</td>
            </tr>
        </table>

        <h3>검색 트렌드</h3>
        <table class="data-table">
            <tr>
                <th>지표</th>
                <th>값</th>
                <th>설명</th>
            </tr>
            <tr>
                <td>검색량</td>
                <td>${safeSources.trend.searchVolume}</td>
                <td>네이버 검색 트렌드 지수</td>
            </tr>
            <tr>
                <td>트렌드 점수</td>
                <td>${safeSources.trend.trendScore}</td>
                <td>평균 트렌드 점수</td>
            </tr>
            <tr>
                <td>쇼핑인사이트</td>
                <td>${safeSources.trend.shoppingInsight}</td>
                <td>쇼핑 관련 관심도</td>
            </tr>
        </table>

        <h3>YouTube 데이터</h3>
        <table class="data-table">
            <tr>
                <th>지표</th>
                <th>값</th>
                <th>설명</th>
            </tr>
            <tr>
                <td>동영상 수</td>
                <td>${safeSources.youtube.videoCount}개</td>
                <td>관련 동영상 수</td>
            </tr>
            <tr>
                <td>총 조회수</td>
                <td>${safeSources.youtube.totalViews.toLocaleString()}회</td>
                <td>모든 동영상의 총 조회수</td>
            </tr>
            <tr>
                <td>총 좋아요</td>
                <td>${safeSources.youtube.totalLikes.toLocaleString()}개</td>
                <td>모든 동영상의 총 좋아요</td>
            </tr>
            <tr>
                <td>총 댓글</td>
                <td>${safeSources.youtube.totalComments.toLocaleString()}개</td>
                <td>모든 동영상의 총 댓글</td>
            </tr>
        </table>

        <h3>Twitter 데이터</h3>
        <table class="data-table">
            <tr>
                <th>지표</th>
                <th>값</th>
                <th>설명</th>
            </tr>
            <tr>
                <td>트윗 수</td>
                <td>${safeSources.twitter.tweetCount}개</td>
                <td>관련 트윗 수</td>
            </tr>
            <tr>
                <td>총 좋아요</td>
                <td>${safeSources.twitter.totalLikes.toLocaleString()}개</td>
                <td>모든 트윗의 총 좋아요</td>
            </tr>
            <tr>
                <td>총 리트윗</td>
                <td>${safeSources.twitter.totalRetweets.toLocaleString()}개</td>
                <td>모든 트윗의 총 리트윗</td>
            </tr>
            <tr>
                <td>총 댓글</td>
                <td>${safeSources.twitter.totalReplies.toLocaleString()}개</td>
                <td>모든 트윗의 총 댓글</td>
            </tr>
        </table>
    </div>

    <div class="section">
        <h2>🤖 AI 인사이트</h2>
        
        <div class="insight-card">
            <h4>🎯 핵심 요약</h4>
            <p>${insights.summary}</p>
        </div>

        <div class="insight-card">
            <h4>📊 데이터 해석</h4>
            <h5>노출 지수 분석</h5>
            <p>${insights.dataInterpretation.exposure}</p>
            <h5>참여 지수 분석</h5>
            <p>${insights.dataInterpretation.engagement}</p>
            <h5>수요 지수 분석</h5>
            <p>${insights.dataInterpretation.demand}</p>
        </div>

        <div class="insight-card">
            <h4>🔍 주요 발견사항</h4>
            <ul class="insight-list">
                ${insights.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
            </ul>
        </div>

        <div class="insight-card">
            <h4>💡 전략적 제안</h4>
            <h5>단기 전략 (1-2주)</h5>
            <ul class="insight-list">
                ${insights.strategicRecommendations.shortTerm.map(item => `<li>${item}</li>`).join('')}
            </ul>
            <h5>중기 전략 (1-3개월)</h5>
            <ul class="insight-list">
                ${insights.strategicRecommendations.mediumTerm.map(item => `<li>${item}</li>`).join('')}
            </ul>
            <h5>장기 전략 (3-6개월)</h5>
            <ul class="insight-list">
                ${insights.strategicRecommendations.longTerm.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>

        <div class="insight-card">
            <h4>📈 트렌드 전망</h4>
            <h5>긍정적 요인</h5>
            <ul class="insight-list">
                ${insights.trendOutlook.positiveFactors.map(factor => `<li>${factor}</li>`).join('')}
            </ul>
            <h5>부정적 요인</h5>
            <ul class="insight-list">
                ${insights.trendOutlook.negativeFactors.map(factor => `<li>${factor}</li>`).join('')}
            </ul>
            <h5>예상 시나리오</h5>
            <p><strong>최적 시나리오:</strong> ${insights.trendOutlook.scenarios.best}</p>
            <p><strong>기본 시나리오:</strong> ${insights.trendOutlook.scenarios.base}</p>
            <p><strong>최악 시나리오:</strong> ${insights.trendOutlook.scenarios.worst}</p>
        </div>

        <div class="insight-card">
            <h4>⚠️ 주의사항</h4>
            <ul class="insight-list">
                ${insights.riskFactors.map(risk => `<li>${risk}</li>`).join('')}
            </ul>
        </div>

        <div class="insight-card">
            <h4>🎯 기회요소</h4>
            <ul class="insight-list">
                ${insights.opportunities.map(opportunity => `<li>${opportunity}</li>`).join('')}
            </ul>
        </div>

        <div class="insight-card">
            <h4>📋 액션 아이템</h4>
            <ul class="insight-list">
                ${insights.actionItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>
    </div>

    <div class="section">
        <h2>📊 시각화 차트</h2>
        <div class="chart-placeholder">
            <h3>📈 지수별 비교 차트</h3>
            <p>차트는 웹 대시보드에서 확인하실 수 있습니다.</p>
        </div>
    </div>

    <div class="footer">
        <p>이 보고서는 MyTeamDashboard 화제성 분석 시스템에 의해 자동 생성되었습니다.</p>
        <p>생성 시간: ${generatedAt.toLocaleString('ko-KR')}</p>
    </div>
</body>
</html>`;
    }

    // 등급 텍스트 변환
    getGradeText(score) {
        if (score >= 81) return '매우 높음';
        if (score >= 61) return '높음';
        if (score >= 41) return '보통';
        if (score >= 21) return '낮음';
        return '매우 낮음';
    }

    // 보고서 ID 생성
    generateReportId() {
        return 'RPT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    // JSON 보고서 생성
    async generateJSONReport(analysisData, insights) {
        try {
            console.log(`📄 JSON 보고서 생성: ${analysisData.keyword}`);
            
            const reportData = {
                reportId: this.generateReportId(),
                keyword: analysisData.keyword,
                generatedAt: new Date(),
                metrics: analysisData.metrics,
                sources: analysisData.sources,
                insights: insights,
                metadata: {
                    version: '1.0',
                    generator: 'MyTeamDashboard',
                    dataQuality: analysisData.dataQuality || 'medium'
                }
            };

            const fileName = `hot-topic-report-${analysisData.keyword}-${Date.now()}.json`;
            const filePath = path.join(this.reportsDir, fileName);

            fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf8');

            return {
                success: true,
                fileName: fileName,
                filePath: filePath,
                reportId: reportData.reportId
            };

        } catch (error) {
            console.error('JSON 보고서 생성 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 보고서 목록 조회
    getReportList() {
        try {
            const files = fs.readdirSync(this.reportsDir);
            const reports = files
                .filter(file => file.endsWith('.html') || file.endsWith('.json'))
                .map(file => {
                    const stats = fs.statSync(path.join(this.reportsDir, file));
                    return {
                        fileName: file,
                        filePath: path.join(this.reportsDir, file),
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    };
                })
                .sort((a, b) => b.modified - a.modified);

            return reports;
        } catch (error) {
            console.error('보고서 목록 조회 오류:', error);
            return [];
        }
    }

    // 보고서 삭제
    deleteReport(fileName) {
        try {
            const filePath = path.join(this.reportsDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true };
            } else {
                return { success: false, error: '파일을 찾을 수 없습니다.' };
            }
        } catch (error) {
            console.error('보고서 삭제 오류:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ReportGenerator;
