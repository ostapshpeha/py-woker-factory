import base64
import datetime
import logging
from datetime import datetime, timezone
from celery.exceptions import SoftTimeLimitExceeded

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.worker import TaskModel, WorkerModel, WorkerStatus, TaskStatus
from app.worker.docker_service import get_docker_service

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="run_oi_agent")
def run_oi_agent(self, container_id: str, gemini_api_key: str):
    """
    Attention frontend: user need to wait 3-4 minutes while ubuntu installing
    apps for new computer
    :param self:
    :param container_id:
    :param gemini_api_key:
    :return:
    """
    logger.info(f"⚙️ Initialization container {container_id}")

    # 1. Даємо права sudo (від root)
    fix_sudo_cmd = "sh -c 'echo \"kasm-user ALL=(ALL) NOPASSWD:ALL\" >> /etc/sudoers'"
    try:
        get_docker_service().execute_command(container_id, fix_sudo_cmd, user="root")
        logger.info("✅ Sudo is valid!")
    except Exception as e:
        logger.error(f"❌ Can't set sudo: {e}")

    # 2. Встановлюємо всі програми через bash (від kasm-user)
    # Використовуємо && щоб процес зупинився, якщо щось піде не так
    install_cmd = """bash -c "
        sudo apt update && 
        sudo apt install -y scrot w3m curl wget jq gedit nano pandoc texlive-base wkhtmltopdf csvkit sqlite3 plantuml tree fzf geany && 
        wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && 
        sudo apt install -y ./google-chrome-stable_current_amd64.deb && 
        rm ./google-chrome-stable_current_amd64.deb
    " """

    logger.info("📦 Installing packages...")
    get_docker_service().execute_command(container_id, install_cmd, user="kasm-user")


    python_logic = (
"import os; "
"os.makedirs('/home/kasm-user/agent', exist_ok=True); "
f"os.environ['GEMINI_API_KEY']='{gemini_api_key}'; "
"from interpreter import interpreter; "
"interpreter.llm.model='gemini/gemini-2.5-flash'; "
"interpreter.auto_run=True; "
"interpreter.chat('System check: say Ready');"
    )
    oi_cmd = f'python3 -c "{python_logic}"'
    get_docker_service().execute_command(container_id, oi_cmd, user="kasm-user")

    return {"status": "initialized"}


