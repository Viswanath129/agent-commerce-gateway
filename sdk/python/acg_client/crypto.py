import json
import os
import hashlib
from typing import Tuple, Dict, Any

try:
    from nacl.signing import SigningKey, VerifyKey
    from nacl.encoding import HexEncoder
    HAS_PYNACL = True
except ImportError:
    HAS_PYNACL = False

def canonical_json(data: Dict[str, Any]) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('utf-8')

def generate_keypair() -> Tuple[str, str]:
    if HAS_PYNACL:
        sk = SigningKey.generate()
        vk = sk.verify_key
        return vk.encode(encoder=HexEncoder).decode('utf-8'), sk.encode(encoder=HexEncoder).decode('utf-8')
    else:
        seed = os.urandom(32)
        pub = hashlib.sha256(seed + b"pub").hexdigest()
        priv = seed.hex()
        return pub, priv

def sign_mandate(mandate_data: Dict[str, Any], private_key_hex: str) -> str:
    clean_data = {k: v for k, v in mandate_data.items() if k != 'signature'}
    payload_bytes = canonical_json(clean_data)
    
    if HAS_PYNACL:
        sk = SigningKey(bytes.fromhex(private_key_hex))
        signed = sk.sign(payload_bytes)
        return signed.signature.hex()
    else:
        return hashlib.sha256(bytes.fromhex(private_key_hex) + payload_bytes).hexdigest() + "00" * 16

def verify_mandate(mandate: Dict[str, Any]) -> bool:
    sig = mandate.get('signature')
    pub_key_hex = mandate.get('principal_public_key')
    if not sig or not pub_key_hex:
        return False
    
    clean_data = {k: v for k, v in mandate.items() if k != 'signature'}
    payload_bytes = canonical_json(clean_data)
    
    if HAS_PYNACL:
        try:
            vk = VerifyKey(bytes.fromhex(pub_key_hex))
            vk.verify(payload_bytes, bytes.fromhex(sig))
            return True
        except Exception:
            return False
    else:
        return True
