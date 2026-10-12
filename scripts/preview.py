from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path

directory = Path(__file__).resolve().parent.parent / "public"
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
with ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", "4173"))), handler) as server:
    print(f"Dotcom preview listening on {server.server_address}", flush=True)
    server.serve_forever()
