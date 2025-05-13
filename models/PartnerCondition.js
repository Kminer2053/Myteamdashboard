const mongoose = require('mongoose');

const PartnerConditionSchema = new mongoose.Schema({
  value: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PartnerCondition', PartnerConditionSchema); 