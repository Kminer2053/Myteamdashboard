const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date },
  content: { type: String },
  allDay: { type: Boolean, default: false },
  backgroundColor: { type: String, default: '#1976d2' },
  borderColor: { type: String, default: '#1976d2' },
  textColor: { type: String, default: '#fff' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Schedule', ScheduleSchema); 