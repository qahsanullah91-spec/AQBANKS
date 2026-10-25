# Version Bumping Guide — AQ Companies Portal

The update system compares the installed constant against a remote release
manifest. Both live in this repository:

| Artifact | Location | Purpose |
|---|---|---|
| Installed version constant | `frontend/src/constants/version.ts` (`APP_VERSION`) | What the running client reports as installed |
| Release manifest | `frontend/public/version.json` (served at `/version.json`) | What the update checker polls |

## Release procedure (starting from `AQ-SYS-V2.1-PRO`)

1. Finish and deploy your new build as usual (Vercel auto-deploys on push).
2. In `frontend/src/constants/version.ts`, bump the constant:
   ```ts
   export const APP_VERSION = 'AQ-SYS-V2.2-PRO';
   ```
3. In `frontend/public/version.json`, set the same version and prepend a
   changelog entry:
   ```json
   {
     "version": "AQ-SYS-V2.2-PRO",
     "buildNumber": 22,
     "releaseDate": "2026-11-02",
     "changelog": [
       {
         "version": "AQ-SYS-V2.2-PRO",
         "releaseDate": "2026-11-02",
         "type": "feature",
         "title": "New release title",
         "items": ["What changed", "…"]
       }
     ]
   }
   ```
4. Deploy. Every connected client detects the newer tag on its next launch or
   manual **Check for Updates**, shows the **Update Available** banner with the
   changelog, and its **Update & Reload Now** button clears service-worker /
   HTTP caches and hard-reloads into the new build.

## Versioning rules

- Tags follow `AQ-SYS-V<major>.<minor>-PRO` (e.g. `AQ-SYS-V2.2-PRO`,
  `AQ-SYS-V3.0-PRO`).
- Comparison extracts the numeric core, so `2.10 > 2.9` and `3.0 > 2.99` are
  handled correctly.
- Set `"minimumRequired": true` to mark an update as mandatory in the UI.
- The client also checks `/version.json` automatically on app launch and
  stores the last-checked timestamp in `localStorage` (`aq_last_update_check`).

## Remote manifests (optional)

`/version.json` is fetched relative to the deployment origin, so you can also
point clients at a version hosted anywhere on the same origin (e.g. a CDN path
rewritten to `/version.json`) without touching client code.
