/**
 * 봇 API 인증 미들웨어
 * X-BOT-TOKEN 헤더를 확인하여 봇 요청을 인증합니다.
 */
function botAuthMiddleware(req, res, next) {
  const token = req.headers['x-bot-token'];
  
  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 없습니다' });
  }
  
  if (token !== process.env.BOT_API_TOKEN) {
    return res.status(401).json({ error: '인증 실패' });
  }
  
  next();
}

module.exports = botAuthMiddleware;
