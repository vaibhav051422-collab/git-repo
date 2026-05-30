
set -euo pipefail

cd "$(dirname "$0")"

python -m pip install --upgrade pip setuptools wheel
pip install --no-cache-dir -r requirements.txt
