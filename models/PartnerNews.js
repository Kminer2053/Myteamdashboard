const mongoose = require('mongoose');
const PartnerNewsSchema = new mongoose.Schema({
  title: String,
  link: { type: String, unique: true },
  description: String,
  pubDate: String,
  keyword: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('PartnerNews', PartnerNewsSchema); 