const mongoose = require('mongoose');

const botOutboxSchema = new mongoose.Schema({
  // 필수 필드
  targetRoom: {
    type: String,
    required: true,
    trim: true,
    comment: '카카오톡 방 이름'
  },
  
  message: {
    type: String,
    required: true,
    comment: '전송할 메시지 텍스트'
  },
  
  type: {
    type: String,
    enum: ['schedule_create', 'schedule_update', 'schedule_delete', 'manual', 'daily_announce'],
    required: true,
    comment: '메시지 타입'
  },
  
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
    required: true,
    comment: '전송 상태'
  },
  
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    comment: '전송 시도 횟수'
  },
  
  lastError: {
    type: String,
    comment: '마지막 에러 메시지'
  },
  
  dedupeKey: {
    type: String,
    unique: true,
    sparse: true,
    comment: '중복 방지 키 (schedule:create:67a1b2c3:1737012345678)'
  },
  
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
    comment: '우선순위 (0=일반, 1+=긴급, 숫자가 클수록 우선)'
  },
  
  // 선택 필드
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    comment: '원본 스케줄 참조 (스케줄 관련 메시지인 경우)'
  },
  
  lockedAt: {
    type: Date,
    comment: '처리 잠금 시각 (pull 시 설정, 5분간 유효)'
  },
  
  lockedByDeviceId: {
    type: String,
    comment: '처리 중인 AVD 디바이스 ID'
  },
  
  sentAt: {
    type: Date,
    comment: '전송 완료 시각'
  }
}, {
  timestamps: true,
  comment: 'AVD 봇으로 전송할 카톡 메시지 큐'
});

// 인덱스
botOutboxSchema.index({ status: 1, priority: -1, createdAt: 1 }, {
  name: 'pull_query_index',
  comment: 'pull API 조회 최적화 (status별 우선순위 정렬)'
});

botOutboxSchema.index({ dedupeKey: 1 }, {
  name: 'dedupe_index',
  comment: '중복 메시지 방지',
  unique: true,
  sparse: true
});

botOutboxSchema.index({ lockedAt: 1 }, {
  name: 'lock_cleanup_index',
  comment: '잠금 만료 확인용'
});

botOutboxSchema.index({ sentAt: 1 }, {
  name: 'sent_log_index',
  comment: '전송 로그 조회용'
});

module.exports = mongoose.model('BotOutbox', botOutboxSchema);
