"""Serve the game and PWA files with consistent MIME types for local testing."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class PreviewHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".webp": "image/webp",
        ".ogg": "audio/ogg",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1", help="IPv4 address of the preview interface")
    parser.add_argument("--port", default=8787, type=int, help="HTTP port (default: 8787)")
    options = parser.parse_args()
    game = Path(__file__).resolve().parents[1] / "game"
    handler = partial(PreviewHandler, directory=str(game))
    with ThreadingHTTPServer((options.bind, options.port), handler) as server:
        url = f"http://{options.bind}:{server.server_port}/"
        print(f"Game: {url}\nObserve: {url}#observe-walk\nCheckout: {url}#shelf-walk", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
