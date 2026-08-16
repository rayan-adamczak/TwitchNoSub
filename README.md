# TwitchNoSub

> **Fork note.** Upstream stopped working on Chrome. This branch fixes it. Three things were broken:
>
> 1. The worker patch was fetched from the jsdelivr CDN at runtime. It is now bundled and inlined into the worker blob ([PR #232](https://github.com/besuper/TwitchNoSub/pull/232) covers this part).
> 2. Twitch marks every quality of a sub-only VOD as restricted in the playback token, and gates the video on `resourceRestriction`. The player rendered the subscribe screen and never called usher, so the worker patch had nothing to intercept. Both are now cleared client-side — subscription gating only, geo blocks and takedowns are left alone and logged.
> 3. The worker wrapper kept a `besuper/` marker so [TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions) still recognises it. Without it, vaft logs `Attempt to set twitch worker denied` and silently disables this extension. Preserve that string in any refactor of `src/app.js`.
>
> Install from this branch, not from master.

Be able to watch any sub-only vod on Twitch, integrated in the website and support every twitch features.

Support chromium based browser (Chrome, Edge, Brave, Opera, ...) and Firefox.

## Download & installation

##### Chromium based browser
Download the latest release in the [releases section](https://github.com/besuper/TwitchNoSub/releases) or clone the repo.

You have to install the extension manually:

- Go in manage extension (**chrome://extensions/** in chrome)
- Make sure **Developer mode** is enabled
- Hit **Load unpacked extension** and select the unzipped folder of the extension.

If you use Chromium (not Chrome), you can pack the extension to get a .crx file you can drag & drop inside extensions page (which removes the need to have a dedicated directory for the extension on your hard drive)

- Unzip the extension
- In the parent directory of the extension, run the following command : `chromium --pack-extension=TwitchNoSub`
- Drop the created crx file in the extensions page of your browser (make sure **Developer mode** is enabled, however it will not work)

##### Firefox
Download the latest .**xpi** file in the [releases section](https://github.com/besuper/TwitchNoSub/releases).

- Drag and drop the xpi file on Firefox
- Click on "Add" in the little confirmation popup

## Warning

This extension is still in work in progress, if there is any issue please report it.
