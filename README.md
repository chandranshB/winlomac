# Racing Game

A multiplayer 3D racing game built with React, Three.js, and Rapier physics.

## Features

- Realistic car physics with drift mechanics
- Multiplayer support via WebRTC (PeerJS)
- 3D graphics with React Three Fiber
- Large map files stored in Cloudflare R2
- Local development with R2 fallback

## Quick Start

### Development

```bash
npm install
npm run dev
```

### R2 Setup for Large Assets

This project uses Cloudflare R2 to store large map files (avoiding GitHub's file size limits).

See [SETUP_R2.md](./SETUP_R2.md) for detailed setup instructions.

Quick setup:
1. `cd workers && npm install`
2. `npx wrangler login`
3. `npm run upload-map`
4. `npm run deploy`
5. Update `.env` with your worker URL

The app automatically:
- Uses local files in development (fast)
- Falls back to R2 if local files aren't available
- Uses R2 in production

## Project Structure

```
src/
├── components/     # UI components (HUD, Lobby, Loading)
├── game/          # Game scene and track
├── vehicle/       # Car physics and visuals
├── network/       # Multiplayer networking
├── store/         # State management
└── utils/         # Asset loading utilities

workers/           # Cloudflare Workers for R2
public/
├── models/        # 3D car models
└── tracks/        # Track models (local dev only)
```

## Testing

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:ui       # UI mode
npm run test:coverage # Coverage report
```

## Building

```bash
npm run build
npm run preview
```

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
