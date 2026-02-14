class WorkerLimitExceeded(Exception):
    pass


class WorkerNotFound(Exception):
    pass


class WorkerIsBusyError(Exception):
    pass


class TaskNotFound(Exception):
    pass


class WorkerOfflineError(Exception):
    pass


class TaskIsProcessingError(Exception):
    pass
