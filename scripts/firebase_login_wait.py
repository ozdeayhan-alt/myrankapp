#!/usr/bin/env python3
"""Firebase CLI login helper for headless/SSH environments."""
import os
import re
import sys
import time

import pexpect

FIREBASE = os.environ.get(
    "FIREBASE_BIN",
    "/root/.cursor-server/bin/linux-x64/lib/node_modules/firebase-tools/lib/bin/firebase.js",
)
CODE_FILE = os.environ.get("FIREBASE_AUTH_CODE_FILE", "/tmp/firebase_auth_code.txt")
INFO_FILE = os.environ.get("FIREBASE_LOGIN_INFO_FILE", "/tmp/firebase_login_info.txt")


def main() -> int:
    auth_code = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("FIREBASE_AUTH_CODE")

    child = pexpect.spawn(
        f"node {FIREBASE} login --no-localhost",
        encoding="utf-8",
        timeout=600,
    )
    child.logfile = sys.stdout

    child.expect("Enable Gemini in Firebase features?", timeout=120)
    child.sendline("n")

    child.expect("Allow Firebase to collect CLI and Emulator Suite", timeout=120)
    child.sendline("n")

    child.expect("Take note of your session ID:", timeout=120)
    child.expect(r"([A-F0-9]{5})", timeout=30)
    session_id = child.match.group(1)

    child.expect("Visit the URL below", timeout=30)
    child.expect(r"(https://[^\s]+)", timeout=30)
    login_url = child.match.group(1)

    with open(INFO_FILE, "w", encoding="utf-8") as handle:
        handle.write(f"session_id={session_id}\n")
        handle.write(f"login_url={login_url}\n")

    print("\n=== FIREBASE LOGIN READY ===")
    print(f"SESSION_ID={session_id}")
    print(f"LOGIN_URL={login_url}")
    print(f"INFO_FILE={INFO_FILE}")
    sys.stdout.flush()

    child.expect("Enter authorization code:", timeout=120)

    if not auth_code and os.path.exists(CODE_FILE):
        with open(CODE_FILE, encoding="utf-8") as handle:
            auth_code = handle.read().strip()

    if not auth_code:
        print(f"\nWaiting up to 15 minutes for auth code in {CODE_FILE} ...")
        sys.stdout.flush()
        deadline = time.time() + 900
        while time.time() < deadline:
            if os.path.exists(CODE_FILE):
                with open(CODE_FILE, encoding="utf-8") as handle:
                    auth_code = handle.read().strip()
                if auth_code:
                    break
            time.sleep(2)

    if not auth_code:
        print("ERROR: No authorization code received before timeout.")
        child.close(force=True)
        return 1

    child.sendline(auth_code)
    child.expect(pexpect.EOF, timeout=120)
    print(child.before)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
