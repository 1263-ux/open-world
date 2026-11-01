"""Compatibility entry point; geometry lives in landmarks/mechanical-hall/generator.py."""
import os
import runpy
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Preserve the legacy default output directory and explicit caller override.
os.environ.setdefault("MODEL_OUTPUT_DIR", str(HERE))
runpy.run_path(str(HERE.parent / "landmarks/mechanical-hall/generator.py"), run_name="__main__")
