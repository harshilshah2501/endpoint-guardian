# EndpointDoctor

**Offline-first system diagnostics powered by micro-transformer AI models.**

EndpointDoctor monitors your system's health (CPU, memory, disk, thermals, processes) and provides intelligent diagnostics using three specialized ONNX transformer models that run entirely on-device — no cloud required.

---

## Features

- **Real-time system monitoring** — CPU, memory, disk, thermal sensors, running processes
- **Transformer-powered diagnostics** — 3 micro-transformer models (~700KB total) for anomaly detection, causal analysis, and remediation ranking
- **Causal chain visualization** — see which signals drive which issues (e.g. `high_cpu → thermal_throttle`)
- **Offline-first** — all diagnostic reasoning runs locally via ONNX Runtime WASM
- **System tray agent** — background monitoring with desktop notifications on state changes
- **Cloud AI fallback** — optional deep analysis via backend functions for natural-language explanations
- **Issue catalog & safety matrix** — comprehensive reference for known endpoint issues

## Architecture

```
Telemetry Snapshot (12+ features)
        │
        ▼
┌──────────────────────┐
│  Feature Encoder     │  Shared embedding layer
│  Normalize + Project │  Maps raw metrics → 64-dim vectors
└──────┬───────────────┘
       │
       ├──────────────────────────┐
       ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│ Anomaly Clf     │    │ Causal Attention     │
│ 2-layer encoder │    │ Cross-signal ranker  │
│ → health class  │    │ → root cause chain   │
└────────┬────────┘    └──────────┬───────────┘
         │                        │
         └────────┬───────────────┘
                  ▼
         ┌────────────────┐
         │ Remediation    │
         │ Selector       │
         │ → action plan  │
         └────────────────┘
```

## Quick Start (Web)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Running as Electron Desktop App

### Prerequisites

- Node.js 18+
- npm 9+

### Development

```bash
# Build the web app first
npm run build

# Launch Electron in development
npx electron .
```

### Packaging for Distribution

EndpointDoctor uses `@electron/packager` to create standalone executables.

#### Linux

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=linux --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

Output: `electron-release/EndpointDoctor-linux-x64/`

#### macOS

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=darwin --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

Output: `electron-release/EndpointDoctor-darwin-x64/EndpointDoctor.app`

#### Windows

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

Output: `electron-release/EndpointDoctor-win32-x64/EndpointDoctor.exe`

> **Note:** The packaged output is a portable executable folder, not an `.msi` or `.exe` installer. Double-click `EndpointDoctor.exe` inside the output folder to launch the app. To create a proper Windows installer (`.exe` setup wizard), you would need a tool like [Inno Setup](https://jrsoftware.org/isinfo.php) or [NSIS](https://nsis.sourceforge.io/).

## Transformer Models

The three ONNX models live in `public/models/` and are bundled into `dist/models/` at build time:

| Model | File | Purpose |
|-------|------|---------|
| Anomaly Classifier | `anomaly_clf.onnx` | 4-class health classification + per-feature anomaly scores |
| Causal Ranker | `causal_ranker.onnx` | Cross-signal causal analysis via attention weights |
| Remediation Selector | `remediation_selector.onnx` | Context-aware action ranking with tier classification |

### Regenerating Models

Models are generated from Python scripts with hand-crafted domain-expertise weights:

```bash
pip install numpy onnx
python scripts/generate-anomaly-clf.py
python scripts/generate-causal-ranker.py
python scripts/generate-remediation-selector.py
```

## Project Structure

```
├── electron/           # Electron main process (tray, IPC, background monitoring)
│   ├── main.cjs        # Main process entry
│   ├── preload.cjs     # Context bridge for renderer
│   └── telemetry.cjs   # Native telemetry collection (CPU, memory, disk)
├── public/models/      # ONNX transformer models
├── scripts/            # Model generation scripts (Python)
├── src/
│   ├── components/     # React UI components
│   ├── data/           # Demo scenarios, issue catalog, safety matrix
│   ├── engine/         # Inference engine (ONNX manager, rules engine)
│   ├── hooks/          # React hooks (diagnosis, telemetry)
│   ├── pages/          # Route pages
│   └── types/          # TypeScript type definitions
├── supabase/functions/ # Edge functions for cloud AI fallback
└── package.json
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **AI Runtime:** ONNX Runtime Web (WASM backend)
- **Desktop:** Electron with system tray agent
- **Backend (optional):** Lovable Cloud for deep AI analysis

## License

Private — all rights reserved.
