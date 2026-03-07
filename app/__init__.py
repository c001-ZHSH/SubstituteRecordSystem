from flask import Flask
from .models import db
import os
import sys

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

    # Import and register blueprints
    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app
