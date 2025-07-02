const mongoose = require('mongoose');

const StatMailSettingSchema = new mongoose.Schema({
  email: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StatMailSetting', StatMailSettingSchema); 