const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
require('dotenv').config();
const xml2js = require("xml2js");

const IPTV_USERNAME = process.env.IPTV_USER;
const IPTV_PASSWORD = process.env.IPTV_PASS;
const IPTV_SERVER = process.env.IPTV_SERVER;
const EPG_URL = process.env.EPG_URL; // Optional: XMLTV URL

const manifest = {
    id: "org.iptv.custom",
    version: "1.1.0",
    name: "My IPTV Addon with EPG",
    description: "Streams live TV and VOD from your IPTV provider, with optional EPG support",
    catalogs: [{ type: "tv", id: "iptv_live", name: "Live IPTV" }],
    resources: ["catalog", "stream", "meta"],
    types: ["tv"],
    idPrefixes: ["iptv"],
};

const builder = new addonBuilder(manifest);

let epgMap = {};

async function loadEPG() {
    if (!EPG_URL) return;
    try {
        const res = await fetch(EPG_URL);
        const xml = await res.text();
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xml);
        for (const prog of result.tv.programme || []) {
            const channelId = prog['$'].channel;
            if (!epgMap[channelId]) epgMap[channelId] = [];
            epgMap[channelId].push({
                title: prog.title?.[0]?._ || '',
                start: prog['$'].start,
                stop: prog['$'].stop,
            });
        }
    } catch (err) {
        console.error("Failed to load EPG:", err.message);
    }
}

builder.defineCatalogHandler(async () => {
    const url = {IPTV_SERVER}/player_api.php?username=\{IPTV_USERNAME}&password=\{IPTV_PASSWORD}&action=get_live_streams\`;
    const res = await fetch(url);
    const data = await res.json();

    const metas = data.map((channel) => ({
        id: \`iptv_\${channel.stream_id}\`,
        type: "tv",
        name: channel.name,
        poster: channel.stream_icon || null,
    }));

    return { metas };
});

builder.defineStreamHandler(async ({ id }) => {
    const streamId = id.replace("iptv_", "");
    const streamUrl = \`\${IPTV_SERVER}/live/\${IPTV_USERNAME}/\${IPTV_PASSWORD}/\${streamId}.ts\`;

    return {
        streams: [{ title: "IPTV Stream", url: streamUrl }],
    };
});

builder.defineMetaHandler(async ({ id }) => {
    const streamId = id.replace("iptv_", "");
    const meta = {
        id,
        type: "tv",
        name: "IPTV Channel",
    };

    const epg = epgMap[streamId];
    if (epg && epg.length) {
        const now = new Date();
        const show = epg.find(e => {
            const start = new Date(e.start.substring(0, 14));
            const stop = new Date(e.stop.substring(0, 14));
            return now >= start && now <= stop;
        });
        if (show) {
            meta.description = \`Now Playing: \${show.title}\`;
        }
    }

    return { meta };
});

// Load EPG on startup
loadEPG();

module.exports = builder.getInterface();
