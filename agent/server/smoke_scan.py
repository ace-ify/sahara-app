"""Live smoke: POST a real image to /api/scan_prescription, expect medicines.

Creates a tiny PNG with PIL-style hand-rolled bytes (no PIL dependency):
a 400x60 white image is enough to prove the image is *sent* — the model
should honestly return zero medicines rather than fabricated ones.
"""
import base64
import io
import struct
import zlib


def make_png() -> bytes:
    w, h = 400, 60
    rows = b"\x00" + b"\xff" * (w * 3)  # filter byte + white RGB row
    raw = rows * h

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

client = TestClient(server.app)

b64 = base64.b64encode(make_png()).decode()
res = client.post("/api/scan_prescription", json={"image_base64": b64})
print("blank image ->", res.status_code, res.json())

res = client.post(
    "/api/scan_prescription",
    json={"text": "Rx: Amlodipine 5mg once daily morning; Metformin 500mg twice daily after meals"},
)
print("text-only   ->", res.status_code, res.json())
