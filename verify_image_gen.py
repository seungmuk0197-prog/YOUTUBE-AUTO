import requests
import json
import sys

BASE_URL = "http://localhost:5000"

def create_project():
    url = f"{BASE_URL}/api/projects"
    payload = {
        "topic": "Verification Project",
        "provider": "imagen4",
        "aspectRatio": "16:9"
    }
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        print(f"Project Created: {data['projectId']}")
        return data['projectId']
    except Exception as e:
        print(f"Error creating project: {e}")
        sys.exit(1)

def generate_image(project_id):
    url = f"{BASE_URL}/api/projects/{project_id}/generate/image"
    payload = {
        "sceneId": "test-scene-1",
        "prompt": "A futuristic city skyline at night with flying cars.",
        "styleId": "cyberpunk",
        "aspectRatio": "9:16",
        "characters": [
            {
                "name": "Neo",
                "role": "Hacker",
                "description": "Black trenchcoat and sunglasses"
            }
        ],
        "sequence": 1
    }
    
    try:
        print(f"Sending generation request to {url} with payload: {json.dumps(payload, indent=2)}")
        # Note: This might take a while, so timeout is high
        response = requests.post(url, json=payload, timeout=60)
        
        if response.status_code != 200:
            print(f"Error generating image: {response.status_code} - {response.text}")
            return

        data = response.json()
        print(f"\nImage Generated Successfully!")
        print(f"URL: {data.get('imageUrl')}")
        
        metadata = data.get('metadata', {})
        print(f"\nMetadata Verification:")
        print(f"Style ID: {metadata.get('styleId')} (Expected: cyberpunk)")
        print(f"Aspect Ratio: {metadata.get('aspectRatio')} (Expected: 9:16)")
        print(f"Width: {metadata.get('width')} (Expected: 1024)")
        print(f"Height: {metadata.get('height')} (Expected: 1792)")
        
        used_prompt = metadata.get('usedPrompt', '')
        print(f"\nUsed Prompt:\n{used_prompt}")
        
        if "Neo" in used_prompt and "Cyberpunk" in used_prompt or "Neon" in used_prompt: # Style desc check
             print("\nVERIFICATION PASSED: Prompt contains character and style context.")
        else:
             print("\nVERIFICATION FAILED: Prompt missing context.")

    except Exception as e:
        print(f"Exception during generation: {e}")

if __name__ == "__main__":
    pid = create_project()
    generate_image(pid)
