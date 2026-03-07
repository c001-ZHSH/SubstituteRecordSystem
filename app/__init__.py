from flask import Flask
from .models import db
import os
import sys
import traceback

def create_app():
    # Detect if we are running from a PyInstaller executable
    if getattr(sys, 'frozen', False):
        bundle_dir = sys._MEIPASS
        template_dir = os.path.join(bundle_dir, 'app', 'templates')
        static_dir = os.path.join(bundle_dir, 'app', 'static')
        app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
        basedir = os.path.dirname(sys.executable)
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

    return app
