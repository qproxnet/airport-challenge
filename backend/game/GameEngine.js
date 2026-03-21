'use strict';

const STATES = {
  APPROACHING:        'approaching',
  HOLDING:            'holding',
  ON_FINAL:           'on_final',
  LANDING_ROLL:       'landing_roll',
  EXITING_RUNWAY:     'exiting_runway',
  TAXIING_TO_GATE:    'taxiing_to_gate',
  AT_GATE:            'at_gate',
  TAXIING_TO_RUNWAY:  'taxiing_to_runway',
  HOLDING_SHORT:      'holding_short',
  TAKING_OFF:         'taking_off',
  DEPARTED:           'departed',
  CRASHED:            'crashed'
};

const AIRLINE_PREFIXES = ['UAL','DAL','AAL','SWA','SKY','JBU','ASA','VRD','FEX','UPS'];

class GameEngine {
  constructor(levelData, roomId, io) {
    this.level    = levelData;
    this.roomId   = roomId;
    this.io       = io;
    this.state    = 'lobby';

    this.tick     = 0;
    this.interval = null;

    this.planes         = new Map();
    this.planeCounter   = 1;
    this.callsignPool   = this._buildCallsignPool();
    this.callsignIdx    = 0;

    this.score    = 0;
    this.crashes  = 0;
    this.maxCrashes = 3;
    this.day      = 1;
    this.dayTick  = 0;
    this.dayDurationTicks = Math.ceil(levelData.dayDurationMs / 100);

    this.players  = new Map(); // userId -> { username }

    this.gates    = levelData.gates.map(g => ({ ...g, occupiedBy: null }));
    this.runways  = levelData.runways.map(r => ({ ...r, occupiedBy: null }));

    this.nextSpawnTick      = 25; // first spawn 2.5 s after start
    this.spawnIntervalTicks = Math.ceil(levelData.spawnIntervalMs / 100);

    this.messages = []; // queued log messages for clients
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  addPlayer(userId, username) { this.players.set(userId, { username }); }
  removePlayer(userId)        { this.players.delete(userId); }
  getPlayers()                { return [...this.players.values()]; }

  start() {
    if (this.state !== 'lobby') return;
    this.state    = 'playing';
    this.interval = setInterval(() => this.update(), 100);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }

  // ─── Commands (called by server on socket events) ─────────────────────────

  commandLand(planeId) {
    const p = this.planes.get(planeId);
    if (!p || ![STATES.APPROACHING, STATES.HOLDING].includes(p.state))
      return { success: false, message: 'Cannot land this aircraft now.' };

    const rw = this.runways[0];
    p.fromEast = p.x > this.level.mapWidth / 2;
    p.state    = STATES.ON_FINAL;
    p.speed    = 2.8;

    if (p.fromEast) {
      p.waypoints = [{ x: rw.x2 + 20, y: rw.y1 }, { x: rw.x2, y: rw.y1 }];
    } else {
      p.waypoints = [{ x: rw.x1 - 20, y: rw.y1 }, { x: rw.x1, y: rw.y1 }];
    }
    return { success: true };
  }

  commandHold(planeId) {
    const p = this.planes.get(planeId);
    if (!p || ![STATES.APPROACHING, STATES.HOLDING].includes(p.state))
      return { success: false, message: 'Cannot hold this aircraft.' };

    this._sendToHold(p);
    return { success: true };
  }

  commandTakeoff(planeId) {
    const p = this.planes.get(planeId);
    if (!p || p.state !== STATES.HOLDING_SHORT)
      return { success: false, message: 'Aircraft is not holding short.' };

    const rw = this.runways[0];
    if (rw.occupiedBy && rw.occupiedBy !== planeId)
      return { success: false, message: 'Runway occupied — hold position!' };

    p.state = STATES.TAKING_OFF;
    p.speed = 0.5;
    this._occupyRunway(p);

    // Depart in the direction they taxied from (opposite of fromEast flag set during taxi)
    if (p.departEast) {
      p.waypoints = [{ x: rw.x2, y: rw.y1 }, { x: rw.x2 + 300, y: rw.y1 }];
    } else {
      p.waypoints = [{ x: rw.x1, y: rw.y1 }, { x: rw.x1 - 300, y: rw.y1 }];
    }
    return { success: true };
  }

  commandDepart(planeId) {
    const p = this.planes.get(planeId);
    if (!p || p.state !== STATES.AT_GATE)
      return { success: false, message: 'Aircraft is not at gate.' };

    p.state = STATES.TAXIING_TO_RUNWAY;
    p.speed = 2.5;
    p.requestingDeparture = false;
    this._freeGate(p);
    this._setTaxiToRunwayWaypoints(p);
    return { success: true };
  }

  commandGoAround(planeId) {
    const p = this.planes.get(planeId);
    if (!p || p.state !== STATES.ON_FINAL)
      return { success: false, message: 'Aircraft is not on final.' };

    this._sendToHold(p);
    this._freeRunway(p);
    this._msg(`${p.callsign} going around.`);
    return { success: true };
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  update() {
    if (this.state !== 'playing') return;
    this.tick++;
    this.dayTick++;

    // Day progression
    if (this.dayTick >= this.dayDurationTicks) {
      this.dayTick = 0;
      this.day++;
      if (this.day > this.level.maxDays) {
        this._endGame('completed');
        return;
      }
      // Each new day: tighten spawn interval (min 40 ticks = 4 s)
      this.spawnIntervalTicks = Math.max(40, this.spawnIntervalTicks - 15);
      this._msg(`Day ${this.day} — traffic increasing!`);
    }

    // Move planes
    for (const p of this.planes.values()) this._movePlane(p);

    // Collision check
    this._checkCollisions();

    // Transitions
    for (const p of this.planes.values()) this._checkTransitions(p);

    // Remove clean departures
    for (const [id, p] of this.planes) {
      if (p.state === STATES.DEPARTED) {
        this.score += 1500 + Math.round(p.bonus);
        this._msg(`${p.callsign} departed. +${1500 + Math.round(p.bonus)} pts`);
        this.planes.delete(id);
      }
    }

    // Spawn
    const active = [...this.planes.values()].filter(p => p.state !== STATES.CRASHED).length;
    if (this.tick >= this.nextSpawnTick && active < this.level.maxConcurrentPlanes) {
      this._spawnPlane();
      this.nextSpawnTick = this.tick + this.spawnIntervalTicks;
    }

    this._broadcast();
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

  _movePlane(p) {
    if ([STATES.AT_GATE, STATES.HOLDING_SHORT, STATES.CRASHED, STATES.DEPARTED].includes(p.state)) return;
    if (!p.waypoints.length) return;

    const wp  = p.waypoints[0];
    const dx  = wp.x - p.x;
    const dy  = wp.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < p.speed + 0.5) {
      p.x = wp.x;
      p.y = wp.y;
      p.waypoints.shift();
      if (p.waypoints.length > 0) {
        const n = p.waypoints[0];
        p.heading = Math.atan2(n.y - p.y, n.x - p.x) * 180 / Math.PI;
      }
    } else {
      p.heading = Math.atan2(dy, dx) * 180 / Math.PI;
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
    }

    // Speed changes on runway
    if (p.state === STATES.LANDING_ROLL)
      p.speed = Math.max(1.6, p.speed - 0.06);
    if (p.state === STATES.TAKING_OFF)
      p.speed = Math.min(5.5, p.speed + 0.09);

    // Bonus erosion while waiting
    if ([STATES.APPROACHING, STATES.HOLDING, STATES.HOLDING_SHORT].includes(p.state))
      p.bonus = Math.max(0, p.bonus - 1.5);
  }

  // ─── State transitions ────────────────────────────────────────────────────

  _checkTransitions(p) {
    if (p.state === STATES.CRASHED) return;

    // Aircraft left the map while taking off → departed
    if (p.state === STATES.TAKING_OFF) {
      const { mapWidth, mapHeight } = this.level;
      if (p.x < -60 || p.x > mapWidth + 60 || p.y < -60 || p.y > mapHeight + 60) {
        p.state = STATES.DEPARTED;
        this._freeRunway(p);
        return;
      }
    }

    // Approaching plane with warning flag when close to runway
    if (p.state === STATES.APPROACHING) {
      const rw = this.runways[0];
      const dist = Math.min(
        Math.hypot(p.x - rw.x1, p.y - rw.y1),
        Math.hypot(p.x - rw.x2, p.y - rw.y2)
      );
      p.warning = dist < 80;
    }

    // Waypoints exhausted → state machine transitions
    if (p.waypoints.length > 0) return;

    switch (p.state) {
      case STATES.APPROACHING:
        // No clearance given → auto-hold
        this._sendToHold(p);
        this._msg(`${p.callsign} entering hold — assign a runway!`);
        break;

      case STATES.HOLDING:
        this._setHoldingWaypoints(p); // loop
        break;

      case STATES.ON_FINAL: {
        // Touched down
        p.state = STATES.LANDING_ROLL;
        p.speed = 2.5;
        this._occupyRunway(p);
        const rw = this.runways[0];
        // Roll to nearest exit: plane from east lands at x2 → exits at x2-100 (east exit)
        // plane from west lands at x1 → exits at x1+100 (west exit)
        const exitX = p.fromEast ? rw.x2 - 100 : rw.x1 + 100;
        p.waypoints = [{ x: exitX, y: rw.y1 }];
        break;
      }

      case STATES.LANDING_ROLL:
        p.state = STATES.EXITING_RUNWAY;
        p.speed = 2.5;
        this._setExitWaypoints(p);
        break;

      case STATES.EXITING_RUNWAY:
        p.state = STATES.TAXIING_TO_GATE;
        p.speed = 2.5;
        this._setGateWaypoints(p);
        break;

      case STATES.TAXIING_TO_GATE:
        p.state = STATES.AT_GATE;
        p.gateTimer = 60; // 6 s at gate before requesting departure
        p.bonus = 600;
        this.score += 1000;
        this._freeRunway(p);
        this._msg(`${p.callsign} at gate. +1000 pts`);
        break;

      case STATES.TAXIING_TO_RUNWAY:
        p.state = STATES.HOLDING_SHORT;
        this._msg(`${p.callsign} holding short — cleared for takeoff?`);
        break;

      case STATES.TAKING_OFF:
        p.state = STATES.DEPARTED;
        this._freeRunway(p);
        break;
    }

    // Gate departure timer
    if (p.state === STATES.AT_GATE) {
      p.gateTimer--;
      if (p.gateTimer <= 0) p.requestingDeparture = true;
    }
  }

  // ─── Collision detection ──────────────────────────────────────────────────

  _checkCollisions() {
    const onActiveRunway = s => [
      STATES.ON_FINAL, STATES.LANDING_ROLL,
      STATES.TAKING_OFF, STATES.EXITING_RUNWAY
    ].includes(s);

    const active = [...this.planes.values()].filter(p => p.state !== STATES.CRASHED);

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        if (!onActiveRunway(a.state) && !onActiveRunway(b.state)) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) < 24) this._crash(a, b);
      }
    }
  }

  _crash(a, b) {
    if (a.state === STATES.CRASHED || b.state === STATES.CRASHED) return;
    a.state = STATES.CRASHED;
    b.state = STATES.CRASHED;
    this.crashes++;
    this.score = Math.max(0, this.score - 3000);
    this._freeRunway(a);
    this._freeRunway(b);
    this._msg(`CRASH! ${a.callsign} × ${b.callsign} — -3000 pts`);

    // Remove wreckage after 3 s
    setTimeout(() => {
      this.planes.delete(a.id);
      this.planes.delete(b.id);
    }, 3000);

    if (this.crashes >= this.maxCrashes) {
      setTimeout(() => this._endGame('crashed'), 2500);
    }
  }

  // ─── Waypoint helpers ─────────────────────────────────────────────────────

  _sendToHold(p) {
    p.state      = STATES.HOLDING;
    p.holdingFix = this._nearestFix(p);
    p.speed      = 3.0;
    this._setHoldingWaypoints(p);
  }

  _setHoldingWaypoints(p) {
    const f = p.holdingFix;
    const r = f.radius || 65;
    p.waypoints = [
      { x: f.x + r, y: f.y },
      { x: f.x,     y: f.y - r },
      { x: f.x - r, y: f.y },
      { x: f.x,     y: f.y + r }
    ];
  }

  _setExitWaypoints(p) {
    const rw    = this.runways[0];
    const taxiY = 240;
    // fromEast=true: landed at x2(700), rolled to ~600, exits at east exit (x=600)
    // fromEast=false: landed at x1(100), rolled to ~200, exits at west exit (x=200)
    const exitX = p.fromEast ? 600 : 200;
    p.waypoints = [
      { x: exitX, y: rw.y1  },   // make sure plane is at exit point on runway
      { x: exitX, y: taxiY  }    // turn north onto taxiway
    ];
  }

  _setGateWaypoints(p) {
    const gate = this.gates.find(g => !g.occupiedBy);
    if (!gate) {
      // All gates full — wait mid-taxiway
      p.waypoints = [{ x: 400, y: 240 }];
      return;
    }
    gate.occupiedBy = p.id;
    p.assignedGate  = gate.id;
    const taxiY     = gate.taxiY || 240;
    p.waypoints = [
      { x: gate.x, y: taxiY },  // taxi to gate column
      { x: gate.x, y: gate.y }  // pull into gate
    ];
  }

  _setTaxiToRunwayWaypoints(p) {
    const rw      = this.runways[0];
    const taxiY   = 240;
    const gate    = this.gates.find(g => g.id === p.assignedGate) || { x: 400, y: 155 };

    // Randomly choose departure direction
    const departEast = Math.random() > 0.5;
    p.departEast     = departEast;

    const holdX = departEast ? rw.x1 + 10 : rw.x2 - 10;

    p.waypoints = [
      { x: gate.x, y: taxiY },      // from gate to taxiway
      { x: holdX,  y: taxiY },      // along taxiway toward runway end
      { x: holdX,  y: rw.y1 }       // turn south to hold short
    ];
  }

  // ─── Spawning ─────────────────────────────────────────────────────────────

  _spawnPlane() {
    const entries = this.level.entryPoints;
    const entry   = entries[Math.floor(Math.random() * entries.length)];
    const typeDef = this._pickType();
    const callsign = this.callsignPool[this.callsignIdx++ % this.callsignPool.length];

    const fromEast = entry.x > this.level.mapWidth / 2;
    const rw       = this.runways[0];

    // Approach waypoints: fly plane into the airspace toward runway approach area
    let waypoints;
    if (entry.id === 'EP_EAST') {
      waypoints = [{ x: 760, y: rw.y1 }, { x: 720, y: rw.y1 }];
    } else if (entry.id === 'EP_WEST') {
      waypoints = [{ x: 40, y: rw.y1 }, { x: 80, y: rw.y1 }];
    } else if (entry.id === 'EP_NE') {
      waypoints = [{ x: 680, y: 180 }, { x: 720, y: rw.y1 }];
    } else {
      waypoints = [{ x: 120, y: 180 }, { x: 80, y: rw.y1 }];
    }

    const initDx = waypoints[0].x - entry.x;
    const initDy = waypoints[0].y - entry.y;
    const initHeading = Math.atan2(initDy, initDx) * 180 / Math.PI;

    const plane = {
      id:                   `p${this.planeCounter++}`,
      callsign,
      type:                 typeDef.type,
      label:                typeDef.label,
      color:                typeDef.color,
      size:                 typeDef.size,
      state:                STATES.APPROACHING,
      x:                    entry.x,
      y:                    entry.y,
      heading:              initHeading,
      speed:                typeDef.speed,
      fromEast,
      departEast:           false,
      waypoints,
      bonus:                2000,
      warning:              false,
      requestingDeparture:  false,
      assignedGate:         null,
      holdingFix:           null,
      gateTimer:            0
    };

    this.planes.set(plane.id, plane);
    this._msg(`${plane.callsign} (${plane.label}) inbound — assign a runway.`);
  }

  _pickType() {
    const types = this.level.planeTypes;
    const total  = types.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of types) { r -= t.weight; if (r <= 0) return t; }
    return types[0];
  }

  // ─── Runway / Gate helpers ────────────────────────────────────────────────

  _occupyRunway(p) { this.runways[0].occupiedBy = p.id; }
  _freeRunway(p)   { if (this.runways[0].occupiedBy === p.id) this.runways[0].occupiedBy = null; }

  _freeGate(p) {
    if (p.assignedGate) {
      const g = this.gates.find(g => g.id === p.assignedGate);
      if (g) g.occupiedBy = null;
      p.assignedGate = null;
    }
  }

  _nearestFix(p) {
    return this.level.holdingFixes.reduce((best, f) => {
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      return d < Math.hypot(p.x - best.x, p.y - best.y) ? f : best;
    });
  }

  // ─── Messaging & state ────────────────────────────────────────────────────

  _msg(text) { this.messages.push({ text, ts: Date.now() }); }

  getState() {
    const msgs = this.messages.splice(0);
    return {
      gameState:    this.state,
      score:        this.score,
      crashes:      this.crashes,
      maxCrashes:   this.maxCrashes,
      day:          this.day,
      maxDays:      this.level.maxDays,
      dayProgress:  this.dayTick / this.dayDurationTicks,
      players:      this.getPlayers(),
      planes: [...this.planes.values()].map(p => ({
        id:                   p.id,
        callsign:             p.callsign,
        type:                 p.type,
        label:                p.label,
        color:                p.color,
        size:                 p.size,
        state:                p.state,
        x:                    +p.x.toFixed(1),
        y:                    +p.y.toFixed(1),
        heading:              +p.heading.toFixed(1),
        bonus:                Math.round(p.bonus),
        warning:              p.warning,
        requestingDeparture:  p.requestingDeparture
      })),
      gates:   this.gates.map(g => ({ id: g.id, x: g.x, y: g.y, occupied: !!g.occupiedBy })),
      runway:  { occupied: !!this.runways[0].occupiedBy, by: this.runways[0].occupiedBy },
      messages: msgs,
      levelMeta: {
        id:           this.level.id,
        name:         this.level.name,
        mapWidth:     this.level.mapWidth,
        mapHeight:    this.level.mapHeight,
        runways:      this.level.runways,
        taxiways:     this.level.taxiways,
        terminal:     this.level.terminal,
        gates:        this.level.gates,
        holdingFixes: this.level.holdingFixes
      }
    };
  }

  _broadcast() {
    this.io.to(this.roomId).emit('game_state', this.getState());
  }

  _endGame(reason) {
    this.state = 'gameover';
    this.stop();
    this.io.to(this.roomId).emit('game_over', {
      reason,
      score:   this.score,
      crashes: this.crashes,
      day:     this.day
    });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  _buildCallsignPool() {
    const pool = [];
    for (const prefix of AIRLINE_PREFIXES)
      for (let n = 101; n <= 999; n += 17)
        pool.push(`${prefix}${n}`);
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }
}

module.exports = GameEngine;
