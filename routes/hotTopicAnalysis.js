const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const HotTopicDataCollector = require('../services/hotTopicDataCollector');
const HotTopicAnalysis = require('../models/HotTopicAnalysis');
const WeightSetting = require('../models/WeightSetting');
const ReportGenerator = require('../services/reportGenerator');

// 화제성 분석 시작
router.post('/start', async (req, res) => {
    try {
        const { keywords, startDate, endDate, sources } = req.body;
        
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                message: '키워드가 필요합니다.'
            });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '시작일과 종료일이 필요합니다.'
            });
        }

        // 날짜 유효성 검사
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

        // 데이터 수집 시작
        const collector = new HotTopicDataCollector();
        const results = await collector.collectHotTopicData(keywords, start, end, sources);

        res.json({
            success: true,
            message: '화제성 분석이 완료되었습니다.',
            data: results
        });

    } catch (error) {
        console.error('화제성 분석 오류:', error);
        res.status(500).json({
            success: false,
            message: '화제성 분석 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 화제성 분석 결과 조회
router.get('/results', async (req, res) => {
    try {
        const { keyword, startDate, endDate, limit = 10 } = req.query;
        
        const query = {};
        
        if (keyword) {
            query.keyword = keyword;
        }
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const results = await HotTopicAnalysis.find(query)
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .populate('weightSettingId', 'name description');

        res.json({
            success: true,
            data: results
        });

    } catch (error) {
        console.error('화제성 분석 결과 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '결과 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 특정 키워드의 시계열 데이터 조회
router.get('/timeseries/:keyword', async (req, res) => {
    try {
        const { keyword } = req.params;
        const { startDate, endDate } = req.query;
        
        const query = { keyword };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const results = await HotTopicAnalysis.find(query)
            .sort({ date: 1 })
            .select('date metrics keyword');

        // 시계열 데이터 포맷팅
        const timeseriesData = {
            labels: results.map(item => item.date.toISOString().split('T')[0]),
            datasets: [
                {
                    label: '종합 지수',
                    data: results.map(item => item.metrics.overall),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4
                },
                {
                    label: '노출 지수',
                    data: results.map(item => item.metrics.exposure),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.4
                },
                {
                    label: '참여 지수',
                    data: results.map(item => item.metrics.engagement),
                    borderColor: '#198754',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    tension: 0.4
                },
                {
                    label: '수요 지수',
                    data: results.map(item => item.metrics.demand),
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4
                }
            ]
        };

        res.json({
            success: true,
            data: timeseriesData
        });

    } catch (error) {
        console.error('시계열 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '시계열 데이터 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 특정 날짜의 상세 데이터 조회
router.get('/detail/:keyword/:date', async (req, res) => {
    try {
        const { keyword, date } = req.params;
        
        const result = await HotTopicAnalysis.findOne({
            keyword: keyword,
            date: new Date(date)
        }).populate('weightSettingId', 'name description');

        if (!result) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 분석 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('상세 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '상세 데이터 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 키워드별 통계 조회
router.get('/stats/:keyword', async (req, res) => {
    try {
        const { keyword } = req.params;
        const { startDate, endDate } = req.query;
        
        const query = { keyword };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const results = await HotTopicAnalysis.find(query)
            .sort({ date: -1 });

        if (results.length === 0) {
            return res.json({
                success: true,
                data: {
                    keyword: keyword,
                    totalAnalyses: 0,
                    avgMetrics: {
                        exposure: 0,
                        engagement: 0,
                        demand: 0,
                        overall: 0
                    },
                    maxMetrics: {
                        exposure: 0,
                        engagement: 0,
                        demand: 0,
                        overall: 0
                    },
                    minMetrics: {
                        exposure: 0,
                        engagement: 0,
                        demand: 0,
                        overall: 0
                    },
                    trend: 'stable'
                }
            });
        }

        // 통계 계산
        const totalAnalyses = results.length;
        
        const avgMetrics = {
            exposure: Math.round(results.reduce((sum, item) => sum + item.metrics.exposure, 0) / totalAnalyses),
            engagement: Math.round(results.reduce((sum, item) => sum + item.metrics.engagement, 0) / totalAnalyses),
            demand: Math.round(results.reduce((sum, item) => sum + item.metrics.demand, 0) / totalAnalyses),
            overall: Math.round(results.reduce((sum, item) => sum + item.metrics.overall, 0) / totalAnalyses)
        };

        const maxMetrics = {
            exposure: Math.max(...results.map(item => item.metrics.exposure)),
            engagement: Math.max(...results.map(item => item.metrics.engagement)),
            demand: Math.max(...results.map(item => item.metrics.demand)),
            overall: Math.max(...results.map(item => item.metrics.overall))
        };

        const minMetrics = {
            exposure: Math.min(...results.map(item => item.metrics.exposure)),
            engagement: Math.min(...results.map(item => item.metrics.engagement)),
            demand: Math.min(...results.map(item => item.metrics.demand)),
            overall: Math.min(...results.map(item => item.metrics.overall))
        };

        // 트렌드 분석 (최근 3개 데이터 기준)
        let trend = 'stable';
        if (results.length >= 3) {
            const recent = results.slice(0, 3);
            const first = recent[2].metrics.overall;
            const last = recent[0].metrics.overall;
            
            if (last > first + 5) {
                trend = 'increasing';
            } else if (last < first - 5) {
                trend = 'decreasing';
            }
        }

        res.json({
            success: true,
            data: {
                keyword: keyword,
                totalAnalyses: totalAnalyses,
                avgMetrics: avgMetrics,
                maxMetrics: maxMetrics,
                minMetrics: minMetrics,
                trend: trend
            }
        });

    } catch (error) {
        console.error('키워드 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '통계 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 분석 데이터 삭제
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await HotTopicAnalysis.findByIdAndDelete(id);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: '분석 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '분석 데이터가 삭제되었습니다.'
        });

    } catch (error) {
        console.error('분석 데이터 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 삭제 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 키워드 목록 조회
router.get('/keywords', async (req, res) => {
    try {
        const keywords = await HotTopicAnalysis.distinct('keyword');
        
        res.json({
            success: true,
            data: keywords
        });

    } catch (error) {
        console.error('키워드 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '키워드 목록 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 보고서 다운로드
router.get('/report/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const analysis = await HotTopicAnalysis.findById(id);
        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: '분석 데이터를 찾을 수 없습니다.'
            });
        }

        if (!analysis.reportPath || !fs.existsSync(analysis.reportPath)) {
            return res.status(404).json({
                success: false,
                message: '보고서 파일을 찾을 수 없습니다.'
            });
        }

        res.download(analysis.reportPath, `hot-topic-report-${analysis.keyword}.html`);

    } catch (error) {
        console.error('보고서 다운로드 오류:', error);
        res.status(500).json({
            success: false,
            message: '보고서 다운로드 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 보고서 재생성
router.post('/report/:id/regenerate', async (req, res) => {
    try {
        const { id } = req.params;
        
        const analysis = await HotTopicAnalysis.findById(id);
        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: '분석 데이터를 찾을 수 없습니다.'
            });
        }

        const reportGenerator = new ReportGenerator();
        const reportResult = await reportGenerator.generateHTMLReport(analysis, analysis.aiInsights);
        
        if (reportResult.success) {
            analysis.reportPath = reportResult.filePath;
            analysis.reportId = reportResult.reportId;
            await analysis.save();
            
            res.json({
                success: true,
                message: '보고서가 재생성되었습니다.',
                reportId: reportResult.reportId
            });
        } else {
            res.status(500).json({
                success: false,
                message: '보고서 생성에 실패했습니다.',
                error: reportResult.error
            });
        }

    } catch (error) {
        console.error('보고서 재생성 오류:', error);
        res.status(500).json({
            success: false,
            message: '보고서 재생성 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 보고서 목록 조회
router.get('/reports', async (req, res) => {
    try {
        const reportGenerator = new ReportGenerator();
        const reports = reportGenerator.getReportList();
        
        res.json({
            success: true,
            data: reports
        });

    } catch (error) {
        console.error('보고서 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '보고서 목록 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router;