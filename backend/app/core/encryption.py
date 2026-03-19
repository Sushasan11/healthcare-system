import base64
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import String
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class EncryptedString(TypeDecorator):
    """AES-256-GCM encrypted string type for PHI columns.

    Encrypts on write, decrypts on read. The PHI_ENCRYPTION_KEY env var
    must be a 64-char hex string (32 bytes). Supports comma-separated keys
    for rotation — first key encrypts, all keys are attempted for decryption.
    """

    impl = String
    cache_ok = True

    def _get_keys(self) -> list[bytes]:
        """Load encryption keys from environment. First key is current."""
        key_hex = os.environ.get("PHI_ENCRYPTION_KEY", "0" * 64)
        keys = []
        for part in key_hex.split(","):
            part = part.strip()
            if len(part) == 64:
                keys.append(bytes.fromhex(part))
            else:
                raise ValueError(
                    f"PHI_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Got {len(part)} chars."
                )
        return keys

    def process_bind_param(self, value: Any, dialect: Dialect) -> str | None:
        """Encrypt value before storing in database."""
        if value is None:
            return None
        keys = self._get_keys()
        aesgcm = AESGCM(keys[0])
        nonce = os.urandom(12)  # 96-bit nonce for AES-256-GCM
        ciphertext = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
        # Store as base64(nonce + ciphertext)
        return base64.b64encode(nonce + ciphertext).decode("ascii")

    def process_result_value(self, value: Any, dialect: Dialect) -> str | None:
        """Decrypt value after reading from database."""
        if value is None:
            return None
        raw = base64.b64decode(value.encode("ascii"))
        nonce = raw[:12]
        ciphertext = raw[12:]
        keys = self._get_keys()
        # Try each key (rotation support)
        for key in keys:
            try:
                aesgcm = AESGCM(key)
                plaintext = aesgcm.decrypt(nonce, ciphertext, None)
                return plaintext.decode("utf-8")
            except Exception:
                continue
        raise ValueError("Failed to decrypt PHI field — no valid key found.")
