const PATCH_NODE_ID = "tns-patch-source";
const patchUrl = chrome.runtime.getURL("src/patch_amazonworker.js");

function injectScript(src) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    s.onload = () => s.remove();
    (document.head || document.documentElement).append(s);
}

// The page cannot read extension files itself, so the content script hands the
// patch over through an inert node app.js reads when it builds the worker blob.
async function injectPatchSource() {
    try {
        const source = await fetch(patchUrl).then(r => r.text());

        const node = document.createElement('script');
        node.type = "text/plain";
        node.id = PATCH_NODE_ID;
        node.textContent = source;

        (document.head || document.documentElement).append(node);
    } catch (e) {
        console.log("[TNS] Unable to inject the patch source", e);
    }
}

localStorage.setItem("tns_internal_patch_url", patchUrl);

injectPatchSource();
injectScript("src/app.js");
