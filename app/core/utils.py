import io
import time
import tarfile
from io import BytesIO
from PIL import Image
from fastapi import UploadFile, HTTPException, status

from app.worker.docker_service import docker_service
from app.core.s3 import s3_client


def process_avatar(file: UploadFile) -> bytes:
    """
    1. Validates the format.
    2. Cuts to a square.
    3. Resize to 256x256.
    4. Converts to WebP (light format).
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPEG, PNG, or WebP images are allowed",
        )

    try:
        image = Image.open(file.file)
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        width, height = image.size
        new_size = min(width, height)
        left = (width - new_size) / 2
        top = (height - new_size) / 2
        right = (width + new_size) / 2
        bottom = (height + new_size) / 2
        image = image.crop((left, top, right, bottom))

        image = image.resize((256, 256), Image.Resampling.LANCZOS)

        buffer = BytesIO()
        image.save(buffer, format="WEBP", quality=85, optimize=True)
        buffer.seek(0)

        return buffer.getvalue()

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image file"
        )


def capture_desktop_screenshot(container_id: str, worker_id: int) -> str:
    tmp_path = "/tmp/screen.png"
    # S3: results/worker_5/1700000000.png
    file_name = f"results/worker_{worker_id}/{int(time.time())}.png"

    docker_service.execute_command(container_id, f"scrot {tmp_path}", user="kasm-user")

    container = docker_service.client.containers.get(container_id)
    bits, stat = container.get_archive(tmp_path)

    file_obj = io.BytesIO(b"".join(b for b in bits))
    tar = tarfile.open(fileobj=file_obj)
    member = tar.getmember("screen.png")
    png_bytes = tar.extractfile(member).read()

    s3_url = s3_client.upload_bytes(png_bytes, file_name)

    docker_service.execute_command(container_id, f"rm {tmp_path}", user="kasm-user")

    return s3_url