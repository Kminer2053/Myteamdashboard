const mongoose = require('mongoose');

const UserActionLogSchema = new mongoose.Schema({
  type: { type: String, required: true }, // kakao, dashboard, admin, db
  action: { type: String, required: true },
  userId: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
  meta: { type: mongoose.Schema.Types.Mixed }
});

module.exports = mongoose.model('UserActionLog', UserActionLogSchema); 