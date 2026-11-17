"""Serve Tijian on the local Wi-Fi for iPhone and desktop browsers."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket


class AppHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def local_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
            connection.connect(('192.0.2.1', 80))
            return connection.getsockname()[0]
    except OSError:
        return socket.gethostbyname(socket.gethostname())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='题间 · 手机局域网访问')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    server = ThreadingHTTPServer(('0.0.0.0', args.port), partial(AppHandler, directory=str(root)))
    print(f'电脑访问：http://localhost:{args.port}/', flush=True)
    print(f'iPhone 连接同一 Wi-Fi 后用 Safari 打开：http://{local_address()}:{args.port}/', flush=True)
    print('保持此窗口和电脑开启；按 Control+C 停止。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
