const mongoose = require('mongoose');

const DBUsageSettingSchema = new mongoose.Schema({
  limitMB: { type: Number, required: true },
  deleteMB: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DBUsageSetting', DBUsageSettingSchema); 