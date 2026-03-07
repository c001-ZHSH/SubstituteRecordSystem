from app import create_app
import webbrowser
import threading
import sys

app = create_app()

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Add a short delay to let the Flask server boot up
    threading.Timer(1.25, open_browser).start()
    
    # Disable debug mode when frozen (bundled) to avoid thread duplication
    is_debug = not getattr(sys, 'frozen', False)
    app.run(port=5000, debug=is_debug)
