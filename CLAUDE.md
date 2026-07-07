# YELLOWCAR

A 3D voxel driving playground: Three.js + Vite + Rapier Physics (WASM), built issue-by-issue.

## Original project brief (verbatim)

This is the initial prompt that kicked off the project, kept verbatim so future sessions have the exact original intent, not just a paraphrase:

> Act as my lead game developer. We are building a 3D voxel driving playground using Three.js, Vite, and Rapier Physics (WASM). We are using an iterative, issue-by-issue development approach. Please acknowledge these architectural and design guardrails before writing code:
>
> Aesthetics & Performance (iGPU Target):
> 3D voxel graphics with a Crossy Road aesthetic.
> To keep performance smooth on an integrated GPU, utilize InstancedMesh for rendering repetitive voxel elements (like environment trees) to keep draw calls near single digits. Use basic vertex-lit or unlit materials (no heavy post-processing shaders).
>
> Vehicle & Physics Blueprint:
> The player car is an old yellow voxel vehicle.
> Implement the vehicle using a lightweight Rapier rigid body.
> Controls: Standard drive/steer, a dedicated boost, and a handbrake modifier.
> Drift Logic: When handbrake is held, drastically lower lateral friction while applying a subtle rotational force to allow high-angle, fluid arcade drifting.
> Smoke: Emitting a continuous trail of basic mesh/point particles from the rear exhaust.
>
> Task 1: Create the project scaffold using Vite (Vanilla JS/TS or React, whichever keeps code cleaner for this setup), install Three.js and @dimforge/rapier3d, and render a basic flat ground plane with a controllable keyboard-input box representing the car. Stop and wait for my input once the loop runs.

The guardrails section below restates these as living project rules (kept in sync as decisions get made, e.g. TypeScript was chosen, and `@dimforge/rapier3d-compat` was substituted for the plain `@dimforge/rapier3d` package — see Stack section for why).

## Stack

- **Vite** (`vanilla-ts` template) — dev server + build
- **Three.js** — rendering
- **@dimforge/rapier3d-compat** — physics (NOT the plain `@dimforge/rapier3d` package — the `-compat` build inlines its WASM as base64 so Vite/esbuild can bundle it with no extra plugins; the plain package needs `vite-plugin-wasm` + `vite-plugin-top-level-await` and was deliberately avoided)

## Commands

```
npm install
npm run dev       # start dev server
npm run build     # tsc typecheck + production build to dist/
npm run preview   # serve the production build locally
```

## Architecture

```
src/
  main.ts             # entry point; async bootstrap + requestAnimationFrame loop
  core/
    scene.ts           # createScene(): THREE.Scene/camera/renderer/lights, resize handling
    physics.ts         # initPhysics(): await RAPIER.init(); returns a stepping RAPIER.World
    input.ts           # InputManager: keydown/keyup -> forward/back/left/right getters (WASD + arrows)
  entities/
    car.ts             # Car class: yellow box mesh, update(input, dt) moves it via transforms
  world/
    ground.ts          # createGround(): flat ground plane factory
```

Design intent behind these boundaries (so future issues don't need refactors):
- `core/` holds the three "engines" (render, physics, input) every future issue touches; `main.ts` stays a thin composition root.
- `entities/car.ts` exists now because this is exactly where the Rapier rigid body, drift logic, and exhaust particles attach later — same `update(input, dt)` call site, just swap the internals.
- `world/ground.ts` is separate from `entities/` because the ground will likely become an `InstancedMesh` voxel tile grid later (for trees etc.), possibly with static colliders.
- No ECS/systems abstraction — not warranted yet for one box and one plane. Introduce only once there are 2+ genuinely reusable systems.

## Architectural & design guardrails (apply to all future issues)

**Aesthetics & performance (iGPU target):**
- Crossy-Road-style voxel aesthetic.
- Use `InstancedMesh` for repetitive voxel elements (trees, etc.) to keep draw calls near single digits.
- Vertex-lit/unlit materials only (`MeshLambertMaterial` or similar) — no heavy post-processing shaders, no shadow maps unless explicitly revisited.

**Vehicle & physics blueprint:**
- Player car: old yellow voxel vehicle.
- Lightweight Rapier rigid body (not yet wired up — Task 1 only initializes the Rapier `World`, no body on the car yet).
- Controls: drive/steer, dedicated boost, handbrake modifier.
- Drift logic: holding handbrake should drastically lower lateral friction while applying a subtle rotational force, for high-angle arcade-style drifting.
- Exhaust smoke: continuous trail of basic mesh/point particles from the rear.

## Status

**Task 1 (done):** Vite/TS scaffold, Three.js scene + flat ground plane, Rapier WASM initialized (world steps every frame, no bodies attached yet), yellow box car moved via plain keyboard-driven transform math (no physics forces yet), simple chase camera. Verified: typecheck clean, dev/build/preview all work, headless-browser check confirmed rendering with zero console errors and that WASD actually changes the car's position/rotation.

**Next up (not started):** attaching a real Rapier rigid body/vehicle controller to the car, replacing the transform-based movement in `entities/car.ts`.

## Working style

This project is developed **iteratively, issue-by-issue** — implement one task fully, verify it (typecheck + build + actually running the render loop / driving the car), then stop and wait for direction on the next issue rather than scope-creeping ahead.
