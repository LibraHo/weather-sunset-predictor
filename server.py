#!/usr/bin/env python3
"""
自定义 HTTP 服务器，修复 JavaScript 模块的 MIME 类型问题
"""
import http.server
import socketserver
import mimetypes

# 强制设置正确的 MIME 类型
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('text/html', '.html')

PORT = 9002

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 禁用缓存
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def guess_type(self, path):
        """覆盖 guess_type 方法以确保正确的 MIME 类型"""
        # 强制修正 .js 文件的 MIME 类型
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.html'):
            return 'text/html'
        
        # 使用父类的方法
        return super().guess_type(path)

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print(f"服务器运行在 http://localhost:{PORT}")
    print("按 Ctrl+C 停止服务器")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
