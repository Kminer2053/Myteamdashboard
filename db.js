const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://park2053:admin0133@cluster0.yh7edwb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on('error', console.error.bind(console, '[MongoDB] 연결 에러:'));
db.once('open', () => {
  // console.log('[MongoDB] 연결 성공');
});

// 모델 정의
const Keyword = mongoose.model('Keyword', { value: String });

module.exports = { mongoose, Keyword }; 