# My IPTV Stremio Addon (with optional EPG)

This is a custom Stremio addon for streaming live TV from your IPTV provider using the Xtream Codes API, with optional EPG (XMLTV) support.

## Setup

1. Clone the repo or unzip the contents.
2. Run `npm install`.
3. Create a `.env` file with:

```
IPTV_USER=yourusername
IPTV_PASS=yourpassword
IPTV_SERVER=http://youriptvserver.com:8080
EPG_URL=https://yourepglink.com/epg.xml
```

> `EPG_URL` is optional. Leave it blank if you don't want to use EPG.

4. Start the addon:
```
npm start
```

5. Use the local manifest URL in Stremio: `http://localhost:7000/manifest.json`

## Features

- IPTV Live Channel Catalog
- Direct Stream Links
- Optional EPG (Now Playing in metadata)

