const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  createdAt: { type: Date, default: Date.now },
  stats: {
    totalScore:     { type: Number, default: 0 },
    gamesPlayed:    { type: Number, default: 0 },
    planesHandled:  { type: Number, default: 0 },
    crashes:        { type: Number, default: 0 },
    highScore:      { type: Number, default: 0 }
  },
  unlockedLevels: { type: [Number], default: [1] }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    stats: this.stats,
    unlockedLevels: this.unlockedLevels,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
