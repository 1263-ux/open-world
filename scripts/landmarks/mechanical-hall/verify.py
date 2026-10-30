"""Compatibility entry point for the current refined mechanical hall validator.
The original flat-facade topology was superseded by real recessed openings.
"""
import pathlib, runpy, sys
root = pathlib.Path(__file__).resolve().parents[3]
sys.argv = [str(root / 'scripts/art/verify_mechanical_hall.py'), str(root / 'public/assets/campuses/yingxi')]
runpy.run_path(sys.argv[0], run_name='__main__')
