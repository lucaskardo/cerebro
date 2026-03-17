"""
CEREBRO — Credential Encryption
Fernet symmetric encryption (AES-128-CBC + HMAC-SHA256).
ENCRYPTION_KEY must be a valid Fernet key (32 url-safe base64 bytes).
Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
import base64
import os
from cryptography.fernet import Fernet, InvalidToken
from packages.core import get_logger

logger = get_logger("crypto")

# Dev-only fallback key — NOT for production
_DEV_KEY = b"WkdGclpXdGxlV1p2Y21SbGRtVmxiVEJsYm5seWIzQXdibXh4WUdBPQ=="[:44]


def _get_fernet() -> Fernet:
    raw = os.getenv("ENCRYPTION_KEY", "")
    if not raw:
        logger.warning("ENCRYPTION_KEY not set — using insecure dev key. Set it in .env for production.")
        # Use a hardcoded valid Fernet key for dev
        return Fernet(b"ZmFrZWtleWZvcmRldl9vbmx5X3BhZGRpbmdfMDAwMA==")
    try:
        return Fernet(raw.encode() if isinstance(raw, str) else raw)
    except Exception:
        # Derive a valid 32-byte key from whatever string was provided
        import hashlib
        key_bytes = hashlib.sha256(raw.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(key_bytes)
        return Fernet(fernet_key)


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns ciphertext safe for DB storage."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a previously encrypted string. Raises ValueError on failure."""
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise ValueError("Decryption failed — invalid key or corrupted ciphertext")
