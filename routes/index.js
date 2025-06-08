const express = require('express');
const router = express.Router();

// 기본 라우트
router.get('/', (req, res) => {
  res.send('API 서버가 정상적으로 실행 중입니다.');
});

module.exports = router; 