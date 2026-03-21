'use strict';

/**
 * GameClient — manages the Socket.io connection, game state,
 * canvas interaction, and HUD updates.
 */
class GameClient {
  constructor() {
    this.socket     = null;
    this.renderer   = null;
    this.state      = null;        // latest game state from server
    this.selectedId = null;        // currently selected plane id
    this.animFrame  = null;
    this.token      = null;
    this.currentRoom = null;

    this._canvas = document.getElementById('game-canvas');
    this._renderer = new AirportRenderer(this._canvas);

    this._bindCanvas();
  }

  // ── Connection ────────────────────────────────────────────────────────────

  connect(token) {
    this.token = token;
    if (this.socket) { this.socket.disconnect(); }

    this.socket = io({ auth: { token } });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket.id);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Auth error:', err.message);
      window.app && window.app.handleAuthError();
    });

    this.socket.on('game_state',  s => this._onGameState(s));
    this.socket.on('game_started', () => {
      console.log('[Game] Started!');
      window.app && window.app.showScreen('game');
      this._startRender();
    });
    this.socket.on('game_over',  d => this._onGameOver(d));
    this.socket.on('player_joined', d => this._onPlayerJoined(d));
    this.socket.on('player_left',   d => this._onPlayerLeft(d));
    this.socket.on('cmd_error',  d => this._showMsg(d.message, 'warn'));
  }

  joinRoom(roomId, levelId) {
    this.currentRoom = roomId;
    this.socket.emit('join_room', { roomId, levelId });
  }

  startGame() {
    this.socket.emit('start_game');
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this._stopRender();
  }

  // ── Game state ────────────────────────────────────────────────────────────

  _onGameState(state) {
    const wasLobby = !this.state || this.state.gameState === 'lobby';
    this.state = state;

    // Update waiting screen players if still in lobby
    if (state.gameState === 'lobby') {
      this._updateWaitingPlayers(state.players);
      return;
    }

    this._updateHUD(state);
    this._processMessages(state.messages);

    // Auto-deselect if selected plane disappeared
    if (this.selectedId && !state.planes.find(p => p.id === this.selectedId)) {
      this.selectedId = null;
      this._updateCommandPanel(null);
    }

    // Update command panel for selected plane
    if (this.selectedId) {
      const p = state.planes.find(p => p.id === this.selectedId);
      this._updateCommandPanel(p || null);
    }
  }

  _onGameOver(data) {
    this._stopRender();

    const icon  = data.reason === 'completed' ? '🏆' : '💥';
    const title = data.reason === 'completed' ? 'Abgeschlossen!' : 'Spiel vorbei!';
    const reason = data.reason === 'completed'
      ? `Alle ${data.day} Tage erfolgreich abgefertigt!`
      : `${data.crashes} Crashs – du wurdest gefeuert!`;

    document.getElementById('gameover-icon').textContent  = icon;
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-reason').textContent = reason;
    document.getElementById('go-score').textContent  = data.score.toLocaleString();
    document.getElementById('go-day').textContent    = data.day;
    document.getElementById('go-crashes').textContent = data.crashes;

    // Save score
    if (this.token && data.score > 0) {
      fetch('/api/auth/save-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
        body: JSON.stringify({ score: data.score, crashes: data.crashes })
      }).catch(() => {});
    }

    window.app && window.app.showScreen('gameover');
  }

  _onPlayerJoined(data) {
    this._updateWaitingPlayers(data.players);
    this._updatePlayersIndicator(data.players);
    if (data.username) this._showMsg(`${data.username} ist beigetreten.`);
  }

  _onPlayerLeft(data) {
    this._updateWaitingPlayers(data.players);
    this._updatePlayersIndicator(data.players);
    if (data.username) this._showMsg(`${data.username} hat verlassen.`, 'warn');
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _startRender() {
    const meta = this.state && this.state.levelMeta;
    if (meta) this._renderer.resize(meta.mapWidth, meta.mapHeight);

    const loop = () => {
      if (this.state && this.state.gameState === 'playing') {
        this._renderer.draw(this.state, this.selectedId);
      }
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  _stopRender() {
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
  }

  // ── Canvas interaction ────────────────────────────────────────────────────

  _bindCanvas() {
    // Resize observer
    const ro = new ResizeObserver(() => {
      if (this.state && this.state.levelMeta) {
        this._renderer.resize(this.state.levelMeta.mapWidth, this.state.levelMeta.mapHeight);
      } else {
        this._renderer.resize();
      }
    });
    ro.observe(this._canvas);

    // Touch + mouse click
    const getPos = (e) => {
      const rect = this._canvas.getBoundingClientRect();
      if (e.touches) {
        return [e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top];
      }
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onTap = (e) => {
      if (!this.state || this.state.gameState !== 'playing') return;
      e.preventDefault();
      const [cx, cy] = getPos(e);
      const hit = this._renderer.hitTest(cx, cy, this.state.planes);
      if (hit) {
        this.selectedId = hit;
        const plane = this.state.planes.find(p => p.id === hit);
        this._updateCommandPanel(plane);
        this._updatePlaneInfo(plane);
      } else {
        this.selectedId = null;
        this._updateCommandPanel(null);
        this._updatePlaneInfo(null);
      }
    };

    this._canvas.addEventListener('touchstart', onTap, { passive: false });
    this._canvas.addEventListener('mousedown', onTap);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  _sendCmd(event, planeId) {
    if (!this.socket || !planeId) return;
    this.socket.emit(event, { planeId });
  }

  // ── HUD updates ───────────────────────────────────────────────────────────

  _updateHUD(state) {
    document.getElementById('hud-score').textContent = state.score.toLocaleString();
    document.getElementById('hud-day').textContent   = `Tag ${state.day}/${state.maxDays}`;
    document.getElementById('day-progress').style.width = `${state.dayProgress * 100}%`;

    if (state.levelMeta) {
      document.getElementById('hud-level-name').textContent = state.levelMeta.name || '';
    }

    // Crash indicators
    const dots = document.querySelectorAll('.crash-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('used', i >= (state.maxCrashes - state.crashes));
    });

    this._updatePlayersIndicator(state.players);
  }

  _updatePlaneInfo(plane) {
    const el_call    = document.getElementById('plane-callsign');
    const el_details = document.getElementById('plane-details');
    const el_bonus   = document.getElementById('plane-bonus');

    if (!plane) {
      el_call.textContent    = '–';
      el_details.textContent = 'Flugzeug antippen zum Auswählen';
      el_bonus.textContent   = '';
      return;
    }

    const stateLabel = {
      approaching:       'Anflug',
      holding:           'Warteschleife',
      on_final:          'Endanflug',
      landing_roll:      'Landerollung',
      exiting_runway:    'Runway verlassen',
      taxiing_to_gate:   'Taxi → Gate',
      at_gate:           'Am Gate',
      taxiing_to_runway: 'Taxi → Runway',
      holding_short:     'Hält kurz',
      taking_off:        'Start!',
      departed:          'Abgeflogen',
      crashed:           '💥 CRASH'
    }[plane.state] || plane.state;

    el_call.textContent    = plane.callsign;
    el_details.textContent = `${plane.label || plane.type} · ${stateLabel}`;
    el_bonus.textContent   = plane.bonus > 0 ? `Bonus: $${plane.bonus.toLocaleString()}` : '';
  }

  _updateCommandPanel(plane) {
    this._updatePlaneInfo(plane);
    const container = document.getElementById('cmd-buttons');
    container.innerHTML = '';
    if (!plane || !this.socket) return;

    const addBtn = (label, cls, event) => {
      const btn = document.createElement('button');
      btn.className = `cmd-btn ${cls}`;
      btn.textContent = label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._sendCmd(event, plane.id);
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._sendCmd(event, plane.id);
      }, { passive: false });
      container.appendChild(btn);
    };

    switch (plane.state) {
      case 'approaching':
        addBtn('▼  Landen freigeben', 'land', 'cmd_land');
        addBtn('◎  Warteschleife',    'hold', 'cmd_hold');
        break;
      case 'holding':
        addBtn('▼  Landen freigeben', 'land', 'cmd_land');
        break;
      case 'on_final':
        addBtn('↑  Durchstarten',     'goaround', 'cmd_go_around');
        break;
      case 'at_gate':
        if (plane.requestingDeparture) {
          addBtn('▲  Abflug freigeben', 'depart', 'cmd_depart');
        }
        break;
      case 'holding_short':
        addBtn('▲  Start freigeben', 'takeoff', 'cmd_takeoff');
        break;
    }
  }

  _updateWaitingPlayers(players) {
    const el = document.getElementById('waiting-players');
    if (!el || !players) return;
    el.innerHTML = players
      .map(p => `<div class="player-chip">✈ ${p.username}</div>`)
      .join('');
  }

  _updatePlayersIndicator(players) {
    const el = document.getElementById('players-indicator');
    if (!el || !players) return;
    el.innerHTML = players
      .map(p => `<div class="player-badge">✈ ${p.username}</div>`)
      .join('');
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  _processMessages(messages) {
    if (!messages || messages.length === 0) return;
    for (const m of messages) {
      const isCrash   = m.text && m.text.includes('CRASH');
      const isWarning = m.text && (m.text.includes('hold') || m.text.includes('holding'));
      this._showMsg(m.text, isCrash ? 'danger' : isWarning ? 'warn' : '');
    }
  }

  _showMsg(text, cls = '') {
    const log = document.getElementById('msg-log');
    if (!log) return;
    const el = document.createElement('div');
    el.className = `msg-item ${cls}`;
    el.textContent = text;
    log.prepend(el);
    // Keep max 5 messages
    while (log.children.length > 5) log.removeChild(log.lastChild);
    // Auto-remove after 6 s
    setTimeout(() => el.remove(), 6000);
  }
}

// Expose globally
window.GameClient = GameClient;
