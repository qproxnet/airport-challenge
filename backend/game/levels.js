/**
 * Level definitions for Airport Challenge.
 *
 * Coordinate system: (0,0) = top-left, x increases right, y increases down.
 * Map size is defined per level; the canvas scales to fit.
 *
 * taxiMainY: Y-coordinate of the primary parallel taxiway (used by engine for routing).
 */

const LEVELS = {
  1: {
    id: 1,
    name: 'Greenfield Airport',
    description: 'Quiet regional airport. Learn the basics of ATC — land and depart aircraft safely.',
    unlockRequirement: null,
    requiredScore: 0,
    passingScore: 4000,
    mapWidth:  820,
    mapHeight: 580,

    // Single east-west runway (RW09/27)
    runways: [
      {
        id: 'RW09/27',
        x1: 95,  y1: 320,   // RW09 threshold — land heading east
        x2: 710, y2: 320,   // RW27 threshold — land heading west
        width: 32
      }
    ],

    // taxiMainY: Y of the parallel taxiway (between runway and terminal)
    taxiMainY: 248,

    taxiways: [
      // Main parallel taxiway (Taxiway Alpha)
      { x1: 70,  y1: 248, x2: 740, y2: 248, width: 15 },
      // Runway exits
      { x1: 195, y1: 248, x2: 195, y2: 320, width: 15 },  // West exit
      { x1: 610, y1: 248, x2: 610, y2: 320, width: 15 },  // East exit
      // Gate access taxiways
      { x1: 305, y1: 160, x2: 305, y2: 248, width: 14 },
      { x1: 375, y1: 160, x2: 375, y2: 248, width: 14 },
      { x1: 445, y1: 160, x2: 445, y2: 248, width: 14 },
      { x1: 515, y1: 160, x2: 515, y2: 248, width: 14 }
    ],

    terminal: { x: 265, y: 108, width: 300, height: 54 },

    gates: [
      { id: 'A1', x: 305, y: 150, taxiY: 248 },
      { id: 'A2', x: 375, y: 150, taxiY: 248 },
      { id: 'A3', x: 445, y: 150, taxiY: 248 },
      { id: 'A4', x: 515, y: 150, taxiY: 248 }
    ],

    entryPoints: [
      { id: 'EP_EAST', x: 860, y: 320 },
      { id: 'EP_WEST', x: -40, y: 320 },
      { id: 'EP_NE',   x: 800, y: -40 },
      { id: 'EP_NW',   x: 20,  y: -40 }
    ],

    holdingFixes: [
      { id: 'ALPHA', x: 720, y: 148, radius: 68 },   // East hold
      { id: 'BRAVO', x: 100, y: 148, radius: 68 }    // West hold
    ],

    spawnIntervalMs:    22000,
    maxConcurrentPlanes: 5,

    planeTypes: [
      { type: 'airliner',  label: 'Airliner',    weight: 60, speed: 2.5, color: '#00ff88', size: 9  },
      { type: 'prop',      label: 'Turboprop',   weight: 40, speed: 3.0, color: '#44ddff', size: 7  }
    ],

    dayDurationMs: 120000,
    maxDays: 5
  },

  2: {
    id: 2,
    name: 'Metro International',
    description: 'Two runways and heavier traffic. Sequence arrivals carefully — one wrong call ends the day.',
    unlockRequirement: 1,
    requiredScore: 4000,
    passingScore: 10000,
    mapWidth:  920,
    mapHeight: 660,

    runways: [
      {
        id: 'RW18/36',
        x1: 85,  y1: 355,
        x2: 835, y2: 355,
        width: 32
      },
      {
        id: 'RW09/27',
        x1: 460, y1: 80,
        x2: 460, y2: 570,
        width: 30,
        vertical: true
      }
    ],

    taxiMainY: 290,

    taxiways: [
      { x1: 85,  y1: 290, x2: 835, y2: 290, width: 15 },
      { x1: 200, y1: 290, x2: 200, y2: 355, width: 15 },
      { x1: 720, y1: 290, x2: 720, y2: 355, width: 15 },
      { x1: 320, y1: 210, x2: 320, y2: 290, width: 14 },
      { x1: 410, y1: 210, x2: 410, y2: 290, width: 14 },
      { x1: 560, y1: 210, x2: 560, y2: 290, width: 14 },
      { x1: 650, y1: 210, x2: 650, y2: 290, width: 14 }
    ],

    terminal: { x: 290, y: 152, width: 410, height: 60 },

    gates: [
      { id: 'B1', x: 320, y: 165, taxiY: 290 },
      { id: 'B2', x: 400, y: 165, taxiY: 290 },
      { id: 'B3', x: 480, y: 165, taxiY: 290 },
      { id: 'B4', x: 560, y: 165, taxiY: 290 },
      { id: 'B5', x: 640, y: 165, taxiY: 290 }
    ],

    entryPoints: [
      { id: 'EP_EAST',  x: 960, y: 355 },
      { id: 'EP_WEST',  x: -40, y: 355 },
      { id: 'EP_NORTH', x: 460, y: -40 },
      { id: 'EP_SOUTH', x: 460, y: 700 },
      { id: 'EP_NE',    x: 880, y: -40 }
    ],

    holdingFixes: [
      { id: 'ALPHA',   x: 820, y: 195, radius: 68 },
      { id: 'BRAVO',   x: 100, y: 195, radius: 68 },
      { id: 'CHARLIE', x: 460, y: 610, radius: 68 }
    ],

    spawnIntervalMs:    14000,
    maxConcurrentPlanes: 8,

    planeTypes: [
      { type: 'airliner',  label: 'Airliner',    weight: 55, speed: 2.5, color: '#00ff88', size: 9  },
      { type: 'prop',      label: 'Turboprop',   weight: 25, speed: 3.0, color: '#44ddff', size: 7  },
      { type: 'jet',       label: 'Private Jet', weight: 20, speed: 3.8, color: '#ffaa00', size: 7  }
    ],

    dayDurationMs: 90000,
    maxDays: 7
  }
};

module.exports = { LEVELS };
