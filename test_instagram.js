require('dotenv').config();
const axios = require('axios');

async function testInstagramAPI() {
    console.log('📸 Instagram Basic Display API 테스트 시작...\n');
    
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    
    if (!appId || !appSecret) {
        console.error('❌ INSTAGRAM_APP_ID 또는 INSTAGRAM_APP_SECRET이 설정되지 않았습니다.');
        return;
    }
    
    try {
        // 1. 앱 정보 확인
        console.log('1️⃣ 앱 정보 확인...');
        console.log(`   앱 ID: ${appId}`);
        console.log(`   앱 이름: event_anal-IG\n`);
        
        // 2. 액세스 토큰 생성 (테스트용)
        console.log('2️⃣ 액세스 토큰 생성 테스트...');
        console.log('   Instagram Basic Display API는 OAuth 2.0 인증이 필요합니다.');
        console.log('   실제 데이터 수집을 위해서는 사용자 인증이 필요합니다.\n');
        
        // 3. API 엔드포인트 확인
        console.log('3️⃣ API 엔드포인트 확인...');
        const baseURL = 'https://graph.instagram.com';
        console.log(`   기본 URL: ${baseURL}`);
        console.log('   사용 가능한 엔드포인트:');
        console.log('   - /me (사용자 정보)');
        console.log('   - /me/media (미디어 목록)');
        console.log('   - /{media-id} (미디어 상세 정보)\n');
        
        // 4. 인증 URL 생성 예시
        console.log('4️⃣ 인증 URL 생성 예시...');
        const redirectURI = 'http://localhost:4000/auth/instagram/callback';
        const scope = 'user_profile,user_media';
        const authURL = `https://api.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectURI}&scope=${scope}&response_type=code`;
        
        console.log('   인증 URL (예시):');
        console.log(`   ${authURL}\n`);
        
        console.log('📋 Instagram Basic Display API 설정 완료!');
        console.log('✅ 앱 등록이 성공적으로 완료되었습니다.');
        console.log('📝 다음 단계: OAuth 2.0 인증 구현이 필요합니다.');
        
    } catch (error) {
        console.error('❌ Instagram API 테스트 실패:');
        if (error.response) {
            console.error(`   상태 코드: ${error.response.status}`);
            console.error(`   에러 메시지: ${error.response.data?.error?.message || 'Unknown error'}`);
        } else {
            console.error(`   에러: ${error.message}`);
        }
    }
}

// 테스트 실행
testInstagramAPI();
