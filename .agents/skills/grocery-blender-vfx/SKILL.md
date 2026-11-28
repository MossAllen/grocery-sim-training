---
name: grocery-blender-vfx
description: Build and visually review Blender scenes, game sprites, and action effects for the Thai grocery training simulator. Use for checkout animation, customer gestures, lighting, scanner or receipt effects, sprite renders, and checking whether a rendered action explains the corresponding game mechanic.
---

# Grocery Blender VFX

Read the current brief in [the Blender handoff](../../../handoff/to-blender.md) and the export contracts in [ART_SPEC](../../../docs/ART_SPEC.md) and [AUDIO_SPEC](../../../docs/AUDIO_SPEC.md). Check how the target round actually draws and triggers the scene. For example, the walking renderer draws the store furniture on Canvas, while the lesson panels already use Blender sprites.

## Build and check one action

1. Express the mechanic as **player action → prop or character response → result the learner can read**. Sketch the start, contact, and result frames. Identify which information the player must see during the action, including any price, quantity, or receipt state.
2. Block with project props and a fixed camera first. Check the hardest pose at the actual viewing scale. Inspect hands, the item and the point of contact. For an effect-heavy scene compare lighting before and during the effect so the prop, its edges, and the state change remain readable.
3. Keep light and sound on the frame that establishes the outcome. In the game, emit the scanner cue and flash once per accepted scan, with one new receipt line. Keep the state legible at small scale and sound off. Use reduced-motion settings for any version running in the browser.
4. Export the editable Blender scene and the three action frames to a local preview folder. Inspect a side-by-side contact sheet, then view a short motion sample if the action is animated. Zoom on contact or text if uncertain, correct the affected section, and render those frames again. Verify generated deliverables open before making claims about them.
5. For assets moving into the game, preserve the existing key, framing, and alpha contract. For a checkout change, play both price cases for all three product groups and verify totals, scoring, and reload against the existing exercise. Check desktop and small mobile, and run `node tools/check.js` after asset or game changes. State which files are the Blender preview and which are used by the game.

The storyboard, staged-pose inspection and contact-sheet review adapt Kreycin’s [code-video workflow](https://github.com/Kreycin/ton-sea/blob/main/.claude/skills/code-video/SKILL.md) to the project’s Blender scenes.
