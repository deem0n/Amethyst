# ADR 0001: Milonga DJ Mode

## Status

Proposed

## Date

2026-06-27

## Context

Amethyst is a general-purpose Electron/Vue audio player with queue, media-source, metadata, and playback controls already in place. This fork will adapt it for Tango DJs who run milongas and need to prepare and execute a danceable evening structure, not just play individual tracks.

A milonga program is usually organized as tandas: groups of related songs, commonly 3 or 4 tracks, separated by short cortinas. In Amethyst terms, a cortina is still a normal audio track, but Milonga mode needs cortina-specific playback rules such as playing only the first 30 seconds and applying fade-in and fade-out. DJs need fast library search, metadata confidence, predictable playback order, and visible upcoming music while the floor is active. The fork already has a Milonga screen and early Milonga-specific code in `src/renderer/views/MilongaView.vue`, `src/renderer/components/MilongaPlan.vue`, `amethyst.loadMilongaCandidateTracks`, and `state.milongaCandidateTracks`.

The product needs two modes. Milonga Creation mode is for preparing the plan. Milonga Playback mode is for automatic, low-risk execution during an event. Playback mode may adapt runtime behavior to meet an event end time, but must not mutate the original saved plan.

## Decision

Build Milonga support as dedicated creation and playback modes that reuse Amethyst's existing media sources, track metadata, and player engine. The existing Milonga screen should evolve into Milonga Creation mode first. A separate Milonga Playback mode should execute the plan automatically with safeguards for live DJ use.

Cortinas will be modeled as normal Amethyst tracks with Milonga-specific slot behavior. A cortina slot always resolves to a track before playback. It has two assignment modes:

- Automatic: choose a track from the active configured cortina set at playback time and apply the default cortina filter, for example play the first 30 seconds with fade-in and fade-out.
- Manual: use the specific track assigned by the DJ for that cortina slot. Manual assignment bypasses random pool selection, but still applies the cortina filter unless the slot has an explicit override.

The cortina library contains named sets of normal tracks selected by the DJ as eligible cortinas, for example `Michael Jackson`, `70s`, or `guitar`. The active set is used for automatic cortina assignment, while manual slot assignment can still force a specific track. Pool tracks are not duplicated or converted into a separate media type.

This avoids forking the whole queue model immediately, while still allowing Milonga-specific UX and data structures to mature independently.

Milonga playlists will use an extended M3U8-based format with a custom extension, `.milonga.m3u8`. M3U8 is simple, human-readable, playlist-oriented, and widely understood. Milonga-specific structure will be stored in `#EXT-X-MILONGA:*` comment/directive lines, so other players can still read the file as a basic ordered playlist while Amethyst can preserve tandas, cortinas, filters, manual cortina assignments, and playback policy.

## Goals

- Plan an evening as ordered tandas with configurable size, style, orchestra, singer, year, BPM, and duration cues.
- Support cortinas as first-class separators between tandas, backed by normal Amethyst tracks plus cortina playback filters.
- Let the DJ maintain named cortina sets for automatic cortina selection and manually assign a specific cortina track to any cortina slot.
- Let the DJ search and filter candidate tracks from configured media sources without disrupting playback.
- Let the DJ build and rearrange the plan with drag-and-drop between candidate tracks, tanda slots, cortina slots, and existing plan positions.
- Persist, reload, duplicate, export, and import Milonga plans.
- Provide a playback view that clearly shows current tanda, current tanda track position such as `2/4`, detected or selected tanda style, next track, remaining Milonga time, target end time, astronomical finish time, and emergency controls.
- Let the DJ set a target end time, such as 23:00, and allow playback mode to shorten the live program by reducing cortina durations, dropping unplayed tandas, or both without changing the original plan.
- Minimize live-performance risk: no surprise shuffle, no accidental queue clearing, and clear warnings for missing files or unloaded metadata.

## Non-Goals

- Full automatic DJing or recommendation quality equal to a human Tango DJ.
- Cloud sync, streaming-service playback, or remote collaboration.
- Replacing Amethyst's existing general queue for non-Milonga use.
- Permanently rewriting the saved plan when playback mode applies temporary time-cut decisions.

## Implementation Tasks

