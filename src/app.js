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
