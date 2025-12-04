const googleTrends = require('google-trends-api');

class GoogleTrendsService {
    constructor() {
        this.geo = 'KR'; // 한국 지역
    }

    /**
     * 구글 트렌드 데이터 수집
     * @param {string} keyword - 검색 키워드
     * @param {Date} startDate - 시작일
     * @param {Date} endDate - 종료일
     * @returns {Promise<Object>} 트렌드 데이터
     */
    async getTrendData(keyword, startDate, endDate) {
        try {
            console.log(`🔍 구글 트렌드 데이터 수집: ${keyword}`);
            
            // 날짜 형식 변환 (YYYY-MM-DD)
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            // Google Trends API 호출
            const results = await googleTrends.interestOverTime({
                keyword: keyword,
                startTime: startDate,
                endTime: endDate,
                geo: this.geo
            });

            const data = JSON.parse(results);
            
            if (!data.default || !data.default.timelineData) {
                console.log(`⚠️ 구글 트렌드 데이터 없음: ${keyword}`);
                return {
                    keyword: keyword,
                    data: [],
                    totalVolume: 0,
                    avgValue: 0
                };
            }

            // 시계열 데이터 포맷팅
            const timelineData = data.default.timelineData;
            const formattedData = timelineData.map(item => ({
                date: item.formattedTime || item.time,
                value: item.value[0] || 0, // 검색량 지수 (0-100)
                formattedValue: item.formattedValue ? item.formattedValue[0] : '0'
            }));

            // 통계 계산
            const totalVolume = formattedData.reduce((sum, item) => sum + item.value, 0);
            const avgValue = Math.round(totalVolume / Math.max(formattedData.length, 1));

            console.log(`✅ 구글 트렌드 데이터 수집 완료: ${keyword} (${formattedData.length}개 데이터 포인트)`);

            return {
                keyword: keyword,
                data: formattedData,
                totalVolume: totalVolume,
                avgValue: avgValue,
                period: {
                    startDate: startDateStr,
                    endDate: endDateStr
                }
            };

        } catch (error) {
            console.error(`❌ 구글 트렌드 데이터 수집 오류 (${keyword}):`, error.message);
            
            // 에러 발생 시 빈 데이터 반환
            return {
                keyword: keyword,
                data: [],
                totalVolume: 0,
                avgValue: 0,
                error: error.message
            };
        }
    }

    /**
     * 여러 키워드 비교 트렌드 (현재는 사용 안 함)
     */
    async getComparisonTrends(keywords, startDate, endDate) {
        try {
            const results = await googleTrends.interestOverTime({
                keyword: keywords,
                startTime: startDate,
                endTime: endDate,
                geo: this.geo
            });

            return JSON.parse(results);
        } catch (error) {
            console.error('구글 트렌드 비교 오류:', error);
            throw error;
        }
    }
}

module.exports = GoogleTrendsService;

