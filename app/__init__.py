from flask import Flask
from .models import db
import os
import sys
import traceback

def create_app():
    # Detect if we are running from a PyInstaller executable
    if getattr(sys, 'frozen', False):
        basedir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        app = Flask(__name__, template_folder='app/templates', static_folder='app/static', static_url_path='/static', root_path=basedir)
        db_path = os.path.join(os.path.dirname(sys.executable), 'database.db')
    else:
        app = Flask(__name__, template_folder='templates', static_folder='static')
        basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        db_path = os.path.join(basedir, 'database.db')

    # Windows path safety for SQLAlchemy (replaces \ with /)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path.replace('\\', '/')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    with app.app_context():
        db.create_all()

    # Configure Flask logging to write to error.log
    import logging
    from logging.handlers import RotatingFileHandler
    
    if getattr(sys, 'frozen', False):
        log_dir = os.path.dirname(sys.executable)
    else:
        log_dir = os.path.dirname(basedir)
        
    log_file = os.path.join(log_dir, 'error.log')
    file_handler = RotatingFileHandler(log_file, maxBytes=10240, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('SubstituteRecordSystem startup')

    # Catch all unhandled exceptions
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.error(f"Unhandled Exception: {str(e)}")
        app.logger.error(traceback.format_exc())
        return "Internal Server Error. Please check error.log", 500

    # Import and register blueprints
    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    # Start the heartbeat monitor if running as a packaged executable
    if getattr(sys, 'frozen', False):
        import threading
        import time
        from . import routes
        
        def monitor_heartbeat():
            # Wait 60 seconds to allow the browser to initially open
            time.sleep(60) 
            while True:
                time.sleep(3)
                if getattr(routes, 'HEARTBEAT_ACTIVE', False):
                    # If we have an active connection but it went silent for 5 seconds
                    if time.time() - getattr(routes, 'LAST_HEARTBEAT', time.time()) > 5:
                        app.logger.info("Heartbeat lost. Shutting down system.")
                        os._exit(0)
                else:
                    # If the heartbeat never activated within 120 seconds of launching, assume failure and shut down
                    if time.time() - getattr(routes, 'LAST_HEARTBEAT', time.time()) > 120:
                        app.logger.info("Heartbeat never established. Shutting down system.")
                        os._exit(0)
                        
        threading.Thread(target=monitor_heartbeat, daemon=True).start()

    return app
