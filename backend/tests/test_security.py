"""
Password hashing and access tokens.

The bcrypt pin matters here: passlib 1.7.4's bcrypt backend fails its self-test
against bcrypt 5.x, which breaks hashing outright rather than degrading. If this
file starts failing after a dependency bump, check bcrypt's version first.
"""
import pytest

from app.core import security


def test_hash_is_not_the_password_and_is_salted():
    a = security.hash_password("correct horse")
    b = security.hash_password("correct horse")
    assert "correct horse" not in a
    assert a != b, "identical passwords must not produce identical hashes"


def test_verify_accepts_the_right_password_and_rejects_others():
    hashed = security.hash_password("s3cret-password")
    assert security.verify_password("s3cret-password", hashed)
    assert not security.verify_password("s3cret-passwore", hashed)
    assert not security.verify_password("", hashed)


def test_overlong_password_is_rejected_not_silently_truncated():
    """bcrypt only reads 72 bytes; accepting more would ignore the tail."""
    with pytest.raises(ValueError):
        security.hash_password("x" * 73)


def test_verify_rejects_overlong_input():
    hashed = security.hash_password("x" * 72)
    assert not security.verify_password("x" * 73, hashed)


def test_verify_survives_a_corrupt_stored_hash():
    """A bad row is a failed login, not a 500 that leaks which rows are bad."""
    assert not security.verify_password("anything", "not-a-bcrypt-hash")
    assert not security.verify_password("anything", "")


def test_token_round_trips_subject_and_role():
    claims = security.decode_access_token(security.create_access_token("user-1", "employer"))
    assert claims["sub"] == "user-1"
    assert claims["role"] == "employer"


def test_expired_token_is_rejected():
    stale = security.create_access_token("user-1", "candidate", expires_minutes=-1)
    with pytest.raises(ValueError):
        security.decode_access_token(stale)


def test_tampered_token_is_rejected():
    token = security.create_access_token("user-1", "candidate")
    head, payload, sig = token.split(".")
    forged = f"{head}.{payload}.{sig[:-4]}AAAA"
    with pytest.raises(ValueError):
        security.decode_access_token(forged)


def test_token_signed_with_another_secret_is_rejected(monkeypatch):
    token = security.create_access_token("user-1", "candidate")
    monkeypatch.setattr(security.settings, "jwt_secret", "a-different-secret")
    with pytest.raises(ValueError):
        security.decode_access_token(token)


def test_unsigned_token_is_rejected():
    """alg=none must never be honoured."""
    import base64, json

    def seg(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

    forged = f'{seg({"alg": "none", "typ": "JWT"})}.{seg({"sub": "admin"})}.'
    with pytest.raises(ValueError):
        security.decode_access_token(forged)


def test_garbage_is_rejected():
    for junk in ["", "not.a.token", "Bearer abc"]:
        with pytest.raises(ValueError):
            security.decode_access_token(junk)
