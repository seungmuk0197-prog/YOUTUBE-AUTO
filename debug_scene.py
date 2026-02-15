
import sys
import os
from pathlib import Path

# Add project root to sys.path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

try:
    from backend.models import Scene, Project
    import dataclasses
    
    print("Scene fields:", dataclasses.fields(Scene))
    try:
        s = Scene(id="test", sequence=1)
        print("Instantiation success:", s)
    except Exception as e:
        print("Instantiation failed:", e)

except Exception as e:
    print("Import failed:", e)
