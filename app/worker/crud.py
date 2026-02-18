from datetime import datetime, timezone
from typing import Sequence

import docker
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.core.utils import capture_desktop_screenshot
from app.exceptions.worker import (
    WorkerLimitExceeded,
    WorkerNotFound,
    WorkerIsBusyError,
    WorkerOfflineError,
    WorkerNoContainerError,
    DockerOperationError,
    ContainerNotFoundError,
    TaskNotFound,
    TaskIsProcessingError,
)
from app.models import WorkerModel
from app.models.worker import (
    WorkerStatus,
    TaskModel,
    TaskStatus,
    ImageModel,
)
from app.schemas.worker import WorkerCreate, TaskCreate
from app.worker.docker_service import get_docker_service


# ── Worker CRUD ──────────────────────────────────────────────


async def create_worker(
    session: AsyncSession, worker_in: WorkerCreate, user_id: int
) -> WorkerModel:
    query = (
        select(func.count())
        .select_from(WorkerModel)
        .where(WorkerModel.user_id == user_id)
    )
    result = await session.execute(query)
    worker_count = result.scalar()

    if worker_count >= 3:
        raise WorkerLimitExceeded("Maximum number of workers reached.")

    data = worker_in.model_dump()
    new_worker = WorkerModel(**data, user_id=user_id)

    session.add(new_worker)
    await session.commit()
    await session.refresh(new_worker)

    return new_worker


async def get_worker(
    session: AsyncSession, worker_id: int, user_id: int
) -> WorkerModel:
    query = (
        select(WorkerModel)
        .options(selectinload(WorkerModel.tasks))
        .where(WorkerModel.id == worker_id, WorkerModel.user_id == user_id)
    )
    result = await session.execute(query)
    worker = result.scalars().first()

    if not worker:
        raise WorkerNotFound("Worker not found or permission denied.")

    return worker


async def get_worker_list(session: AsyncSession, user_id: int) -> Sequence[WorkerModel]:
    query = (
        select(WorkerModel)
        .where(WorkerModel.user_id == user_id)
        .options(selectinload(WorkerModel.tasks))
    )
    result = await session.execute(query)
    return result.scalars().all()


async def delete_worker(
    session: AsyncSession, worker_id: int, user_id: int, force: bool = False
) -> WorkerModel:
    """
    Deletes a worker. If force=False and the worker is running, throws an error.
    Returns a worker object so that the router can pass its container_id to the DockerService to stop the container.
    """
    worker = await get_worker(session, worker_id, user_id)

    if worker.status in [WorkerStatus.BUSY, WorkerStatus.STARTING] and not force:
        raise WorkerIsBusyError(
            "Worker is busy and cannot be deleted. Use force=True to delete it."
        )

    await session.delete(worker)
    await session.commit()

    return worker


async def update_worker_docker_info(
    session: AsyncSession,
    worker_id: int,
    container_id: str,
    vnc_port: int,
    status: WorkerStatus,
) -> WorkerModel:
    query = select(WorkerModel).where(WorkerModel.id == worker_id)
    result = await session.execute(query)
    worker = result.scalars().first()

    if worker:
        worker.container_id = container_id
        worker.vnc_port = vnc_port
        worker.status = status

        await session.commit()

    final_query = (
        select(WorkerModel)
        .options(selectinload(WorkerModel.tasks))
        .where(WorkerModel.id == worker_id)
    )
    final_result = await session.execute(final_query)

    return final_result.scalars().first()


# ── Task CRUD ────────────────────────────────────────────────


async def create_task(
    session: AsyncSession, task_in: TaskCreate, worker_id: int, user_id: int
) -> tuple[TaskModel, str | None]:
    """Creates a new task and blocks the worker for other tasks."""

    worker = await get_worker(session, worker_id, user_id)

    if worker.status == WorkerStatus.OFFLINE:
        raise WorkerOfflineError("Worker offline.")
    if worker.status == WorkerStatus.BUSY:
        raise WorkerIsBusyError("Worker is busy.")

    new_task = TaskModel(
        prompt=task_in.prompt,
        worker_id=worker_id,
        status=TaskStatus.QUEUED
    )

    worker.status = WorkerStatus.BUSY
    container_id = worker.container_id

    session.add(new_task)
    await session.commit()
    await session.refresh(new_task)

    return new_task, container_id


async def get_task(session: AsyncSession, task_id: int, user_id: int) -> TaskModel:
    """Gets the task along with its screenshots, checking user rights."""

    query = (
        select(TaskModel)
        .join(WorkerModel)
        .where(TaskModel.id == task_id, WorkerModel.user_id == user_id)
    )
    result = await session.execute(query)
    task = result.scalars().first()

    if not task:
        raise TaskNotFound("Task is not found or permission denied.")

    return task


