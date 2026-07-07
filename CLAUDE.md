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
- Lightweight Rapier rigid body — wired up as of the rigid-body vehicle work (see Status).
- Controls: drive/steer, dedicated boost, handbrake modifier.
- Drift logic: holding handbrake should drastically lower lateral friction while applying a subtle rotational force, for high-angle arcade-style drifting.
- Exhaust smoke: continuous trail of basic mesh/point particles from the rear.

## Status

**Task 1 (done):** Vite/TS scaffold, Three.js scene + flat ground plane, Rapier WASM initialized, yellow box car moved via plain keyboard-driven transform math, simple chase camera. (GitHub PR #1)

**Rigid-body vehicle (done, GitHub issue #2):** Car is now a `THREE.Group` (body block + smaller cabin block + 4 wheel cylinders) driven by a real dynamic Rapier rigid body — see `entities/car.ts`. Key points:
- `applyControls(input, dt)` sets the body's linear velocity and angular velocity directly — called *before* `world.step()`.
- Rotations locked to Y-only (`enabledRotations(false, true, false)`) so the car can't tip over.
- `syncFromPhysics(dt)` reads the body's translation/rotation *after* `world.step()` and applies it to the visual `group`, and spins the wheel meshes based on `forwardSpeed`. Wheel geometry is pre-rotated once at creation (`wheelGeometry.rotateZ(Math.PI/2)`) so animating `wheel.rotation.x` each frame is a correct rolling spin, not a compound-Euler hack.
- The ground (`world/ground.ts`) now also creates a matching static Rapier collider (a thin cuboid) so the car actually rests/collides with it instead of just visually overlapping.

**Boost, handbrake, and arcade drift (done, GitHub issues #3 and #4):** `applyControls` now decomposes the body's planar velocity into forward/lateral components (via dot products against the car's forward/right axes each frame) instead of only ever setting a pure-forward velocity:
- Throttle ramps the **forward** component toward a target speed (`MAX_SPEED`, or `BOOST_SPEED` while `input.boost` — Left/Right Shift — is held; `REVERSE_SPEED` for reverse) at a fixed acceleration.
- The **lateral** component decays toward 0 at a "grip" rate each frame — `NORMAL_GRIP` (fast, near-zero slip) normally, or `DRIFT_GRIP` (much slower) while `input.handbrake` (Space) is held. This is the "drastically lower lateral friction" behavior from the brief — it only works because velocity is decomposed into axes first; a naive "always set velocity = forward * speed" model (what Task 2 originally had) has no lateral component to loosen.
- Steering adds `DRIFT_TURN_ASSIST` extra angular velocity on top of `TURN_RATE` while handbraking and turning — the "subtle rotational force" that helps the car rotate into the slide instead of just sliding straight.
- `core/input.ts` gained `boost`/`handbrake` getters (Shift / Space) and now calls `preventDefault()` on all recognized action keys to stop Space from scrolling the page.
- Verified numerically via a headless browser reading the rigid body's actual velocity: turning without handbrake keeps lateral speed under ~5% of total speed; turning with handbrake held pushes lateral speed to ~60% of total speed — a real, controllable slide, not cosmetic. Boost was confirmed to push speed measurably past `MAX_SPEED`.

**Next up (not started):** exhaust smoke (issue #5), instanced environment trees (issue #6), bounciness/procedural animation tuning (issue #7), AI-gen texture/palette exploration (issue #8).

## Working style

This project is developed **iteratively, issue-by-issue** — implement one task fully, verify it (typecheck + build + actually running the render loop / driving the car), then stop and wait for direction on the next issue rather than scope-creeping ahead.
