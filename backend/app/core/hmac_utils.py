import hmac
import hashlib
import os


def compute_prescription_hmac(
    doctor_id: int,
    patient_id: int,
    consultation_id: int,
    diagnosis_plaintext: str,
    items: list[dict],
    issued_at_iso: str,
) -> str:
    items_str = "|".join(
        f"{i['medicine_name']}:{i['dosage_amount']}{i['dosage_unit']}:{i['frequency']}:{i['duration']}"
        for i in sorted(items, key=lambda x: x["medicine_name"])
    )
    message = f"{doctor_id}:{patient_id}:{consultation_id}:{diagnosis_plaintext}:{items_str}:{issued_at_iso}"
    key = os.environ.get("PRESCRIPTION_HMAC_KEY", "default-dev-key-change-in-prod").encode()
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_prescription_hmac(stored_hmac: str, **kwargs) -> bool:
    computed = compute_prescription_hmac(**kwargs)
    return hmac.compare_digest(stored_hmac, computed)
