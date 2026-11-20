#!/bin/sh
# سرور محلی: http برای کامپیوتر و آیفون، https برای AR در اندروید. آدرس‌ها را چاپ می‌کند.
cd "$(dirname "$0")"
exec python3 server.py
