# MSD Decoder

Open `index.html` in a browser. Paste hexadecimal UPER data and select **Decode message**, or use **Load example**. Spaces and line breaks are accepted; bytes beyond the encoded message length are ignored. Open `tests.html` to run the included regression checks.

The decoder supports version 2 and version 3 root fields and displays optional additional data as a relative OID and raw bytes. Version 1 and ASN.1 extensions are not supported and are rejected. Version 2 recent locations are optional; N-2 cannot be calculated without N-1. This prototype is not a certified decoder and must not be used for emergency response without independent conformance and safety validation.

Decoding happens locally in the browser and Leaflet is included locally. OpenStreetMap tiles are loaded over the internet; tile requests disclose the approximate viewed location and the user's IP address to the tile provider. Fonts are also loaded externally. The OpenStreetMap link can be used if the map is unavailable.