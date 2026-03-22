'use strict';

/**
 * AirportRenderer — draws a realistic top-down airport view on HTML5 Canvas.
 */
class AirportRenderer {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.scale   = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.mapW    = 800;
    this.mapH    = 560;
    this.frame   = 0;
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  resize(mapW, mapH) {
    this.mapW = mapW || this.mapW;
    this.mapH = mapH || this.mapH;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    this.canvas.width  = cw;
    this.canvas.height = ch;
    const scaleX = cw / this.mapW;
    const scaleY = ch / this.mapH;
    this.scale   = Math.min(scaleX, scaleY);
    this.offsetX = (cw - this.mapW * this.scale) / 2;
    this.offsetY = (ch - this.mapH * this.scale) / 2;
  }

  toCanvas(x, y) { return [x * this.scale + this.offsetX, y * this.scale + this.offsetY]; }
  toGame(cx, cy)  { return [(cx - this.offsetX) / this.scale, (cy - this.offsetY) / this.scale]; }
  s(v)            { return v * this.scale; }

  // ── Main draw ───────────────────────────────────────────────────────────────

  draw(state, selectedId) {
    if (!state) return;
    this.frame++;
    const ctx = this.ctx;
    const { levelMeta, planes, gates } = state;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawTerrain(levelMeta);
    this._drawApronAreas(levelMeta);
    this._drawTaxiways(levelMeta);
    this._drawRunways(levelMeta, state.runways);
    this._drawRunwayLighting(levelMeta);
    this._drawTerminal(levelMeta);
    this._drawGates(levelMeta, gates);
    this._drawHoldingFixes(levelMeta);
    this._drawILSFunnels(levelMeta);
    this._drawApproachPaths(planes);
    this._drawVelocityVectors(planes);
    this._drawPlanes(planes, selectedId);
  }

  // ── Terrain ─────────────────────────────────────────────────────────────────

