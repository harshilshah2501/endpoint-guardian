# EndpointDoctor Documentation

This folder contains the complete operational documentation for using and understanding EndpointDoctor beyond installation.

## Read This First

1. [Comprehensive Product Tour](./TOUR.md)
2. [Top 20 Covered Scenarios](./SCENARIOS.md)
3. [System Deep Dive (How It Works)](./ARCHITECTURE.md)
4. [AI and Transformer Features (How + Why)](./AI_FEATURES.md)
5. [Scenario Validation Playbook](./VALIDATION_PLAYBOOK.md)
6. [USP and Differentiators](./USP.md)

## Scope

These docs are written from the current implementation in:
- local rules engine (`src/engine/rules-engine.ts`)
- ONNX model pipeline (`src/engine/onnx-model-manager.ts` + `src/engine/local-inference.ts`)
- UI and runtime orchestration (`src/pages/Index.tsx`, `src/hooks/use-diagnosis.ts`)
- desktop telemetry and tray agent (`electron/telemetry.cjs`, `electron/main.cjs`)

