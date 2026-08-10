const PATCH_NODE_ID = "tns-patch-source";

const patch_url = (() => {
    if (document.currentScript && document.currentScript.src) {
        return new URL("patch_amazonworker.js", document.currentScript.src).href;
    }

    return localStorage.getItem("tns_internal_patch_url");
})();

// From vaft script (https://github.com/pixeltris/TwitchAdSolutions/blob/master/vaft/vaft.user.js#L299)
function getWasmWorkerJs(twitchBlobUrl) {
    var req = new XMLHttpRequest();
    req.open('GET', twitchBlobUrl, false);
    req.overrideMimeType("text/javascript");
    req.send();
    return req.responseText;
}

// The patch must be inlined in the worker blob. importScripts() of an extension
// URL is subject to the worker CSP inherited from the page and gets blocked.
function getPatchSource() {
    const node = document.getElementById(PATCH_NODE_ID);

    if (node && node.textContent) {
        return node.textContent;
    }

    if (patch_url) {
        console.log("[TNS] Patch node missing, falling back to a direct read");

        try {
            return getWasmWorkerJs(patch_url);
        } catch (e) {
            console.log("[TNS] Unable to read the patch source", e);
        }
    }

    return null;
}

// Twitch marks every quality of a sub-only VOD as restricted in the playback
// token. The player reads that list, shows the subscribe gate and never calls
// usher, so the worker patch below never gets a request to intercept. Clearing
// the list lets the player carry on to usher, where the patch takes over.
function clearRestrictedBitrates(payload) {
    const token = payload?.data?.videoPlaybackAccessToken;

    if (!token || typeof token.value !== "string") {
        return false;
    }

    const value = JSON.parse(token.value);

    if (!value?.chansub?.restricted_bitrates?.length) {
        return false;
    }

    console.log(`[TNS] Clearing ${value.chansub.restricted_bitrates.length} restricted qualities`);

    value.chansub.restricted_bitrates = [];
    token.value = JSON.stringify(value);

    return true;
}

// The gate is also rendered straight from the video metadata, before the player
// ever asks for a token, so the restriction has to be cleared there as well.
// The field turns up under several operations, hence the blind walk.
const RESTRICTION_MARKERS = ["restricted_bitrates", "resourceRestriction", "isRestricted"];

function stripRestrictions(node, seen = new Set()) {
    if (!node || typeof node !== "object" || seen.has(node)) {
        return false;
    }

    seen.add(node);

    let changed = false;

    if (Array.isArray(node)) {
        for (const item of node) {
            changed = stripRestrictions(item, seen) || changed;
        }

        return changed;
    }

    for (const [key, value] of Object.entries(node)) {
        if (key === "resourceRestriction" && value !== null) {
            node[key] = null;
            changed = true;
            continue;
        }

        if (key === "isRestricted" && value === true) {
            node[key] = false;
            changed = true;
            continue;
        }

        changed = stripRestrictions(value, seen) || changed;
    }

    return changed;
}

const oldFetch = window.fetch;

window.fetch = async function (input, init) {
    const url = input instanceof Request ? input.url : String(input);

    if (!url.includes("gql.twitch.tv/gql")) {
        return oldFetch(input, init);
    }

    const response = await oldFetch(input, init);

    let text;

    try {
        text = await response.clone().text();
    } catch (e) {
        return response;
    }

    if (!RESTRICTION_MARKERS.some(marker => text.includes(marker))) {
        return response;
    }

    try {
        const payload = JSON.parse(text);
        const entries = Array.isArray(payload) ? payload : [payload];

        const changed = entries
            .map(entry => [clearRestrictedBitrates(entry), stripRestrictions(entry)].some(Boolean))
            .some(Boolean);

        if (!changed) {
            return response;
        }

        return new Response(JSON.stringify(payload), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    } catch (e) {
        console.log("[TNS] Unable to patch the GraphQL response", e);

        return response;
    }
}

const oldWorker = window.Worker;

window.Worker = class Worker extends oldWorker {
    // TwitchAdSolutions (vaft) walks the Worker prototype chain and drops any
    // wrapper whose source mentions twitch, unless it recognises it from one of
    // the markers in its workerStringReinsert list. "besuper/" is the marker for
    // this extension, so keep it in the source or vaft silently unpatches us.
    // https://github.com/pixeltris/TwitchAdSolutions besuper/TwitchNoSub
    constructor(twitchBlobUrl) {
        var workerString = getWasmWorkerJs(`${twitchBlobUrl.replaceAll("'", "%27")}`);

        const patchSource = getPatchSource();

        if (!patchSource) {
            console.log("[TNS] No patch source available, worker left unpatched");

            super(twitchBlobUrl);
            return;
        }

        const blobUrl = URL.createObjectURL(new Blob([`
            ${patchSource}
            ${workerString}
        `]));

        super(blobUrl);
    }
}
