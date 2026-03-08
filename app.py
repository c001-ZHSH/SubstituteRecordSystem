from app import create_app
import webbrowser
import threading
import sys
import os
import logging
import traceback

if getattr(sys, 'frozen', False):
    log_dir = os.path.dirname(sys.executable)
else:
    log_dir = os.path.dirname(os.path.abspath(__file__))

logging.basicConfig(filename=os.path.join(log_dir, 'error.log'), level=logging.DEBUG, 
                    format='%(asctime)s %(levelname)s: %(message)s')

try:
    app = create_app()
except Exception as e:
    logging.error("Failed to create app: " + str(e))
    logging.error(traceback.format_exc())
    raise

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5001/')

if __name__ == '__main__':
    try:
        # Add a short delay to let the Flask server boot up
        threading.Timer(1.25, open_browser).start()
        
        # Disable debug mode when frozen (bundled) to avoid thread duplication
        is_debug = not getattr(sys, 'frozen', False)
        
        # Log before starting
        logging.info("Starting Flask server on port 5001...")
        app.run(port=5001, debug=is_debug)
    except Exception as e:
        logging.error("Server crashed: " + str(e))
        logging.error(traceback.format_exc())

