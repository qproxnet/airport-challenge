'use strict';

/**
 * App — top-level controller. Manages screens, auth, lobby, and wires
 * everything together.
 */
class App {
  constructor() {
    this.token    = localStorage.getItem('ac_token') || null;
    this.user     = JSON.parse(localStorage.getItem('ac_user') || 'null');
    this.game     = new GameClient();
    this.levels   = [];
    this.selectedLevel = 1;
    this.currentRoom   = null;

    window.app = this;

    this._bindAuth();
    this._bindLobby();
    this._bindWaiting();
    this._bindGameOver();

    // Auto-login if token present
    if (this.token) {
      this._initLobby();
    } else {
      this.showScreen('auth');
    }
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${name}`);
    if (el) el.classList.add('active');
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  _bindAuth() {
    // Toggle forms
    document.getElementById('link-to-register').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('form-login').classList.remove('active');
      document.getElementById('form-register').classList.add('active');
    });
    document.getElementById('link-to-login').addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('form-register').classList.remove('active');
      document.getElementById('form-login').classList.add('active');
    });

    // Login
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-login');
      btn.disabled = true;
      btn.textContent = 'Einloggen…';

      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res  = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fehler beim Einloggen');
        this._saveSession(data.token, data.user);
        this._initLobby();
      } catch (err) {
        document.getElementById('login-error').textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Einloggen';
      }
    });

    // Register
    document.getElementById('form-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-register');
      btn.disabled = true;
      btn.textContent = 'Account erstellen…';

      const username = document.getElementById('reg-username').value.trim();
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

      try {
        const res  = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fehler bei der Registrierung');
        this._saveSession(data.token, data.user);
        this._initLobby();
      } catch (err) {
        document.getElementById('register-error').textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Account erstellen';
      }
    });
  }

  _saveSession(token, user) {
    this.token = token;
    this.user  = user;
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify(user));
  }

  _clearSession() {
    this.token = null;
    this.user  = null;
    localStorage.removeItem('ac_token');
    localStorage.removeItem('ac_user');
  }

  handleAuthError() {
    this._clearSession();
    this.game.disconnect();
    this.showScreen('auth');
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────

  async _initLobby() {
    this.game.connect(this.token);
    document.getElementById('lobby-username').textContent = this.user?.username || '';
    this.showScreen('lobby');
    await this._loadLevels();
    this._renderLevels();
    this._loadLeaderboard();
  }

  async _loadLevels() {
    try {
      const res  = await fetch('/api/levels');
      const data = await res.json();
      this.levels = data.levels || [];
    } catch { this.levels = []; }
  }

  _renderLevels() {
    const list     = document.getElementById('level-list');
    const unlocked = new Set(this.user?.unlockedLevels || [1]);
    list.innerHTML = '';

    for (const lv of this.levels) {
      const locked = !unlocked.has(lv.id);
      const card   = document.createElement('div');
      card.className = `level-card${locked ? ' locked' : ''}${this.selectedLevel === lv.id ? ' selected' : ''}`;
      card.innerHTML = `
        <div class="level-num">${locked ? '🔒' : lv.id}</div>
        <div class="level-info">
          <div class="level-name">${lv.name}</div>
          <div class="level-desc">${lv.description}</div>
          ${lv.requiredScore ? `<div class="level-score">Benötigt: ${lv.requiredScore.toLocaleString()} Punkte</div>` : ''}
        </div>
      `;
      if (!locked) {
        card.addEventListener('click', () => {
          document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.selectedLevel = lv.id;
        });
      }
      list.appendChild(card);
    }
  }

  async _loadLeaderboard() {
    const el = document.getElementById('leaderboard-list');
    try {
      const res  = await fetch('/api/auth/leaderboard');
      const data = await res.json();
      const rows = data.leaderboard || [];
      if (rows.length === 0) {
        el.innerHTML = '<div class="loading">Noch keine Einträge.</div>';
        return;
      }
      const medals = ['top1', 'top2', 'top3'];
      el.innerHTML = rows.map((r, i) => `
        <div class="lb-row">
          <div class="lb-rank ${medals[i] || ''}">${i + 1}.</div>
          <div class="lb-name">${r.username}</div>
          <div class="lb-score">${r.highScore.toLocaleString()}</div>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div class="loading">Rangliste nicht verfügbar.</div>';
    }
  }

  _bindLobby() {
    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      this._clearSession();
      this.game.disconnect();
      this.showScreen('auth');
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'leaderboard') this._loadLeaderboard();
      });
    });

    // Join room
    document.getElementById('btn-join-room').addEventListener('click', () => {
      let roomId = document.getElementById('room-id-input').value.trim().toUpperCase();
      if (!roomId) {
        // Generate random room ID
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      this._joinRoom(roomId, this.selectedLevel);
    });
  }

  _joinRoom(roomId, levelId) {
    this.currentRoom = roomId;
    document.getElementById('waiting-room-id').textContent = roomId;
    this.showScreen('waiting');
    this.game.joinRoom(roomId, levelId);
  }

  // ── Waiting screen ────────────────────────────────────────────────────────

  _bindWaiting() {
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.game.startGame();
    });

    document.getElementById('btn-leave-room').addEventListener('click', () => {
      this.game.disconnect();
      this.game.connect(this.token);
      this.showScreen('lobby');
    });
  }

  // ── Game over ─────────────────────────────────────────────────────────────

  _bindGameOver() {
    document.getElementById('btn-play-again').addEventListener('click', () => {
      if (this.currentRoom) {
        this._joinRoom(this.currentRoom, this.selectedLevel);
      }
    });

    document.getElementById('btn-back-lobby').addEventListener('click', () => {
      this.game.disconnect();
      this.game.connect(this.token);
      this._initLobby();
    });
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
