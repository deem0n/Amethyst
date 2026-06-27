# Milonga Branch Change Notes

This document tracks fork-specific changes on the `milonga` branch so future merges from upstream Amethyst can be reviewed quickly. Keep this file current when adding Milonga behavior.

## Scope

The branch adapts Amethyst into a Tango DJ planning/playback tool. The current implementation is still a creation-mode prototype, not the final domain model from ADR 0001.

## Planning Documents

- `AGENTS.md`: contributor guide for this repository.
- `docs/adr/0001-milonga-dj-mode.md`: product and architecture direction for Milonga creation/playback, cortina slots, `.milonga.m3u8`, drag-and-drop planning, and live playback.
- `docs/adr/0002-dependency-install-warning-remediation.md`: install/build maintenance notes, including removing global `electron-builder` install behavior and future Node.js upgrade work.

## Dependency And Build Changes

- `package.json`: removed the `preinstall` script that globally installed `electron-builder`. This avoided stale/global dependency behavior and Node engine conflicts during local install.
- Current verified command: `yarn build:renderer`.
- Known existing warnings remain: Vite browser externalization for `stream`/`vm`, Rollup circular chunk warnings for node exports, and UnoCSS/CSS warnings around dynamic `ITEM_HEIGHT` classes.

## Milonga Settings

- `src/renderer/router.ts`: added `settings.milonga` route.
- `src/renderer/components/settings/SettingsNavigation.vue`: added a Milonga settings navigation item.
- `src/renderer/views/Settings/MilongaSettings.vue`: new Milonga settings screen.
- `src/renderer/views/Settings/BehaviourSettings.vue`: removed the Milonga toggle from generic behavior settings.
- `src/renderer/locales/en-US.json`: added Milonga settings and plan strings.

Merge note: upstream may change Settings routing/navigation often. Keep Milonga as a dedicated settings category rather than reintroducing it into Behavior.

## Milonga Creation Screen

- `src/renderer/views/MilongaView.vue`: converted the screen into a split workspace with the Milonga plan and track selector visible at the same time.
- Added a draggable workspace splitter. Size persists in `milongaWorkspacePlanPaneSize`.
- Added Milonga-local search wiring for the track selector.
- Added runtime state for tanda tracks and cortina slots.

Merge note: preserve the split-pane structure if upstream changes general route layout. The track selector should remain visible while planning.

## Track Selector Integration

- `src/renderer/components/TrackSelector.vue`: added optional `searchText` prop so Milonga can control search independently from the normal queue selector.
- Implemented actual filtering for Milonga candidate tracks by title, artist, album, and filename.
- Removed noisy per-track logging.

Merge note: if upstream replaces `TrackSelector`, keep the ability to pass external columns and external search text for Milonga.

## Tanda Layout

- `src/renderer/components/MilongaPlan.vue`: changed tanda display from vertical lists to row-based tanda cards with up to four track slots.
- Track cards now show cover art, duration overlay, title under image, and artist.
- Empty tanda slots accept dropped tracks.
- Current playing track receives a visible highlight.

Merge note: this component is fork-specific and can be moved toward the ADR domain model later. Avoid mixing it with normal queue UI unless upstream introduces reusable card primitives.

## Cortina Slots

- `src/renderer/components/MilongaPlan.vue`: cortina separators are now real slots between tandas.
- Cortina slot modes:
  - `automatic`: placeholder for future pool-based selection.
  - `manual`: DJ-assigned normal track.
- Dropping a track onto a cortina slot assigns it manually.
- Manual cortinas show cover/title/duration and can be reset to automatic.

Current limitation: automatic cortina pool selection is documented but not implemented yet.

## Milonga Playback Prototype

- `src/renderer/views/MilongaView.vue`: clicking a tanda track builds a Milonga playback sequence from that point forward.
- Playback advances through remaining tanda tracks.
- Manual cortinas between tandas are included in the sequence.
- Clicking a manual cortina starts playback at that cortina, then continues into following tandas.
- Playback highlight follows `player:trackChange`, clears on pause/stop, and stops owning playback if another track is started outside the Milonga sequence.

## Player Hook

- `src/renderer/logic/player.ts`: added `setTrackFinishedInterceptor`.
- The hook lets Milonga playback consume track-end events and advance through its own plan instead of falling through to the normal queue.

Merge note: this is the only current general-player change. If upstream changes player lifecycle, preserve a narrow extension point for plan-driven playback. Long term, replace this with a formal playback-source/session API.

## Local Storage Keys

- `milongaTrackSelectorFilterText`
- `milongaTrackSelectorMediaSource`
- `milongaTrackSelectorColumns`
- `milongaWorkspacePlanPaneSize`

## Merge Checklist

1. Merge upstream first and inspect conflicts in `player.ts`, `router.ts`, settings navigation, and `TrackSelector.vue`.
2. Confirm `package.json` does not reintroduce global install side effects.
3. Run `yarn install` if dependencies changed.
4. Run `yarn build:renderer`.
5. Start the app in dev mode and verify:
   - Milonga screen opens.
   - Plan and track selector are both visible.
   - Splitter resizes panes.
   - Tracks can be dropped into tanda slots.
   - Tracks can be dropped into cortina slots.
   - Clicking a tanda track advances to the next tanda track.
   - Manual cortina plays between tandas.
   - Currently playing Milonga item is highlighted.
