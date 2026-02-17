from celery import shared_task
from app.db.session import SessionLocal  # Твоя синхронна сесія для Celery
from app.models.worker import ImageModel
from app.core.utils import capture_desktop_screenshot


@shared_task(name="take_worker_screenshot")
def take_worker_screenshot(worker_id: int, container_id: str):
    db = SessionLocal()
    try:
        s3_url = capture_desktop_screenshot(container_id, worker_id)

        new_image = ImageModel(worker_id=worker_id, s3_url=s3_url)
        db.add(new_image)
        db.commit()

        return {"status": "success", "s3_url": s3_url}
    except Exception as e:
        print(f"Screenshot error: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()