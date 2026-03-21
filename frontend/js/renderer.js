'use strict';

/**
 * AirportRenderer — draws the full game state onto an HTML5 Canvas.
 *
 * Coordinate system: game world (mapWidth × mapHeight) is scaled to fit the
 * canvas while preserving aspect ratio. All game coordinates are converted via
 * toCanvas() before drawing.
 */
class AirportRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.scale  = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.mapW   = 800;
    this.mapH   = 560;
    this.frame  = 0;
  }

  // ── Layout ────────────────────────────────────────────────────────────────

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

  // Convert game coords → canvas coords
  toCanvas(x, y) {
    return [x * this.scale + this.offsetX, y * this.scale + this.offsetY];
  }

  // Convert canvas coords → game coords
  toGame(cx, cy) {
    return [(cx - this.offsetX) / this.scale, (cy - this.offsetY) / this.scale];
  }

  s(v) { return v * this.scale; }  // scale a size value

  // ── Main draw ─────────────────────────────────────────────────────────────

  draw(state, selectedId) {
    if (!state) return;
    this.frame++;
    const ctx = this.ctx;
    const { levelMeta, planes, gates } = state;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._drawBackground(levelMeta);
    this._drawTaxiways(levelMeta);
    this._drawRunways(levelMeta, state.runway);
    this._drawTerminal(levelMeta);
    this._drawGates(levelMeta, gates);
    this._drawHoldingFixes(levelMeta);
    this._drawApproachPaths(planes);
    this._drawPlanes(planes, selectedId);
  }

  // ── Background / grid ─────────────────────────────────────────────────────

  _drawBackground(meta) {
    const ctx = this.ctx;
    const [x0, y0] = this.toCanvas(0, 0);
    const [x1, y1] = this.toCanvas(meta.mapWidth, meta.mapHeight);
    const w = x1 - x0, h = y1 - y0;

    // Dark tarmac base
    ctx.fillStyle = '#050e20';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Radar grid
    ctx.save();
    ctx.strokeStyle = '#091a30';
    ctx.lineWidth = 1;
    const step = this.s(40);
    for (let gx = x0 % step; gx < this.canvas.width; gx += step) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, this.canvas.height); ctx.stroke();
    }
    for (let gy = y0 % step; gy < this.canvas.height; gy += step) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(this.canvas.width, gy); ctx.stroke();
    }
    ctx.restore();

    // Grass / airspace area
    ctx.fillStyle = '#060f1e';
    ctx.fillRect(x0, y0, w, h);

    // Subtle vignette
    const grad = ctx.createRadialGradient(
      x0 + w / 2, y0 + h / 2, this.s(50),
      x0 + w / 2, y0 + h / 2, this.s(500)
    );
    grad.addColorStop(0, 'rgba(0,229,255,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, w, h);
  }

  // ── Taxiways ──────────────────────────────────────────────────────────────

  _drawTaxiways(meta) {
    const ctx = this.ctx;
    if (!meta.taxiways) return;
    for (const tw of meta.taxiways) {
      const [ax, ay] = this.toCanvas(tw.x1, tw.y1);
      const [bx, by] = this.toCanvas(tw.x2, tw.y2);
      ctx.strokeStyle = '#1a2a3a';
      ctx.lineWidth   = this.s(tw.width || 14);
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      // Taxiway centre line (yellow dashed)
      ctx.strokeStyle = '#2a2a00';
      ctx.lineWidth   = 1;
      ctx.setLineDash([this.s(6), this.s(6)]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Runways ───────────────────────────────────────────────────────────────

  _drawRunways(meta, runwayState) {
    const ctx = this.ctx;
    if (!meta.runways) return;
    for (const rw of meta.runways) {
      const [ax, ay] = this.toCanvas(rw.x1, rw.y1);
      const [bx, by] = this.toCanvas(rw.x2, rw.y2);

      // Asphalt
      const occupied = runwayState && runwayState.occupied;
      ctx.strokeStyle = occupied ? '#2a1500' : '#1e2a38';
      ctx.lineWidth   = this.s(rw.width || 30);
      ctx.lineCap     = 'butt';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();

      // White centre line dashes
      ctx.strokeStyle = occupied ? '#664400' : '#334455';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([this.s(15), this.s(10)]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);

      // Threshold markings
      this._drawThreshold(rw.x1, rw.y1, rw.x2, rw.y2, rw.width, false);
      this._drawThreshold(rw.x2, rw.y2, rw.x1, rw.y1, rw.width, true);

      // Runway label
      const mx = (rw.x1 + rw.x2) / 2;
      const my = (rw.y1 + rw.y2) / 2 - 22;
      const [lx, ly] = this.toCanvas(mx, my);
      ctx.fillStyle = '#334455';
      ctx.font = `${this.s(9)}px Courier New`;
      ctx.textAlign = 'center';
      ctx.fillText(rw.id || 'RW', lx, ly);
    }
  }

  _drawThreshold(x1, y1, x2, y2, rw_width, flip) {
    const ctx = this.ctx;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perp  = angle + Math.PI / 2;
    const hw    = (rw_width || 30) / 2 - 4;
    const bars  = 6;
    const bw    = hw / bars * 0.6;

    ctx.save();
    const [cx, cy] = this.toCanvas(x1, y1);
    ctx.translate(cx, cy);

    ctx.fillStyle = '#445566';
    for (let i = -bars; i <= bars; i++) {
      const ox = Math.sin(perp) * i * this.s(hw / bars);
      const oy = -Math.cos(perp) * i * this.s(hw / bars);
      ctx.fillRect(
        ox - this.s(bw) / 2,
        oy - this.s(4),
        this.s(bw), this.s(8)
      );
    }
    ctx.restore();
  }

  // ── Terminal & gates ──────────────────────────────────────────────────────

  _drawTerminal(meta) {
    if (!meta.terminal) return;
    const ctx = this.ctx;
    const t   = meta.terminal;
    const [tx, ty] = this.toCanvas(t.x, t.y);
    const tw = this.s(t.width), th = this.s(t.height);

    ctx.fillStyle   = '#0d2040';
    ctx.strokeStyle = '#1a4080';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, this.s(6));
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle   = '#2a5090';
    ctx.font        = `bold ${this.s(10)}px Courier New`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TERMINAL', tx + tw / 2, ty + th / 2);
  }

  _drawGates(meta, gateStates) {
    const ctx = this.ctx;
    const occupied = new Set((gateStates || []).filter(g => g.occupied).map(g => g.id));

    for (const g of (meta.gates || [])) {
      const [gx, gy] = this.toCanvas(g.x, g.y);
      const isOcc    = occupied.has(g.id);
      const sz       = this.s(10);

      ctx.fillStyle   = isOcc ? '#003388' : '#001a44';
      ctx.strokeStyle = isOcc ? '#0066ff' : '#003377';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.rect(gx - sz / 2, gy - sz / 2, sz, sz);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle    = isOcc ? '#66aaff' : '#335577';
      ctx.font         = `${this.s(7)}px Courier New`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.id, gx, gy);
    }
  }

  // ── Holding fixes ─────────────────────────────────────────────────────────

  _drawHoldingFixes(meta) {
    const ctx = this.ctx;
    for (const f of (meta.holdingFixes || [])) {
      const [fx, fy] = this.toCanvas(f.x, f.y);
      const r        = this.s(f.radius || 65);

      ctx.strokeStyle = 'rgba(0,100,160,0.25)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([this.s(4), this.s(6)]);
      ctx.beginPath();
      ctx.ellipse(fx, fy, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle    = 'rgba(0,100,160,0.3)';
      ctx.font         = `${this.s(7)}px Courier New`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`HOLD ${f.id}`, fx, fy);
    }
  }

  // ── Approach path lines ───────────────────────────────────────────────────

  _drawApproachPaths(planes) {
    if (!planes) return;
    const ctx = this.ctx;
    for (const p of planes) {
      if (!['approaching', 'on_final'].includes(p.state)) continue;
      if (!p.waypoints || p.waypoints.length === 0) continue;

      ctx.strokeStyle = p.warning
        ? 'rgba(255,80,0,0.3)'
        : 'rgba(0,200,100,0.2)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([this.s(5), this.s(7)]);
      ctx.beginPath();
      const [sx, sy] = this.toCanvas(p.x, p.y);
      ctx.moveTo(sx, sy);
      for (const wp of p.waypoints) {
        const [wx, wy] = this.toCanvas(wp.x, wp.y);
        ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Planes ────────────────────────────────────────────────────────────────

  _drawPlanes(planes, selectedId) {
    if (!planes) return;
    for (const p of planes) {
      if (p.state === 'departed') continue;
      this._drawPlane(p, p.id === selectedId);
    }
    // Draw labels on top
    for (const p of planes) {
      if (p.state === 'departed') continue;
      this._drawPlaneLabel(p, p.id === selectedId);
    }
  }

  _planeColor(p) {
    if (p.state === 'crashed')              return '#ff0000';
    if (p.warning)                          return '#ff6600';
    if (p.requestingDeparture)              return '#aa44ff';
    if (p.state === 'approaching')          return '#ffcc00';
    if (p.state === 'holding')              return '#888888';
    if (['on_final','landing_roll','exiting_runway'].includes(p.state)) return '#00ff88';
    if (p.state === 'taxiing_to_gate')      return '#00aaff';
    if (p.state === 'at_gate')              return '#4488ff';
    if (['taxiing_to_runway','holding_short'].includes(p.state)) return '#aa66ff';
    if (p.state === 'taking_off')           return '#00ff88';
    return p.color || '#00ff88';
  }

  _drawPlane(p, selected) {
    const ctx = this.ctx;
    const [px, py] = this.toCanvas(p.x, p.y);
    const sz  = this.s(p.size || 9);
    const col = this._planeColor(p);
    const rad = (p.heading || 0) * Math.PI / 180;

    // Pulsing selection ring
    if (selected) {
      const pulse = 0.6 + 0.4 * Math.sin(this.frame * 0.2);
      ctx.strokeStyle = `rgba(0,229,255,${pulse})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, sz * 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Glow
    const glow = ctx.createRadialGradient(px, py, 0, px, py, sz * 2);
    glow.addColorStop(0, col + '66');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(px, py, sz * 2, 0, Math.PI * 2); ctx.fill();

    // Plane body: filled triangle pointing in heading direction
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rad);

    ctx.fillStyle   = col;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(sz * 1.6, 0);           // nose
    ctx.lineTo(-sz * 0.8, -sz * 0.7); // left wing
    ctx.lineTo(-sz * 0.5, 0);          // tail
    ctx.lineTo(-sz * 0.8, sz * 0.7);  // right wing
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Warning flash
    if (p.warning && this.frame % 6 < 3) {
      ctx.fillStyle = 'rgba(255,80,0,0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, sz * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Departure request pulse
    if (p.requestingDeparture && this.frame % 10 < 5) {
      ctx.strokeStyle = '#aa44ff';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, sz * 3 + (this.frame % 10) * this.s(0.5), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crash animation
    if (p.state === 'crashed') {
      const r = sz * (2 + (this.frame % 15) * 0.3);
      ctx.strokeStyle = `rgba(255,0,0,${1 - (this.frame % 15) / 15})`;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawPlaneLabel(p, selected) {
    const ctx = this.ctx;
    const [px, py] = this.toCanvas(p.x, p.y);
    const sz  = this.s(p.size || 9);
    const col = this._planeColor(p);

    // Callsign tag
    const lx = px + sz * 2.5;
    const ly = py - sz;
    const tag = p.callsign;

    ctx.font = `${selected ? 'bold ' : ''}${this.s(9)}px Courier New`;
    const tw = ctx.measureText(tag).width;

    ctx.fillStyle = 'rgba(4,9,26,0.75)';
    ctx.fillRect(lx - 2, ly - this.s(9) - 1, tw + 4, this.s(10) + 2);

    ctx.fillStyle = selected ? '#ffffff' : col;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(tag, lx, ly);

    // State indicator dot
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(lx - this.s(5), ly - this.s(4), this.s(2.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Hit testing (find clicked plane) ─────────────────────────────────────

  hitTest(canvasX, canvasY, planes) {
    if (!planes) return null;
    const [gx, gy] = this.toGame(canvasX, canvasY);
    const HIT_RADIUS = 20 / this.scale; // game units

    let best = null, bestDist = Infinity;
    for (const p of planes) {
      if (p.state === 'departed' || p.state === 'crashed') continue;
      const d = Math.hypot(p.x - gx, p.y - gy);
      if (d < HIT_RADIUS && d < bestDist) {
        bestDist = d;
        best     = p;
      }
    }
    return best ? best.id : null;
  }
}
