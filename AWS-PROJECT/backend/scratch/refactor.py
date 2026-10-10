import os
import re

def repl(text, pattern, replacement):
    return re.sub(pattern, replacement, text)

# We will apply regex replacements to all .py files in routers and services.
# But for safety, we should do it manually or semi-manually.
