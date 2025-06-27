const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch").default; // Use .default for ESM compatibility in CommonJS
require('dotenv').config();
const { XMLParser } = require("fast-xml-parser");
const http = require("http");

// Validate environment variables
const IPTV_USERNAME = process.env.IPTV_USER;
const IPTV_PASSWORD = process.env.IPTV_PASS;
const IPTV_SERVER = process.env.IPTV_SERVER;
const EPG_URL = process.env.EPG_URL; // Optional: XMLTV URL

if (!IPTV_USERNAME || !IPTV_PASSWORD || !IPTV_SERVER) {
    throw new Error("Missing required environment variables: IPTV_USER, IPTV_PASS, or IPTV_SERVER");
}

const manifest = {
    id: "org.iptv.custom",
    version: "1.1.0",
    name: "HushPlusTv",
    description: "Streams live TV and VOD from your IPTV provider, with optional EPG support",
    catalogs: [{ type: "tv", id: "iptv_live", name: "Live IPTV" }],
    resources: ["catalog", "stream", "meta"],
    types: ["tv"],
    idPrefixes: ["iptv"],
};

const builder = new addonBuilder(manifest);

let epgMap = {};

async function loadEPG() {
    if (!EPG_URL) {
        console.warn("EPG_URL not provided; skipping EPG loading");
        return;
    }
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        console.log(`Loading EPG at ${now.toISOString()}`);
        const res = await fetch(EPG_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        // Stream the XML response
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const xml = await res.text();
        const result = parser.parse(xml);
        
        epgMap = {}; // Clear previous EPG data
        const programs = result.tv?.programme || [];
        for (const prog of programs) {
            const channelId = prog["@_channel"];
            if (!channelId) continue;
            if (!epgMap[channelId]) epgMap[channelId] = []; // Initialize array for channel
            const start = new Date(prog["@_start"] || 'Invalid Date');
            const stop = new Date(prog["@_stop"] || 'Invalid Date');
            // Only include programs within the next 24 hours, up to 10 per channel
            if (start >= now && start <= tomorrow && epgMap[channelId].length < 10) {
                epgMap[channelId].push({
                    title: prog.title?._ || 'Unknown',
                    start,
                    stop
                });
            }
        }
        console.log(`EPG loaded: ${Object.keys(epgMap).length} channels, ${Object.values(epgMap).reduce((sum, arr) => sum + arr.length, 0)} programs`);
    } catch (err) {
        console.error("Failed to load EPG:", err.message);
    }
}

// Load EPG on startup and refresh every 24 hours
loadEPG();
setInterval(loadEPG, 24 * 60 * 60 * 1000);

builder.defineCatalogHandler(async () => {
    try {
        const url = `${IPTV_SERVER}/player_api.php?username=${IPTV_USERNAME}&password=${IPTV_PASSWORD}&action=get_live_streams`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid response format from IPTV server");
        const metas = data.map((channel) => ({
            id: `iptv_${channel.stream_id}`,
            type: "tv",
            name: channel.name || "Unknown Channel",
            poster: channel.stream_icon || null,
        }));
        return { metas };
    } catch (err) {
        console.error("Catalog error:", err.message);
        return { metas: [] };
    }
});

builder.defineStreamHandler(async ({ id }) => {
    try {
        const streamId = id.replace("iptv_", "");
        if (!streamId) throw new Error("Invalid stream ID");
        const streamUrl = `${IPTV_SERVER}/live/${IPTV_USERNAME}/${IPTV_PASSWORD}/${streamId}.ts`;
        return {
            streams: [{ title: "IPTV Stream", url: streamUrl }],
        };
    } catch (err) {
        console.error("Stream error:", err.message);
        return { streams: [] };
    }
});

builder.defineMetaHandler(async ({ id }) => {
    try {
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
                return now >= e.start && now <= e.stop && !isNaN(e.start) && !isNaN(e.stop);
            });
            if (show) {
                meta.description = `Now Playing: ${show.title}`;
            }
        }
        return { meta };
    } catch (err) {
        console.error("Meta error:", err.message);
        return { meta: { id, type: "tv", name: "IPTV Channel" } };
    }
});

// Create HTTP server and set port to 10000
const PORT = process.env.PORT || 10000;
const server = http.createServer(builder.getInterface().middleware);
server.listen(PORT, () => {
    console.log(`Add-on server running on port ${PORT}`);
});