  _drawTerrain(meta) {
    const ctx = this.ctx;
    const [x0, y0] = this.toCanvas(0, 0);
    const [x1, y1] = this.toCanvas(meta.mapWidth, meta.mapHeight);
    const w = x1 - x0, h = y1 - y0;

    // Outer void
    ctx.fillStyle = '#010609';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Airspace boundary glow
    ctx.strokeStyle = 'rgba(0,180,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([this.s(8), this.s(12)]);
    ctx.strokeRect(x0, y0, w, h);
    ctx.setLineDash([]);

    // Grass / terrain fill
    ctx.fillStyle = '#071510';
    ctx.fillRect(x0, y0, w, h);

    // Subtle terrain texture (random dots)
    ctx.fillStyle = 'rgba(0,40,20,0.5)';
    const seed = 42;
    for (let i = 0; i < 200; i++) {
      const tx = x0 + ((i * 137 + seed) % w);
      const ty = y0 + ((i * 211 + seed) % h);
      ctx.beginPath();
      ctx.arc(tx, ty, this.s(0.8), 0, Math.PI * 2);
      ctx.fill();
    }

    // Radar grid
    ctx.strokeStyle = 'rgba(0,120,60,0.06)';
    ctx.lineWidth = 0.5;
    const step = this.s(50);
    for (let gx = x0 % step; gx < this.canvas.width; gx += step) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, this.canvas.height); ctx.stroke();
    }
    for (let gy = y0 % step; gy < this.canvas.height; gy += step) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(this.canvas.width, gy); ctx.stroke();
    }

    // Vignette
    const vig = ctx.createRadialGradient(x0+w/2, y0+h/2, this.s(40), x0+w/2, y0+h/2, this.s(600));
    vig.addColorStop(0, 'rgba(0,229,255,0.025)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(x0, y0, w, h);
  }

  // ── Apron (tarmac areas) ────────────────────────────────────────────────────

  _drawApronAreas(meta) {
    const ctx = this.ctx;
    if (!meta.terminal) return;
    const t = meta.terminal;
    // Large apron in front of terminal
    const [ax, ay] = this.toCanvas(t.x - 30, t.y + t.height);
    const aw = this.s(t.width + 60);
    const ah = this.s(90);
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(ax, ay, aw, ah);
    // Apron edge line
    ctx.strokeStyle = 'rgba(0,180,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay, aw, ah);
  }

  // ── Taxiways ────────────────────────────────────────────────────────────────

  _drawTaxiways(meta) {
    const ctx = this.ctx;
    if (!meta.taxiways) return;
    for (const tw of meta.taxiways) {
      const [ax, ay] = this.toCanvas(tw.x1, tw.y1);
      const [bx, by] = this.toCanvas(tw.x2, tw.y2);

      // Taxiway surface
      ctx.strokeStyle = '#111d2a';
      ctx.lineWidth   = this.s(tw.width || 14);
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      // Edge markings (white borders)
      ctx.strokeStyle = 'rgba(200,180,80,0.12)';
      ctx.lineWidth   = this.s((tw.width || 14) + 2);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      // Yellow centreline
      ctx.strokeStyle = 'rgba(255,200,0,0.35)';
      ctx.lineWidth   = this.s(1.2);
      ctx.setLineDash([this.s(8), this.s(6)]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Runways ─────────────────────────────────────────────────────────────────

  _drawRunways(meta, runwayStates) {
    const ctx = this.ctx;
    if (!meta.runways) return;

    for (const rw of meta.runways) {
      const [ax, ay] = this.toCanvas(rw.x1, rw.y1);
      const [bx, by] = this.toCanvas(rw.x2, rw.y2);
      const rwState   = (runwayStates || []).find(r => r.id === rw.id);
      const occupied  = rwState && rwState.occupied;

      // Runway surface
      ctx.strokeStyle = occupied ? '#1a1000' : '#16202e';
      ctx.lineWidth   = this.s(rw.width || 30);
      ctx.lineCap     = 'butt';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      // Runway edge lines (white)
      const hw = this.s((rw.width || 30) / 2);
      const angle = Math.atan2(by - ay, bx - ax);
      const px = Math.sin(angle), py = -Math.cos(angle);

      for (const side of [-1, 1]) {
        ctx.strokeStyle = occupied ? 'rgba(255,80,0,0.2)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ax + side * px * hw, ay + side * py * hw);
        ctx.lineTo(bx + side * px * hw, by + side * py * hw);
        ctx.stroke();
      }

      // Centreline dashes
      ctx.strokeStyle = occupied ? 'rgba(255,120,0,0.3)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([this.s(20), this.s(12)]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);

      // Threshold markings
      this._drawThreshold(rw, false);
      this._drawThreshold(rw, true);

      // Runway designation label
      const midX = (rw.x1 + rw.x2) / 2;
      const midY = (rw.y1 + rw.y2) / 2 - 25;
      const [lx, ly] = this.toCanvas(midX, midY);
      ctx.fillStyle = 'rgba(150,180,200,0.35)';
      ctx.font = `${this.s(10)}px 'Orbitron', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(rw.id || 'RW', lx, ly);

      // Occupied indicator
      if (occupied) {
        const [mx, my] = this.toCanvas((rw.x1+rw.x2)/2, (rw.y1+rw.y2)/2);
        const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.3);
        ctx.fillStyle = `rgba(255,80,0,${0.1 * pulse})`;
        ctx.beginPath();
        ctx.arc(mx, my, this.s(18), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawThreshold(rw, flip) {
    const ctx  = this.ctx;
    const x    = flip ? rw.x2 : rw.x1;
    const y    = flip ? rw.y2 : rw.y1;
    const angle = Math.atan2(rw.y2 - rw.y1, rw.x2 - rw.x1) + (flip ? Math.PI : 0);
    const perp  = angle + Math.PI / 2;
    const hw    = (rw.width || 30) / 2 - 3;
    const bars  = 5;

    ctx.save();
    const [cx, cy] = this.toCanvas(x, y);
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = -bars; i <= bars; i++) {
      const ox = Math.sin(perp) * i * this.s(hw / bars);
      const oy = -Math.cos(perp) * i * this.s(hw / bars);
      const bw = this.s(hw / bars * 0.55);
      ctx.fillRect(ox - bw / 2, oy - this.s(3.5), bw, this.s(7));
    }
    ctx.restore();
  }

  // ── Runway lighting ─────────────────────────────────────────────────────────

  _drawRunwayLighting(meta) {
    const ctx = this.ctx;
    if (!meta.runways) return;
    const pulse = 0.7 + 0.3 * Math.sin(this.frame * 0.05);

    for (const rw of meta.runways) {
      const hw = (rw.width || 30) / 2 + 3;
      const angle = Math.atan2(rw.y2 - rw.y1, rw.x2 - rw.x1);
      const perp  = angle + Math.PI / 2;
      const len   = Math.hypot(rw.x2 - rw.x1, rw.y2 - rw.y1);
      const steps = Math.floor(len / 35);

      for (let i = 0; i <= steps; i++) {
        const t  = i / steps;
        const wx = rw.x1 + (rw.x2 - rw.x1) * t;
        const wy = rw.y1 + (rw.y2 - rw.y1) * t;

        for (const side of [-1, 1]) {
          const lx = wx + Math.sin(perp) * hw * side;
          const ly = wy - Math.cos(perp) * hw * side;
          const [cx, cy] = this.toCanvas(lx, ly);

          ctx.fillStyle = `rgba(255,255,200,${0.35 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, this.s(1.2), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Threshold red lights
      for (const [tx, ty] of [[rw.x1, rw.y1], [rw.x2, rw.y2]]) {
        for (let i = -2; i <= 2; i++) {
          const lx = tx + Math.sin(perp) * i * hw / 2;
          const ly = ty - Math.cos(perp) * i * hw / 2;
          const [cx, cy] = this.toCanvas(lx, ly);
          ctx.fillStyle = `rgba(255,50,50,${0.6 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, this.s(1.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ── Terminal ─────────────────────────────────────────────────────────────────

  _drawTerminal(meta) {
    if (!meta.terminal) return;
    const ctx = this.ctx;
    const t   = meta.terminal;
    const [tx, ty] = this.toCanvas(t.x, t.y);
    const tw = this.s(t.width), th = this.s(t.height);

    // Terminal shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(tx + this.s(3), ty + this.s(3), tw, th, this.s(6));
    ctx.fill();

    // Terminal body
    const termGrad = ctx.createLinearGradient(tx, ty, tx, ty + th);
    termGrad.addColorStop(0, '#0f2d50');
    termGrad.addColorStop(1, '#081e38');
    ctx.fillStyle = termGrad;
    ctx.strokeStyle = 'rgba(0,180,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, this.s(6));
    ctx.fill();
    ctx.stroke();

    // Windows
    const winCount = Math.floor(t.width / 20);
    for (let i = 0; i < winCount; i++) {
      const wx = tx + this.s(10 + i * 20);
      const wy = ty + this.s(8);
      ctx.fillStyle = 'rgba(0,200,255,0.15)';
      ctx.fillRect(wx, wy, this.s(10), this.s(th / this.scale - 16));
    }

    // TERMINAL label
    ctx.fillStyle = 'rgba(100,180,255,0.7)';
    ctx.font = `bold ${this.s(11)}px 'Orbitron', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TERMINAL', tx + tw / 2, ty + th / 2);

    // Jetway indicators
    if (meta.gates) {
      for (const g of meta.gates) {
        const [gx, gy] = this.toCanvas(g.x, g.y + 4);
        const [tx2, ty2] = this.toCanvas(g.x, t.y + t.height);
        ctx.strokeStyle = 'rgba(0,150,255,0.25)';
        ctx.lineWidth = this.s(4);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx2, ty2);
        ctx.lineTo(gx, gy);
        ctx.stroke();
      }
    }
  }

  // ── Gates ────────────────────────────────────────────────────────────────────

  _drawGates(meta, gateStates) {
    const ctx      = this.ctx;
    const occupied = new Set((gateStates || []).filter(g => g.occupied).map(g => g.id));

    for (const g of (meta.gates || [])) {
      const [gx, gy] = this.toCanvas(g.x, g.y);
      const isOcc    = occupied.has(g.id);
      const sz       = this.s(11);

      // Gate box
      const gateGrad = ctx.createLinearGradient(gx - sz/2, gy - sz/2, gx + sz/2, gy + sz/2);
      if (isOcc) {
        gateGrad.addColorStop(0, '#004488');
        gateGrad.addColorStop(1, '#002255');
      } else {
        gateGrad.addColorStop(0, '#1a2a3a');
        gateGrad.addColorStop(1, '#0e1820');
      }
      ctx.fillStyle   = gateGrad;
      ctx.strokeStyle = isOcc ? 'rgba(0,150,255,0.7)' : 'rgba(0,80,150,0.3)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(gx - sz/2, gy - sz/2, sz, sz, this.s(2));
      ctx.fill();
      ctx.stroke();

      if (isOcc) {
        ctx.shadowColor = '#0088ff';
        ctx.shadowBlur  = this.s(6);
        ctx.strokeStyle = 'rgba(0,150,255,0.5)';
        ctx.beginPath();
        ctx.roundRect(gx - sz/2, gy - sz/2, sz, sz, this.s(2));
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Gate label
      ctx.fillStyle    = isOcc ? 'rgba(100,180,255,0.9)' : 'rgba(60,100,140,0.7)';
      ctx.font         = `bold ${this.s(7)}px 'Orbitron', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.id, gx, gy);
    }
  }

  // ── Holding fixes ────────────────────────────────────────────────────────────

  _drawHoldingFixes(meta) {
    const ctx = this.ctx;
    for (const f of (meta.holdingFixes || [])) {
      const [fx, fy] = this.toCanvas(f.x, f.y);
      const r        = this.s(f.radius || 65);

      // Holding ellipse
      ctx.strokeStyle = 'rgba(0,150,200,0.18)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([this.s(5), this.s(7)]);
      ctx.beginPath();
      ctx.ellipse(fx, fy, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fix point
      ctx.fillStyle = 'rgba(0,180,220,0.4)';
      ctx.beginPath();
      ctx.arc(fx, fy, this.s(3), 0, Math.PI * 2);
      ctx.fill();

      // Fix label
      ctx.fillStyle    = 'rgba(0,160,200,0.6)';
      ctx.font         = `${this.s(8)}px 'Orbitron', monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(f.id, fx, fy - this.s(6));
    }
  }

  // ── ILS approach funnels ─────────────────────────────────────────────────────

  _drawILSFunnels(meta) {
    const ctx = this.ctx;
    if (!meta.runways) return;

    for (const rw of meta.runways) {
      const len   = Math.hypot(rw.x2 - rw.x1, rw.y2 - rw.y1);
      const angle = Math.atan2(rw.y2 - rw.y1, rw.x2 - rw.x1);
      const spread = 0.22; // funnel half-angle in radians

      // Funnel from east threshold (landing west)
      this._drawFunnel(rw.x2, rw.y2, angle + Math.PI, spread, 160);
      // Funnel from west threshold (landing east)
      this._drawFunnel(rw.x1, rw.y1, angle, spread, 160);
    }
  }

  _drawFunnel(tx, ty, angle, spread, length) {
    const ctx = this.ctx;
    const [cx, cy] = this.toCanvas(tx, ty);
    const rl = this.s(length);

    const leftAngle  = angle - spread;
    const rightAngle = angle + spread;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rl);
    grad.addColorStop(0, 'rgba(0,220,120,0.12)');
    grad.addColorStop(1, 'rgba(0,220,120,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(leftAngle)  * rl, cy + Math.sin(leftAngle)  * rl);
    ctx.lineTo(cx + Math.cos(rightAngle) * rl, cy + Math.sin(rightAngle) * rl);
    ctx.closePath();
    ctx.fill();

    // Centreline
    ctx.strokeStyle = 'rgba(0,220,120,0.12)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([this.s(10), this.s(8)]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * rl, cy + Math.sin(angle) * rl);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Approach paths ───────────────────────────────────────────────────────────

  _drawApproachPaths(planes) {
    if (!planes) return;
    const ctx = this.ctx;
    for (const p of planes) {
      if (!['approaching', 'on_final', 'holding'].includes(p.state)) continue;
      if (!p.waypoints || p.waypoints.length === 0) continue;

      ctx.strokeStyle = p.warning
        ? 'rgba(255,120,0,0.45)'
        : p.state === 'on_final'
          ? 'rgba(0,255,136,0.55)'
          : 'rgba(0,180,255,0.25)';
      ctx.lineWidth   = p.state === 'on_final' ? 2 : 1;
      ctx.setLineDash([this.s(6), this.s(5)]);
      ctx.beginPath();
      const [sx, sy] = this.toCanvas(p.x, p.y);
      ctx.moveTo(sx, sy);
      for (const wp of p.waypoints) {
        const [wx, wy] = this.toCanvas(wp.x, wp.y);
        ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint dots
      for (const wp of p.waypoints) {
        const [wx, wy] = this.toCanvas(wp.x, wp.y);
        ctx.fillStyle = p.state === 'on_final' ? 'rgba(0,255,136,0.5)' : 'rgba(0,180,255,0.35)';
        ctx.beginPath();
        ctx.arc(wx, wy, this.s(2.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Velocity vectors ─────────────────────────────────────────────────────────

  _drawVelocityVectors(planes) {
    if (!planes) return;
    const ctx = this.ctx;
    const airborne = ['approaching', 'on_final', 'holding', 'taking_off'];

    for (const p of planes) {
      if (!airborne.includes(p.state)) continue;
      const [px, py] = this.toCanvas(p.x, p.y);
      const rad  = p.heading * Math.PI / 180;
      const vl   = this.s(p.speed * 18);
      const col  = this._planeColor(p);

      ctx.strokeStyle = col + '55';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(rad) * vl, py + Math.sin(rad) * vl);
      ctx.stroke();

      // Tick marks at 1/3 and 2/3
      for (const t of [0.33, 0.66]) {
        const tx = px + Math.cos(rad) * vl * t;
        const ty = py + Math.sin(rad) * vl * t;
        const perp = rad + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(perp) * this.s(3), ty + Math.sin(perp) * this.s(3));
        ctx.lineTo(tx - Math.cos(perp) * this.s(3), ty - Math.sin(perp) * this.s(3));
        ctx.stroke();
      }
    }
  }

  // ── Planes ───────────────────────────────────────────────────────────────────

  _drawPlanes(planes, selectedId) {
    if (!planes) return;
    for (const p of planes) {
      if (p.state === 'departed') continue;
      this._drawPlane(p, p.id === selectedId);
    }
    for (const p of planes) {
      if (p.state === 'departed') continue;
      this._drawPlaneLabel(p, p.id === selectedId);
    }
  }

  _planeColor(p) {
    if (p.state === 'crashed')                                        return '#ff2244';
    if (p.warning)                                                    return '#ff7700';
    if (p.requestingDeparture)                                        return '#cc44ff';
    if (p.state === 'approaching')                                    return '#ffcc00';
    if (p.state === 'holding')                                        return '#6699bb';
    if (['on_final','landing_roll','exiting_runway'].includes(p.state)) return '#00ff88';
    if (p.state === 'taxiing_to_gate')                               return '#00aaff';
    if (p.state === 'at_gate')                                        return '#3366ff';
    if (['taxiing_to_runway','holding_short'].includes(p.state))      return '#aa55ff';
    if (p.state === 'taking_off')                                     return '#00ff88';
    return p.color || '#00ff88';
  }

  _drawPlane(p, selected) {
    const ctx  = this.ctx;
    const [px, py] = this.toCanvas(p.x, p.y);
    const sz   = this.s(p.size || 9);
    const col  = this._planeColor(p);
    const rad  = p.heading * Math.PI / 180;

    // Selection ring
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.18);
      ctx.strokeStyle = `rgba(0,229,255,${0.6 + 0.4 * pulse})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, sz * 2.8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0,229,255,${0.2 * pulse})`;
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.arc(px, py, sz * 2.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Glow
    const glow = ctx.createRadialGradient(px, py, 0, px, py, sz * 3);
    glow.addColorStop(0, col + '55');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(px, py, sz * 3, 0, Math.PI * 2); ctx.fill();

    // Warning flash
    if (p.warning && this.frame % 8 < 4) {
      const wGlow = ctx.createRadialGradient(px, py, 0, px, py, sz * 4);
      wGlow.addColorStop(0, 'rgba(255,100,0,0.5)');
      wGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = wGlow;
      ctx.beginPath(); ctx.arc(px, py, sz * 4, 0, Math.PI * 2); ctx.fill();
    }

    // ── Aircraft sprite (top-down view) ──
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rad);

    ctx.fillStyle   = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 0.7;

    // Fuselage (elongated — nose to tail along +X axis)
    ctx.beginPath();
    ctx.moveTo(sz * 2.2, 0);
    ctx.bezierCurveTo(sz * 2.2, -sz * 0.45, sz * 0.8, -sz * 0.5, -sz * 1.8, -sz * 0.35);
    ctx.lineTo(-sz * 2.0, 0);
    ctx.lineTo(-sz * 1.8, sz * 0.35);
    ctx.bezierCurveTo(sz * 0.8, sz * 0.5, sz * 2.2, sz * 0.45, sz * 2.2, 0);
    ctx.fill();
    ctx.stroke();

    // Main wings (swept back)
    ctx.beginPath();
    ctx.moveTo(sz * 0.5, 0);
    ctx.lineTo(-sz * 0.5, -sz * 2.2);  // left wingtip
    ctx.lineTo(-sz * 0.85, -sz * 2.2);
    ctx.lineTo(-sz * 1.05, -sz * 0.4);
    ctx.lineTo(sz * 0.5, 0);
    ctx.lineTo(-sz * 1.05, sz * 0.4);
    ctx.lineTo(-sz * 0.85, sz * 2.2);
    ctx.lineTo(-sz * 0.5, sz * 2.2);   // right wingtip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Horizontal stabilizer (tail)
    ctx.beginPath();
    ctx.moveTo(-sz * 1.5, 0);
    ctx.lineTo(-sz * 1.8, -sz * 1.05);
    ctx.lineTo(-sz * 2.05, -sz * 1.05);
    ctx.lineTo(-sz * 1.75, 0);
    ctx.lineTo(-sz * 2.05, sz * 1.05);
    ctx.lineTo(-sz * 1.8, sz * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit window highlight
    ctx.fillStyle = 'rgba(150,220,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(sz * 1.6, 0, sz * 0.35, sz * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crash animation
    if (p.state === 'crashed') {
      const r = sz * (2 + (this.frame % 20) * 0.25);
      const alpha = 1 - (this.frame % 20) / 20;
      ctx.strokeStyle = `rgba(255,50,0,${alpha})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Departure request pulse
    if (p.requestingDeparture) {
      const expandR = ((this.frame % 25) / 25) * sz * 4;
      const alpha   = 1 - expandR / (sz * 4);
      ctx.strokeStyle = `rgba(180,60,255,${alpha})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, sz * 1.5 + expandR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawPlaneLabel(p, selected) {
    const ctx  = this.ctx;
    const [px, py] = this.toCanvas(p.x, p.y);
    const sz   = this.s(p.size || 9);
    const col  = this._planeColor(p);

    const lx = px + sz * 3;
    const ly = py - sz * 1.5;

    const stateIcons = {
      approaching: '→',
      holding:     '◎',
      on_final:    '▼',
      landing_roll: '▼',
      exiting_runway: '◄',
      taxiing_to_gate: '►',
      at_gate:     '■',
      taxiing_to_runway: '►',
      holding_short: '▐',
      taking_off:  '▲',
      crashed:     '✕'
    };
    const icon = stateIcons[p.state] || '?';
    const tag  = `${icon} ${p.callsign}`;

    ctx.font = `${selected ? 'bold ' : ''}${this.s(9)}px 'Share Tech Mono', monospace`;
    const tw = ctx.measureText(tag).width + this.s(6);
    const th = this.s(13);

    // Tag background
    ctx.fillStyle = selected ? 'rgba(0,20,40,0.95)' : 'rgba(2,8,16,0.85)';
    ctx.beginPath();
    ctx.roundRect(lx - this.s(3), ly - th + this.s(2), tw, th, this.s(3));
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx - this.s(3), ly - th + this.s(2), tw, th, this.s(3));
      ctx.stroke();
    }

    // Connector line
    ctx.strokeStyle = col + '50';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(px + sz, py);
    ctx.lineTo(lx - this.s(3), ly - th / 2 + this.s(2));
    ctx.stroke();

    // Callsign text
    ctx.fillStyle    = selected ? '#ffffff' : col;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(tag, lx, ly);

    // Speed/altitude mini indicator for selected
    if (selected) {
      ctx.font      = `${this.s(7)}px 'Share Tech Mono', monospace`;
      ctx.fillStyle = 'rgba(150,200,255,0.7)';
      ctx.fillText(`${Math.round(p.speed * 60)} kts`, lx, ly + this.s(9));
    }
  }

  // ── Hit testing ──────────────────────────────────────────────────────────────

  hitTest(canvasX, canvasY, planes) {
    if (!planes) return null;
    const [gx, gy] = this.toGame(canvasX, canvasY);
    const HIT_R    = 22 / this.scale;

    let best = null, bestDist = Infinity;
    for (const p of planes) {
      if (p.state === 'departed' || p.state === 'crashed') continue;
      const d = Math.hypot(p.x - gx, p.y - gy);
      if (d < HIT_R && d < bestDist) { bestDist = d; best = p; }
    }
    return best ? best.id : null;
  }
}