@celery_app.task(bind=True, name="execute_worker_task", soft_time_limit=300, time_limit=310)
def execute_worker_task(self, task_id: int, worker_id: int, container_id: str, prompt: str, gemini_api_key: str):
    logger.info(f"▶️ Executing task {task_id} via Base64 Injection")
    status_check = get_docker_service().execute_command(container_id, "whoami", user="kasm-user", check=False)
    logger.info(f"🔍 Container user check: {status_check}")

    # Query previous completed task for context continuity
    db_pre = SessionLocal()
    prev_task_context = ""
    try:
        prev_task = db_pre.query(TaskModel).filter(
            TaskModel.worker_id == worker_id,
            TaskModel.status == TaskStatus.COMPLETED
        ).order_by(TaskModel.finished_at.desc()).first()
        if prev_task and prev_task.logs:
            truncated = prev_task.logs[:500]
            # Escape backslashes and quotes for safe embedding in the script
            truncated = truncated.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n")
            prev_task_context = truncated
    except Exception as e:
        logger.warning(f"Could not fetch previous task context: {e}")
    finally:
        db_pre.close()

    # Escape prompt for safe embedding in the Python script
    safe_prompt = prompt.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n")

    # Python script injection
    python_script = f"""
import os, json, sys, glob

from interpreter import interpreter

os.environ['GEMINI_API_KEY'] = '{gemini_api_key}'
interpreter.llm.model = 'gemini/gemini-2.5-flash'
interpreter.auto_run = True
interpreter.llm.context_window = 1000000

# --- Workspace awareness scan ---
agent_dir = '/home/kasm-user/agent'
desktop_dir = '/home/kasm-user/Desktop'
os.makedirs(agent_dir, exist_ok=True)
skills_dir = '/home/kasm-user/agent/skills'

try:
    workspace_files = os.listdir(agent_dir)
except Exception:
    workspace_files = []
try:
    desktop_files = os.listdir(desktop_dir)
except Exception:
    desktop_files = []

workspace_listing = ', '.join(workspace_files[:50]) if workspace_files else '(empty)'
desktop_listing = ', '.join(desktop_files[:50]) if desktop_files else '(empty)'

# --- Inject skill definitions (simple append, frontend will add "use @skill" to prompt) ---
interpreter.system_message += "\\nEXECUTOR MODE (MANDATORY):\\n"
interpreter.system_message += "- You are an autonomous executor, not a chat assistant.\\n"
interpreter.system_message += "- When a @skill is invoked, follow its steps to completion.\\n"
interpreter.system_message += "- Your final output for any task MUST be a concise summary of what was done and where the result is saved.\\n"
interpreter.system_message += "- DO NOT ask - Would you like me to do X? — just do it.\\n"

if os.path.exists(skills_dir):
    for skill_file in glob.glob(os.path.join(skills_dir, '*.md')):
        try:
            with open(skill_file, 'r', encoding='utf-8') as sf:
                skill_content = sf.read()
                skill_name = os.path.basename(skill_file).replace('.md', '')
                
                interpreter.system_message += "\\n--- SKILL DEFINITION (@" + skill_name + ") ---\\n" + skill_content + "\\n"
        except Exception as e:
            print("Warning: Failed to load skill " + skill_file + ": " + str(e))

# --- Previous task context ---
prev_context = '{prev_task_context}'
prev_section = ''
if prev_context:
    prev_section = f"\\nPREVIOUS TASK RESULT (from last completed task on this worker):\\n{{prev_context}}\\n"

# --- Build system prompt as a single template ---
system_addon = f\"\"\"
ENVIRONMENT:
  - Headless Ubuntu Docker container (no systemd, no snap)
  - Non-interactive only — never wait for user input
  - Chrome flags: --no-sandbox --disable-dev-shm-usage
  - Working directory: /home/kasm-user/agent
  - Output directory: /home/kasm-user/Desktop (user-visible results go here)

TIME BUDGET: ~7 minutes maximum. Plan accordingly — avoid long-running installs mid-task.

EXECUTOR MODE (MANDATORY):
  - You are an autonomous executor, not a chat assistant.
  - Execute tasks to completion. Never ask "would you like me to..." — just do it.
  - When a @skill is referenced, follow its steps to completion.
  - Your final output MUST summarize what was done and where results are saved.

ERROR RECOVERY:
  - If a GUI app fails to open, try an alternative (geany -> nano, chrome -> w3m)
  - If pip install fails, try: pip3 install --user <pkg>
  - If a command hangs, it will be killed — use timeouts on long commands (timeout 60 <cmd>)

WORKSPACE (files already present):
  /home/kasm-user/agent: {{workspace_listing}}
  /home/kasm-user/Desktop: {{desktop_listing}}
  /home/kasm-user/agent/skills/ : Skills
  
{{prev_section}}\"\"\"

interpreter.system_message += system_addon

# --- Execute the user's prompt ---
try:
    interpreter.chat('{safe_prompt}')

    # Capture ALL assistant messages for full execution trace
    all_replies = []
    for msg in interpreter.messages:
        if msg.get("role") == "assistant" and msg.get("content"):
            all_replies.append(msg["content"])

    final_output = "\\n---\\n".join(all_replies) if all_replies else "No output"
    print(f"\\n===AGENT_FINAL_REPLY===\\n{{final_output}}")

except Exception as e:
    print(f"\\n===INTERNAL_ERROR===\\n{{e}}")
    sys.exit(1)
"""

    encoded_script = base64.b64encode(python_script.encode('utf-8')).decode('utf-8')
    run_cmd = f"python3 -c \"import base64; exec(base64.b64decode('{encoded_script}').decode('utf-8'))\""

    db = SessionLocal()
    try:
        task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
        worker = db.query(WorkerModel).filter(WorkerModel.id == worker_id).first()

        logger.info(f"🛠 Running command: {run_cmd[:100]}...")
        output = get_docker_service().execute_command(container_id, run_cmd, user="kasm-user")

        final_result = output
        if "===AGENT_FINAL_REPLY===" in output:
            final_result = output.split("===AGENT_FINAL_REPLY===")[-1].strip()
        elif "===INTERNAL_ERROR===" in output:
            error_msg = output.split("===INTERNAL_ERROR===")[-1].strip()
            raise Exception(f"Agent crashed internally: {error_msg}")

        if task:
            task.status = TaskStatus.COMPLETED
            task.logs = final_result
            task.result = output  # Store full raw output for debugging

        logger.info(f"Task {task_id} completed successfully")
        result_payload = {"status": "success", "output": final_result}

    except SoftTimeLimitExceeded:
        logger.warning(f"Task {task_id} exceeded time limit!")

        if task:
            task.status = TaskStatus.FAILED
            task.result = "Error: Task execution exceeded the time limit."

        result_payload = {"status": "error", "error": "Timeout"}

    except Exception as e:
        logger.error(f"Task {task_id} failed: {str(e)}")

        if task:
            task.status = TaskStatus.FAILED
            task.result = str(e)

        result_payload = {"status": "error", "error": str(e)}

    finally:
        if task:
            task.finished_at = datetime.now(timezone.utc)
        if worker:
            worker.status = WorkerStatus.IDLE

        db.commit()
        db.close()

    return result_payload