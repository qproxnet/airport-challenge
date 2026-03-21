/**
 * Level definitions for Airport Challenge.
 * Each level defines the airport layout, traffic parameters, and scoring.
 *
 * Coordinate system: (0,0) = top-left, x increases right, y increases down.
 * Map size is defined per level; the canvas scales to fit the screen.
 */

const LEVELS = {
  1: {
    id: 1,
    name: 'Greenfield Airport',
    description: 'A quiet regional airport. Learn the basics of air traffic control.',
    unlockRequirement: null,
    requiredScore: 0,
    passingScore: 4000,
    mapWidth: 800,
    mapHeight: 560,

    // Single east-west runway
    runways: [
      {
        id: 'RW',
        x1: 100, y1: 300,   // RW09 threshold (land heading east)
        x2: 700, y2: 300,   // RW27 threshold (land heading west)
        width: 30
      }
    ],

    taxiways: [
      { x1: 80,  y1: 240, x2: 720, y2: 240, width: 14 }, // North parallel
      { x1: 200, y1: 240, x2: 200, y2: 300, width: 14 }, // West exit
      { x1: 600, y1: 240, x2: 600, y2: 300, width: 14 }, // East exit
      { x1: 300, y1: 165, x2: 300, y2: 240, width: 14 }, // Gate 1 access
      { x1: 370, y1: 165, x2: 370, y2: 240, width: 14 }, // Gate 2 access
      { x1: 440, y1: 165, x2: 440, y2: 240, width: 14 }, // Gate 3 access
      { x1: 510, y1: 165, x2: 510, y2: 240, width: 14 }  // Gate 4 access
    ],

    terminal: { x: 260, y: 112, width: 290, height: 55 },

    gates: [
      { id: 'G1', x: 300, y: 155, taxiY: 240 },
      { id: 'G2', x: 370, y: 155, taxiY: 240 },
      { id: 'G3', x: 440, y: 155, taxiY: 240 },
      { id: 'G4', x: 510, y: 155, taxiY: 240 }
    ],

    // Points where aircraft enter the map
    entryPoints: [
      { id: 'EP_EAST', x: 840, y: 300 },
      { id: 'EP_WEST', x: -40, y: 300 },
      { id: 'EP_NE',   x: 780, y: -40 },
      { id: 'EP_NW',   x: 20,  y: -40 }
    ],

    holdingFixes: [
      { id: 'ALPHA', x: 700, y: 145, radius: 65 }, // East
      { id: 'BRAVO', x: 100, y: 145, radius: 65 }  // West
    ],

    spawnIntervalMs: 20000,   // 20 s between planes at day 1
    maxConcurrentPlanes: 5,

    planeTypes: [
      { type: 'airliner', label: 'Airliner', weight: 65, speed: 2.6, color: '#00ff88', size: 9 },
      { type: 'prop',     label: 'Turboprop', weight: 35, speed: 3.2, color: '#44ddff', size: 7 }
    ],

    dayDurationMs: 120000, // 2 min per day
    maxDays: 5
  },

  2: {
    id: 2,
    name: 'Metro International',
    description: 'Two crossing runways and heavier traffic. Stay sharp!',
    unlockRequirement: 1,
    requiredScore: 4000,
    passingScore: 10000,
    mapWidth: 900,
    mapHeight: 640,

    runways: [
      {
        id: 'RW_EW',
        x1: 80,  y1: 340,
        x2: 820, y2: 340,
        width: 30
      },
      {
        id: 'RW_NS',
        x1: 450, y1: 80,
        x2: 450, y2: 560,
        width: 30,
        vertical: true
      }
    ],

    taxiways: [
      { x1: 80,  y1: 280, x2: 820, y2: 280, width: 14 },
      { x1: 200, y1: 280, x2: 200, y2: 340, width: 14 },
      { x1: 700, y1: 280, x2: 700, y2: 340, width: 14 },
      { x1: 310, y1: 200, x2: 310, y2: 280, width: 14 },
      { x1: 400, y1: 200, x2: 400, y2: 280, width: 14 },
      { x1: 550, y1: 200, x2: 550, y2: 280, width: 14 },
      { x1: 640, y1: 200, x2: 640, y2: 280, width: 14 }
    ],

    terminal: { x: 280, y: 145, width: 400, height: 58 },

    gates: [
      { id: 'G1', x: 310, y: 158, taxiY: 280 },
      { id: 'G2', x: 390, y: 158, taxiY: 280 },
      { id: 'G3', x: 470, y: 158, taxiY: 280 },
      { id: 'G4', x: 550, y: 158, taxiY: 280 },
      { id: 'G5', x: 630, y: 158, taxiY: 280 }
    ],

    entryPoints: [
      { id: 'EP_EAST',  x: 940, y: 340 },
      { id: 'EP_WEST',  x: -40, y: 340 },
      { id: 'EP_NORTH', x: 450, y: -40 },
      { id: 'EP_SOUTH', x: 450, y: 680 },
      { id: 'EP_NE',    x: 860, y: -40 }
    ],

    holdingFixes: [
      { id: 'ALPHA',   x: 800, y: 195, radius: 65 },
      { id: 'BRAVO',   x: 100, y: 195, radius: 65 },
      { id: 'CHARLIE', x: 450, y: 600, radius: 65 }
    ],

    spawnIntervalMs: 13000,
    maxConcurrentPlanes: 8,

    planeTypes: [
      { type: 'airliner', label: 'Airliner',  weight: 55, speed: 2.6, color: '#00ff88', size: 9 },
      { type: 'prop',     label: 'Turboprop', weight: 25, speed: 3.2, color: '#44ddff', size: 7 },
      { type: 'jet',      label: 'Private Jet', weight: 20, speed: 3.6, color: '#ffaa00', size: 7 }
    ],

    dayDurationMs: 90000,
    maxDays: 7
  }
};

module.exports = { LEVELS };
