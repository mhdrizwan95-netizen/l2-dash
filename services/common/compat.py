
import sys

if sys.version_info.major == 2:
    from Queue import Queue, Empty
else:
    from queue import Queue, Empty
