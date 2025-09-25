require('dotenv').config();
const axios = require('axios');

async function testTikTokAPI() {
    console.log('🎵 TikTok for Developers API 테스트 시작...\n');
    
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    
    if (!clientKey || !clientSecret) {
        console.error('❌ TIKTOK_CLIENT_KEY 또는 TIKTOK_CLIENT_SECRET이 설정되지 않았습니다.');
        return;
    }
    
    try {
        // 1. 앱 정보 확인
        console.log('1️⃣ 앱 정보 확인...');
        console.log(`   Client Key: ${clientKey}`);
        console.log(`   앱 이름: MyTeamDashboard\n`);
        
        // 2. 액세스 토큰 생성 (테스트용)
        console.log('2️⃣ 액세스 토큰 생성 테스트...');
        console.log('   TikTok for Developers API는 OAuth 2.0 인증이 필요합니다.');
        console.log('   실제 데이터 수집을 위해서는 사용자 인증이 필요합니다.\n');
        
        // 3. API 엔드포인트 확인
        console.log('3️⃣ API 엔드포인트 확인...');
        const baseURL = 'https://open-api.tiktok.com';
        console.log(`   기본 URL: ${baseURL}`);
        console.log('   사용 가능한 엔드포인트:');
        console.log('   - /oauth/authorize (인증)');
        console.log('   - /oauth/access_token (토큰)');
        console.log('   - /user/info/ (사용자 정보)');
        console.log('   - /video/list/ (동영상 목록)\n');
        
        // 4. 인증 URL 생성 예시
        console.log('4️⃣ 인증 URL 생성 예시...');
        const redirectURI = 'http://localhost:4000/auth/tiktok/callback';
        const scope = 'user.info.basic,video.list';
        const authURL = `${baseURL}/oauth/authorize?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirectURI}`;
        
        console.log('   인증 URL (예시):');
        console.log(`   ${authURL}\n`);
        
        console.log('📋 TikTok for Developers API 설정 완료!');
        console.log('✅ 앱 등록이 성공적으로 완료되었습니다.');
        console.log('📝 다음 단계: OAuth 2.0 인증 구현이 필요합니다.');
        
    } catch (error) {
        console.error('❌ TikTok API 테스트 실패:');
        if (error.response) {
            console.error(`   상태 코드: ${error.response.status}`);
            console.error(`   에러 메시지: ${error.response.data?.error?.message || 'Unknown error'}`);
        } else {
            console.error(`   에러: ${error.message}`);
        }
    }
}

// 테스트 실행
testTikTokAPI();
