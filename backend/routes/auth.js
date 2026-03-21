const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

const generateToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists)
      return res.status(409).json({
        error: exists.username === username
          ? 'Username already taken.'
          : 'Email already registered.'
      });

    const user = new User({ username, email, password });
    await user.save();
    res.status(201).json({ token: generateToken(user), user: user.toSafeObject() });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid username or password.' });

    res.json({ token: generateToken(user), user: user.toSafeObject() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/auth/save-score
router.post('/save-score', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { score, crashes, planesHandled } = req.body;

    await User.findByIdAndUpdate(decoded.userId, {
      $inc: {
        'stats.totalScore': score,
        'stats.gamesPlayed': 1,
        'stats.planesHandled': planesHandled || 0,
        'stats.crashes': crashes || 0
      },
      $max: { 'stats.highScore': score }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save score.' });
  }
});

// GET /api/auth/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}, 'username stats')
      .sort({ 'stats.highScore': -1 })
      .limit(20);
    res.json({
      leaderboard: users.map(u => ({
        username: u.username,
        highScore: u.stats.highScore,
        gamesPlayed: u.stats.gamesPlayed,
        planesHandled: u.stats.planesHandled
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

module.exports = router;
