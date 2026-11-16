import os
import logging
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta

_DEFAULT_SECRET = "your-secret-key-change-in-production"
SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or _DEFAULT_SECRET
if SECRET_KEY == _DEFAULT_SECRET:
    # Uygulamayı durdurmuyoruz (canlı sistem kapanmasın) ama loglarda net görünsün.
    logging.getLogger(__name__).warning(
        "GÜVENLİK UYARISI: JWT_SECRET_KEY tanımlı değil, herkesin bildiği varsayılan anahtar kullanılıyor. "
        "Cloud Run ortam değişkenlerine uzun ve rastgele bir JWT_SECRET_KEY ekleyin."
    )
ALGORITHM = "HS256"


def norm_email(e: str) -> str:
    return (e or "").strip().lower()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a bcrypt hash"""
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
