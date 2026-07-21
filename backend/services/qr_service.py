"""
QR chain-of-custody.

Each pickup request carries an unguessable token. The generator shows it as a QR
at handover; the collector scans it to mark the waste collected. Because only the
generator's screen shows the code, a scan is evidence the collector was actually
there - which is the point of the tracking system.
"""
import io
import secrets
from typing import Optional

import qrcode
import qrcode.image.svg
from sqlalchemy.orm import Session

from backend import models

TOKEN_BYTES = 16


def generate_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def find_by_token(db: Session, token: str) -> Optional[models.WasteListing]:
    if not token:
        return None
    return db.query(models.WasteListing).filter(models.WasteListing.qr_token == token.strip()).first()


def render_svg(payload: str) -> str:
    """Renders the payload as a standalone SVG string, safe to inline in HTML."""
    qr = qrcode.QRCode(
        version=None,  # let the library pick the smallest version that fits
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    image = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
    buffer = io.BytesIO()
    image.save(buffer)
    return buffer.getvalue().decode("utf-8")
