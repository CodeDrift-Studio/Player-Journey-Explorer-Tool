# Empty conftest at the etl/ root.
# Its mere presence makes pytest treat etl/ as the rootdir and puts it on
# sys.path (prepend import mode), so `from src.coordinates import ...` works
# in tests without any install step.