async def get_task_list(
    session: AsyncSession, worker_id: int, user_id: int
) -> Sequence[TaskModel]:
    """Returns the task history of a particular worker."""

    query = (
        select(TaskModel)
        .join(WorkerModel)
        .where(TaskModel.worker_id == worker_id, WorkerModel.user_id == user_id)
        .order_by(TaskModel.created_at.desc())
    )
    result = await session.execute(query)
    return result.scalars().all()


async def delete_task(session: AsyncSession, task_id: int, user_id: int) -> TaskModel:
    """Deletes a task if it is not in progress."""

    task = await get_task(session, task_id, user_id)

    if task.status == TaskStatus.PROCESSING:
        raise TaskIsProcessingError(
            "The task the agent is currently running cannot be deleted."
        )

    await session.delete(task)
    await session.commit()
    return task


# ── Container lifecycle ──────────────────────────────────────


async def stop_worker_container(
        session: AsyncSession, worker_id: int, user_id: int, force: bool = False
) -> WorkerModel:
    """Stops the worker container. Checks BUSY status and access rights."""

    worker = await get_worker(session, worker_id, user_id)

    if not worker.container_id:
        raise WorkerNoContainerError("The worker has no bound container.")

    if worker.status == WorkerStatus.OFFLINE:
        return worker

    if worker.status == WorkerStatus.BUSY and not force:
        raise WorkerIsBusyError(
            "The worker is currently performing a task. Use force=true to force stop."
        )

    try:
        def _docker_stop():
            container = get_docker_service().client.containers.get(worker.container_id)
            if force:
                container.kill()
            else:
                container.stop()

        await run_in_threadpool(_docker_stop)
    except docker.errors.NotFound:
        pass
    except Exception as e:
        raise DockerOperationError(f"Docker error: {str(e)}")

    worker.status = WorkerStatus.OFFLINE
    await session.commit()
    await session.refresh(worker)

    return worker


async def start_worker_container(
        session: AsyncSession, worker_id: int, user_id: int
) -> WorkerModel:
    """Starts a previously stopped worker container."""

    worker = await get_worker(session, worker_id, user_id)

    if not worker.container_id:
        raise WorkerNoContainerError("The worker has no bound container to run.")

    if worker.status in [WorkerStatus.IDLE, WorkerStatus.BUSY]:
        return worker

    try:
        def _docker_start():
            container = get_docker_service().client.containers.get(worker.container_id)
            container.start()

        await run_in_threadpool(_docker_start)
    except docker.errors.NotFound:
        raise ContainerNotFoundError("The container was not found on the server. It may have been deleted.")
    except Exception as e:
        raise DockerOperationError(f"Docker error: {str(e)}")

    worker.status = WorkerStatus.IDLE
    await session.commit()
    await session.refresh(worker)

    return worker


# ── Screenshot CRUD ──────────────────────────────────────────


async def get_or_capture_screenshot(
    session: AsyncSession, worker_id: int, user_id: int
) -> ImageModel:
    """Gets latest screenshot (if <30s old) or captures a new one."""

    worker = await get_worker(session, worker_id, user_id)

    if not worker.container_id:
        raise WorkerNoContainerError("Worker not found or not active.")

    img_stmt = (
        select(ImageModel)
        .where(ImageModel.worker_id == worker_id)
        .order_by(ImageModel.created_at.desc())
        .limit(1)
    )
    img_res = await session.execute(img_stmt)
    latest_img = img_res.scalar_one_or_none()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if latest_img:
        time_since_last = (now - latest_img.created_at).total_seconds()
        if time_since_last < 30:
            return latest_img

    s3_url = await run_in_threadpool(capture_desktop_screenshot, worker.container_id, worker_id)

    new_image = ImageModel(worker_id=worker_id, s3_url=s3_url)
    session.add(new_image)
    await session.commit()
    await session.refresh(new_image)

    return new_image


async def get_screenshot_list(
    session: AsyncSession, worker_id: int, user_id: int
) -> Sequence[ImageModel]:
    """Returns all screenshots for a worker, newest first."""

    await get_worker(session, worker_id, user_id)

    img_stmt = (
        select(ImageModel)
        .where(ImageModel.worker_id == worker_id)
        .order_by(ImageModel.created_at.desc())
    )
    img_res = await session.execute(img_stmt)
    return img_res.scalars().all()