1. Define Milonga domain types in `src/shared` or a new renderer module: `MilongaPlan`, `Tanda`, `CortinaSlot`, `CortinaLibrary`, `CortinaSet`, `CortinaFilter`, `MilongaSlot`, and validation errors. `CortinaSlot` must support `automatic` and `manual` assignment modes.
2. Split the current Milonga screen responsibilities into Milonga Creation and Milonga Playback flows while reusing shared components where practical.
3. Replace the flat `Track[]` plan in `MilongaPlan.vue` with structured tanda/cortina state and explicit empty slots.
4. Add cortina-library editing: create/rename/delete named sets, add/remove normal tracks, preview cortinas, and select the active set for random slot selection.
5. Add default cortina filter settings: start offset, play duration, fade-in duration, fade-out duration, and optional per-slot overrides.
6. Add persistence using `.milonga.m3u8` import/export, with local storage only for autosave and draft recovery.
7. Add plan editing controls: create tanda, insert cortina slot, assign cortina track manually, switch cortina slot back to automatic, reorder slots, remove slot, duplicate tanda, and lock completed tandas.
8. Implement drag-and-drop planning: drag candidate tracks into tanda slots, drag tracks into the active cortina set, manually assign cortinas by dropping onto cortina slots, and reorder tandas, tracks, and cortina slots without accidental playback.
9. Improve candidate-track search using existing media sources plus filters for genre/style, orchestra/artist, singer, year range, BPM, duration, favorites, and source.
10. Add metadata normalization for Tango-specific fields, starting with configurable mappings from existing tags such as artist, album artist, genre, grouping, year, and BPM.
11. Add tanda-style detection that infers `tango`, `vals`, or `milonga` from normalized metadata where possible, with manual override.
12. Connect the Milonga Plan to automatic playback with a deliberate "play from plan" command that advances through slots in order and handles cortina randomization and filters.
13. Add runtime time-cut planning for playback mode: calculate expected finish time, compare it to a target end time, reduce unplayed cortina durations down to a configured minimum, and optionally drop unplayed tandas according to an explicit DJ-approved policy.
14. Add a playback view optimized for live use: current tanda, tanda track counter, tanda style, current/next information, remaining track/tanda/Milonga time, astronomical finish time, pause/fade/cut controls, and missing-file warnings.
15. Add tests for plan validation, serialization, M3U8 import/export, cortina randomization, filter calculation, style detection, time-cut planning, drag-and-drop moves, reordering, and playback sequencing.
16. Document the Milonga workflow in `docs/user-manual` after the first usable slice is implemented.

## Milestones

### M1: Reliable Manual Planning

- Existing Milonga screen is organized as Creation mode.
- Structured plan model exists.
- Tandas and cortinas can be created, edited, reordered, and persisted locally.
- Cortina library sets and default cortina filter settings can be edited.
- Existing candidate selector can add tracks into explicit slots.
- Drag-and-drop works for adding tracks, moving tracks between slots, adding tracks to the active cortina set, assigning cortinas manually, and reordering unplayed plan sections.
- `.milonga.m3u8` export/import works for the structured plan.

### M2: Playback Integration

- The DJ can start playback from a selected slot.
- Playback advances through the plan automatically and predictably.
- Automatic cortina slots choose from the active cortina set and apply the default cortina filter.
- Manual cortina slots play the assigned track at that position.
- The UI distinguishes planned playback from normal queue playback.
- Playback mode shows current tanda, track counter, style, remaining Milonga time, and expected astronomical finish time.

### M3: Tango DJ Metadata

- Filters and columns expose Tango-relevant metadata.
- Tanda style is detected automatically where metadata allows and can be corrected manually.
- Missing or weak metadata is visible during planning.
- Plan validation catches duplicate tracks, empty slots, missing files, and unusual tanda lengths.

### M4: Live Milonga Readiness

- Playback view is usable from a distance.
- Target-end-time cuts can be previewed and applied during playback without modifying the saved plan.
- Export/import supports backup before an event.
- Documentation covers preparation, live operation, and recovery scenarios.

## Consequences

The Milonga feature will have its own domain model instead of overloading the queue. This adds code, but keeps live-DJ behavior explicit and testable. Cortinas remain normal tracks at the library layer, which avoids duplicating track metadata and file handling. M3U8 export keeps basic interoperability, while custom Milonga directives make the format specific enough for this workflow. Existing queue and player APIs may need small extensions for automatic plan playback, previewing tracks, applying temporary fade/duration filters, calculating time cuts, and disabling random behavior while a Milonga Plan is active.

## Open Questions

- Should cortina randomization avoid repeats until the full cortina pool has been used?
- Should cortina sets be global settings, stored per plan, or both?
- Should Tango style be stored as a normalized enum (`tango`, `vals`, `milonga`, `alternative`) or as free-form tags?
- Should target-end-time cutting default to shortening cortinas first, dropping tandas first, or always asking the DJ?
- What is the minimum allowed cortina duration during automatic time cuts?
