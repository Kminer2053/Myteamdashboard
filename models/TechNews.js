const mongoose = require('mongoose');
const TechNewsSchema = new mongoose.Schema({
  title: String,
  link: { type: String, unique: true },
  description: String,
  pubDate: String,
  keyword: String,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('TechNews', TechNewsSchema); 