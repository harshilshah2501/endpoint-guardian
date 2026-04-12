# EndpointDoctor

**Offline-first endpoint diagnostics powered by micro-transformer AI models.**

EndpointDoctor monitors system health — CPU, memory, disk, network, thermals, and running processes — and delivers intelligent diagnostics using three specialized ONNX transformer models that run entirely on-device. No cloud, no API keys, no internet required.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real-time system monitoring** | CPU, memory, disk, thermal sensors, running processes |
| **Transformer-powered diagnostics** | 3 micro-transformer models (~700KB) for anomaly detection, causal analysis, and remediation ranking |
| **Causal chain visualization** | See which signals drive which issues (e.g. `high_cpu → thermal_throttle`) |
| **Offline-first** | All diagnostic reasoning runs locally via ONNX Runtime WASM |
| **System tray agent** | Background monitoring with desktop notifications on state changes |
| **Cloud AI fallback** | Optional deep analysis via backend functions for natural-language explanations |
| **Issue catalog & safety matrix** | Comprehensive reference for known endpoint issues and remediation tiers |

---

## 🏗 Architecture

```
Telemetry Snapshot (12 features)
        │
        ▼
┌──────────────────────┐
│  Feature Encoder     │  Normalize + project raw metrics → 64-dim vectors
└──────┬───────────────┘
       │
       ├──────────────────────────┐
       ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│ Anomaly Clf     │    │ Causal Ranker        │
│ 2-layer encoder │    │ Cross-attention      │
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

**Quick mode:** Anomaly Classifier only (~100ms)
**Deep mode:** All three models in sequence (~300–500ms)

---

## 🚀 Quick Start

### Web (Development)

```bash
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080). Select a scenario from the dropdown and click **Quick Scan** or **Deep Analysis**.

### Electron Desktop App

```bash
# Build the web app
npm run build

# Launch Electron
npx electron .
```

The desktop app adds:
- **Live telemetry** — real CPU/memory/disk/network data from your machine
- **System tray** — background monitoring with notifications on state changes
- **Fully offline** — no internet required after install

---

## 📦 Packaging for Distribution

EndpointDoctor uses `@electron/packager` to create standalone executables.

### Prerequisites

- Node.js 18+
- npm 9+

### macOS (Apple Silicon — M1/M2/M3)

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=darwin --arch=arm64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

Output: `electron-release/EndpointDoctor-darwin-arm64/EndpointDoctor.app`

> **Gatekeeper:** The app is unsigned. Right-click → **Open** on first launch, or run:
> ```bash
> xattr -cr EndpointDoctor.app
> ```

### macOS (Intel)

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=darwin --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

### Windows

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=win32 --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

Output: `electron-release/EndpointDoctor-win32-x64/EndpointDoctor.exe`

> **Note:** This produces a portable folder, not an `.msi` installer. Double-click `EndpointDoctor.exe` inside the output folder to launch. For a setup wizard, use [Inno Setup](https://jrsoftware.org/isinfo.php) or [NSIS](https://nsis.sourceforge.io/).

### Linux

```bash
npm run build
npx @electron/packager . "EndpointDoctor" \
  --platform=linux --arch=x64 \
  --out=electron-release --overwrite \
  --ignore='node_modules' --ignore='^/src' --ignore='^/public' \
  --ignore='^/electron-release' --ignore='^/scripts' --ignore='^/supabase'
```

Output: `electron-release/EndpointDoctor-linux-x64/`

---

## 🤖 Transformer Models

Three ONNX models live in `public/models/` and are bundled into `dist/models/` at build time:

| Model | File | Purpose |
|-------|------|---------|
| Anomaly Classifier | `anomaly_clf.onnx` | 4-class health classification (healthy/degraded/warning/critical) + per-feature anomaly scores |
| Causal Ranker | `causal_ranker.onnx` | Cross-signal causal analysis — attention weights reveal which metrics drive which issues |
| Remediation Selector | `remediation_selector.onnx` | Context-aware action ranking with tier classification (diagnostic/basic/advanced) |

### Regenerating Models

Models are generated from Python scripts with hand-crafted domain-expertise weights:

```bash
pip install numpy onnx
python scripts/generate-anomaly-clf.py
python scripts/generate-causal-ranker.py
python scripts/generate-remediation-selector.py
```

---

## 📂 Project Structure

```
├── electron/               # Electron main process
│   ├── main.cjs             # Main process entry (BrowserWindow, tray, IPC)
│   ├── preload.cjs           # Context bridge (collectTelemetry API)
│   └── telemetry.cjs         # Native telemetry collection (CPU, memory, disk, network)
├── public/models/            # ONNX transformer models
├── scripts/                  # Python model generation scripts
├── src/
│   ├── components/           # React UI (DiagnosisView, SnapshotViewer, SafetyMatrix, etc.)
│   ├── data/                 # Demo scenarios, issue catalog, safety matrix data
│   ├── engine/               # Inference engine
│   │   ├── onnx-model-manager.ts  # Multi-model ONNX loader with lazy-loading & auto-unload
│   │   ├── local-inference.ts     # Orchestrates rules engine + transformer pipeline
│   │   ├── rules-engine.ts        # Deterministic diagnostic rules (always runs)
│   │   └── electron-telemetry.ts  # Bridge to Electron native telemetry
│   ├── hooks/                # React hooks (useDiagnosis, useMobile)
│   ├── pages/                # Route pages (Index, NotFound)
│   └── types/                # TypeScript type definitions
├── supabase/functions/       # Edge functions for optional cloud AI analysis
│   ├── diagnose/             # Quick cloud diagnosis
│   └── diagnose-deep/        # Deep AI analysis (Gemini-powered)
└── package.json
```

---

## 🛠 Tech Stack

- **Frontend:** React 18 · TypeScript · Tailwind CSS · shadcn/ui · Recharts
- **AI Runtime:** ONNX Runtime Web (WASM backend, single-threaded)
- **Desktop:** Electron 41 with system tray agent
- **Backend (optional):** Lovable Cloud for deep AI analysis (Gemini 2.5 Flash)
- **Build:** Vite 5 · @electron/packager

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run Playwright e2e tests
npx playwright test
```

---

## License

Private — all rights reserved.
