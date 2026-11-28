#!/bin/sh
# محیط پایتون برای poisson_unpillow.py و poisson_wood.py (pymeshlab روی پایتون سیستم نصب نیست).
# اجرا: bash .claude/skills/new-product/scripts/setup-venv.sh   ←   بعد: ~/.venvs/scan/bin/python poisson_unpillow.py ...
set -e
V="$HOME/.venvs/scan"
if [ ! -x "$V/bin/python" ]; then python3 -m venv "$V"; fi
"$V/bin/pip" install --quiet --upgrade pip
"$V/bin/pip" install --quiet numpy scipy pymeshlab pillow
"$V/bin/python" -c "import numpy, scipy, pymeshlab, PIL; print('ok:', '$V/bin/python')"
