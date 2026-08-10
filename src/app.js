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

const oldFetch = window.fetch;

async function readRequestBody(input, init) {
    if (init && typeof init.body === "string") {
        return init.body;
    }

    if (input instanceof Request) {
        try {
            return await input.clone().text();
        } catch (e) {
            return "";
        }
    }

    return "";
}

window.fetch = async function (input, init) {
    const url = input instanceof Request ? input.url : String(input);

    if (!url.includes("gql.twitch.tv/gql")) {
        return oldFetch(input, init);
    }

    const body = await readRequestBody(input, init);
    const response = await oldFetch(input, init);

    if (!body.includes("PlaybackAccessToken")) {
        return response;
    }

    try {
        const payload = await response.clone().json();
        const entries = Array.isArray(payload) ? payload : [payload];

        if (!entries.map(clearRestrictedBitrates).some(Boolean)) {
            return response;
        }

        return new Response(JSON.stringify(payload), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    } catch (e) {
        console.log("[TNS] Unable to patch the playback token", e);

        return response;
    }
}

const oldWorker = window.Worker;

window.Worker = class Worker extends oldWorker {
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
