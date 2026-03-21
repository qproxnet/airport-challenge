# Airport Challenge

Multiplayer Air Traffic Control Spiel — Browser-basiert, iPhone-optimiert.

## Quick Start (Docker)

```bash
cp .env.example .env
# JWT_SECRET in .env anpassen!
docker compose up -d
# Öffne http://localhost:3000
```

## Development (lokal)

```bash
# MongoDB muss laufen (oder Docker):
docker run -d -p 27017:27017 mongo:7

# Backend starten:
cd backend
npm install
npm run dev

# Frontend: statisch via backend serviert auf http://localhost:3000
```

## Architektur

```
AirportChallenge/
├── backend/
│   ├── server.js          # Express + Socket.io Server
│   ├── game/
│   │   ├── GameEngine.js  # Server-seitige Spiellogik (läuft bei 10 FPS)
│   │   └── levels.js      # Level-Definitionen (Layout, Traffic, Scoring)
│   ├── models/User.js     # MongoDB User-Schema (Scores, unlocked Levels)
│   └── routes/auth.js     # REST: /register /login /leaderboard /save-score
└── frontend/
    ├── index.html         # Single-Page-App
    ├── css/style.css      # Radar-Ästhetik, Mobile-first
    └── js/
        ├── app.js         # Screen-Routing, Auth, Lobby
        ├── game.js        # Socket.io Client, HUD, Commands
        └── renderer.js    # HTML5 Canvas Renderer
```

## Spielmechanik

- **Flugzeug antippen** → auswählen
- **"Landen freigeben"** → Flugzeug landet auf Runway
- **"Warteschleife"** → Flugzeug kreist im Holding Pattern
- **"Durchstarten"** → Abbrechende Landung, zurück in Hold
- **"Abflug freigeben"** → Flugzeug taxiert zur Runway
- **"Start freigeben"** → Flugzeug startet

**3 Crashes = Game Over**

## Multiplayer

Zwei Spieler können denselben Raum teilen (Raum-ID eingeben oder teilen).
Beide können alle Flugzeuge gleichzeitig steuern — kooperativ!

## Levels

| Level | Name               | Runways | Max Planes | Freischaltbar |
|-------|--------------------|---------|------------|---------------|
| 1     | Greenfield Airport | 1 (EW)  | 5          | Standard      |
| 2     | Metro International| 2 (EW+NS)| 8         | 4.000 Punkte  |
