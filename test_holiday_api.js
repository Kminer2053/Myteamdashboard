const axios = require('axios');

// 현재 사용 중인 API 키
const API_KEY = '59c12627231e31f0c49b608447cbafdb00eeea0a469b5d1338b7268f03bcf0fb';
const year = 2025;

// 테스트 1: URL 인코딩 없이 직접 사용
async function test1_directKey() {
    console.log('\n=== 테스트 1: API 키를 직접 사용 (인코딩 없음) ===');
    try {
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${API_KEY}&solYear=${year}&_type=json&numOfRows=100`;
        console.log('요청 URL:', url.replace(API_KEY, 'API_KEY_HIDDEN'));
        console.log('요청 시작...');
        
        const response = await axios.get(url, {
            timeout: 10000, // 10초 타임아웃
            validateStatus: function (status) {
                return status < 500; // 5xx 에러만 throw
            }
        });
        
        console.log('상태 코드:', response.status);
        
        if (response.status === 200) {
            console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
            
            if (response.data.response && response.data.response.body && response.data.response.body.items) {
                const items = response.data.response.body.items.item;
                const holidays = Array.isArray(items) ? items : [items];
                console.log(`✅ 성공: ${year}년 공휴일 ${holidays.length}개 조회됨`);
                holidays.slice(0, 3).forEach(h => {
                    console.log(`  - ${h.locdate}: ${h.dateName}`);
                });
            } else {
                console.log('⚠️ 응답은 받았지만 데이터 구조가 예상과 다름');
            }
        } else {
            console.error(`❌ HTTP 에러: ${response.status} ${response.statusText}`);
            console.error('응답 본문:', response.data);
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('❌ 타임아웃: 요청이 10초 내에 완료되지 않음');
        } else if (error.response) {
            console.error('❌ 실패:', error.response.status, error.response.statusText);
            console.error('응답 본문:', error.response.data);
        } else {
            console.error('❌ 네트워크 에러:', error.message);
        }
    }
}

// 테스트 2: URL 인코딩 사용
async function test2_encodedKey() {
    console.log('\n=== 테스트 2: API 키를 URL 인코딩하여 사용 ===');
    try {
        const encodedKey = encodeURIComponent(API_KEY);
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${encodedKey}&solYear=${year}&_type=json&numOfRows=100`;
        console.log('요청 URL:', url.replace(encodedKey, 'API_KEY_HIDDEN'));
        
        const response = await axios.get(url);
        console.log('상태 코드:', response.status);
        console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
        
        if (response.data.response && response.data.response.body && response.data.response.body.items) {
            const items = response.data.response.body.items.item;
            const holidays = Array.isArray(items) ? items : [items];
            console.log(`✅ 성공: ${year}년 공휴일 ${holidays.length}개 조회됨`);
            holidays.slice(0, 3).forEach(h => {
                console.log(`  - ${h.locdate}: ${h.dateName}`);
            });
        }
    } catch (error) {
        console.error('❌ 실패:', error.response?.status, error.response?.statusText);
        console.error('응답 본문:', error.response?.data);
    }
}

// 테스트 3: 기존 키로 테스트 (만료된 키)
async function test3_oldKey() {
    console.log('\n=== 테스트 3: 기존 API 키로 테스트 (비교용) ===');
    try {
        const oldKey = 'DTrcjG%2BXCsB9m%2F6xPK4LmJ%2FG61dwF%2B3h%2FM7Rzv4IbI9ilfsqDRFErvOryzE45LblhwWpU4GSwuoA9W8CxVav5A%3D%3D';
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${oldKey}&solYear=${year}&_type=json&numOfRows=100`;
        console.log('요청 URL:', url.replace(oldKey, 'API_KEY_HIDDEN'));
        
        const response = await axios.get(url);
        console.log('상태 코드:', response.status);
        
        if (response.data.response && response.data.response.body && response.data.response.body.items) {
            const items = response.data.response.body.items.item;
            const holidays = Array.isArray(items) ? items : [items];
            console.log(`✅ 성공: ${year}년 공휴일 ${holidays.length}개 조회됨`);
        }
    } catch (error) {
        console.error('❌ 실패:', error.response?.status, error.response?.statusText);
        console.error('응답 본문:', error.response?.data);
    }
}

// 모든 테스트 실행
async function runTests() {
    console.log('한국천문연구원 공휴일 API 테스트 시작');
    console.log('='.repeat(60));
    
    await test1_directKey();
    await test2_encodedKey();
    await test3_oldKey();
    
    console.log('\n' + '='.repeat(60));
    console.log('테스트 완료');
}

runTests().catch(console.error);

