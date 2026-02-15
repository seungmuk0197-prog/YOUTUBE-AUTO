
import sys
import os
import json
from pathlib import Path

# Add project root to sys.path
current_dir = Path(__file__).parent.absolute()
root_dir = current_dir
sys.path.insert(0, str(root_dir))

from backend.project_manager import ProjectManager
from backend.models import Project, Status
from backend.api import reconcile_and_persist_meta

def test_pinning_persistence():
    print("=== Testing Pinning Persistence ===")
    pm = ProjectManager(projects_root=str(root_dir / "projects"))
    
    # 1. Create a test project
    project = pm.create_project(topic="Test Project Pinning")
    project_id = project.id
    print(f"Created project: {project_id}")
    
    # 2. Pin the project using update_project_partial
    print("Pinning project...")
    pm.update_project_partial(project_id, {'isPinned': True})
    
    # 3. Verify in-memory (reloaded)
    project = pm.get_project(project_id)
    print(f"Reloaded project isPinned: {project.status.isPinned}")
    
    # 4. Verify on disk (project.json)
    json_path = pm._get_project_json_path(project_id)
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Check if status is dict or object in JSON
    status_data = data.get('status', {})
    is_pinned_json = status_data.get('isPinned', False) if isinstance(status_data, dict) else False
    print(f"JSON file isPinned: {is_pinned_json}")
    
    if not is_pinned_json:
        print("FAIL: isPinned not saved to JSON after update_project_partial")
        return

    # 5. Call reconcile_and_persist_meta (simulating API behavior)
    print("Calling reconcile_and_persist_meta...")
    reconcile_and_persist_meta(project_id)
    
    # 6. Verify on disk again
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    status_data = data.get('status', {})
    is_pinned_json_after = status_data.get('isPinned', False) if isinstance(status_data, dict) else False
    print(f"JSON file isPinned after reconcile: {is_pinned_json_after}")
    
    if not is_pinned_json_after:
        print("FAIL: isPinned lost after reconcile_and_persist_meta")
    else:
        print("SUCCESS: Pinning persisted correctly")

def test_archiving_persistence():
    print("\n=== Testing Archiving Persistence ===")
    pm = ProjectManager(projects_root=str(root_dir / "projects"))
    
    # 1. Create a test project
    project = pm.create_project(topic="Test Project Archiving")
    project_id = project.id
    print(f"Created project: {project_id}")
    
    # 2. Archive manually (simulating batch_archive_api logic)
    print("Archiving project...")
    project = pm.get_project(project_id)
    
    # Logic from batch_archive_projects in api.py
    # Converting status to object if needed
    if not hasattr(project.status, '__dataclass_fields__'):
         from backend.models import Status
         # ... (simplifying for test) ...
         project.status = Status(archived=True)
    else:
        project.status.archived = True
        
    pm.save_project(project)
    
    # 3. Verify on disk
    json_path = pm._get_project_json_path(project_id)
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"JSON file archived (before reconcile): {data.get('status', {}).get('archived')}")
    
    # 4. Reconcile
    print("Calling reconcile_and_persist_meta...")
    reconcile_and_persist_meta(project_id, force=True)
    
    # 5. Verify on disk
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"JSON file archived (after reconcile): {data.get('status', {}).get('archived')}")
    
    if data.get('status', {}).get('archived') != True:
        print("FAIL: Archived status lost after reconcile")
    else:
        print("SUCCESS: Archiving persisted correctly")

if __name__ == "__main__":
    try:
        test_pinning_persistence()
        test_archiving_persistence()
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
