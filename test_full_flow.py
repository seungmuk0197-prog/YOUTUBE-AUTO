import logging
import requests
import json
import time

BASE_URL = "http://localhost:5000/api"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    handlers=[
        logging.FileHandler("test_result.log", mode='w', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

def print(*args, **kwargs):
    logging.info(" ".join(map(str, args)))

def test_full_flow():
    print("🚀 Starting Full Flow Test...")

    # 1. Project Creation
    print("\n1. creating project...")
    topic_data = {"topic": "Test Project Flow"}
    res = requests.post(f"{BASE_URL}/projects/from-topic", json={
        "title": "Test Project Flow",
        "topicData": topic_data
    })
    
    if res.status_code not in [200, 201]:
        print(f"❌ Failed to create project: {res.text}")
        return
    
    project = res.json().get('project')
    project_id = project['id']
    print(f"✅ Project Created: {project_id}")

    # 2. Script Planning (Blueprint)
    print("\n2. Updating Blueprint...")
    blueprint = {
        "topic": "Test Topic",
        "length": 60,
        "tone": "humorous",
        "coreMessage": "AI is cool",
        "viewerPainPoint": "Manual coding is hard",
        "targetAudience": "Developers"
    }
    res = requests.patch(f"{BASE_URL}/projects/{project_id}", json={
        "blueprint": blueprint
    })
    if res.status_code != 200:
        print(f"❌ Failed to update blueprint: {res.text}")
        return
    print("✅ Blueprint Updated")

    # 3. Script Generation
    print("\n3. Updating Script...")
    script_text = "Scene 1: Hello World. Scene 2: AI Automation."
    res = requests.patch(f"{BASE_URL}/projects/{project_id}", json={
        "script": script_text
    })
    if res.status_code != 200:
        print(f"❌ Failed to update script: {res.text}")
        return
    print("✅ Script Updated")

    # 4. JSON Generation (Scenes & Characters)
    print("\n4. Updating Scenes & Characters...")
    scenes = [
        {"id": "s1", "text": "Hello World", "duration": 5, "imagePrompt": "A computer screen"},
        {"id": "s2", "text": "AI Automation", "duration": 5, "imagePrompt": "Robot working"}
    ]
    characters = [
        {"id": "c1", "name": "Developer", "description": "Tired looking coder"}
    ]
    res = requests.patch(f"{BASE_URL}/projects/{project_id}", json={
        "scenes": scenes,
        "characters": characters
    })
    if res.status_code != 200:
        print(f"❌ Failed to update scenes/characters: {res.text}")
        return
    print("✅ Scenes & Characters Updated")

    # 5. Verification
    print("\n5. Verifying Data Persistence...")
    res = requests.get(f"{BASE_URL}/projects/{project_id}")
    final_project = res.json().get('project')
    
    # Verify Blueprint
    if final_project.get('blueprint', {}).get('coreMessage') == "AI is cool":
        print("✅ Blueprint Verified")
    else:
        print(f"❌ Blueprint Validation Failed: {final_project.get('blueprint')}")

    # Verify Script
    if final_project.get('script') == script_text:
        print("✅ Script Verified")
    else:
        print(f"❌ Script Validation Failed: {final_project.get('script')}")

    # Verify Scenes
    if len(final_project.get('scenes', [])) == 2:
        print("✅ Scenes Verified")
    else:
        print(f"❌ Scenes Validation Failed: {len(final_project.get('scenes', []))}")

    # Verify Characters
    if len(final_project.get('characters', [])) == 1:
        print("✅ Characters Verified")
    else:
        print(f"❌ Characters Validation Failed: {len(final_project.get('characters', []))}")

if __name__ == "__main__":
    test_full_flow()
