"""Sample only numeric counters of specified Loon PIDs with Apple's built-in top.

top is shipped setuid by macOS and can read the root-owned VPN extension.
No privileges, process contents, proxy settings or security protections change.
The result is sampled/rounded physical footprint, never a kernel peak claim.
"""
import argparse
from decimal import Decimal
import json
from pathlib import Path
import re
import signal
import subprocess
import time
from datetime import datetime, timezone

LIMIT = 50_000_000


def parse_memory(value):
    m = re.fullmatch(r"(\d+(?:\.\d+)?)([BKMGTP]?)[+-]?", value)
    if not m:
        raise ValueError("Unsupported top memory value")
    number, unit = m.groups()
    scale = 1024 ** "BKM GTP".replace(" ", "").index(unit or "B")
    quantum = Decimal(10) ** -len(number.partition(".")[2])
    estimate = Decimal(number) * scale
    # One full display quantum on each side covers rounding/truncation; no
    # false precision is assigned to a displayed whole-MiB value.
    return {"display": value, "estimateBytes": int(estimate),
            "conservativeLowerBytes": max(0, int(estimate - quantum * scale)),
            "conservativeUpperBytes": int(estimate + quantum * scale)}


def run(args):
    if not 0 < args.seconds <= 900 or not 1 <= len(args.pid) <= 8:
        raise ValueError("Bounded duration and PID list required")
    expected = set(args.pid)
    commands = subprocess.check_output(["ps", "-p", ",".join(map(str, args.pid)), "-o", "pid=,comm="], text=True)
    found = {}
    for line in commands.splitlines():
        pid, command = line.strip().split(None, 1)
        if "loon" not in command.lower():
            raise ValueError("Refusing non-Loon process")
        found[int(pid)] = Path(command).name
    if set(found) != expected:
        raise ValueError("Missing requested Loon process")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["/usr/bin/top", "-F", "-R", "-l", "0", "-s", "0", "-stats", "pid,mem"]
    for pid in args.pid:
        cmd += ["-pid", str(pid)]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    start = time.monotonic()
    count = 0
    with args.output.open("w") as out:
        out.write(json.dumps({"kind": "method", "startedAtUTC": datetime.now(timezone.utc).isoformat(), "source": "Apple top MEM / physical footprint", "pids": found,
                              "peakKind": "sampled-window-maximum", "rounded": True, "nativeIOSAcceptance": "unverified",
                              "limitBytesExclusive": LIMIT, "command": cmd}) + "\n")
        try:
            for line in proc.stdout:
                elapsed = time.monotonic() - start
                if elapsed >= args.seconds or args.stop.exists():
                    break
                match = re.fullmatch(r"\s*(\d+)\s+(\d+(?:\.\d+)?[BKMGTP]?[+-]?)\s*", line)
                if not match or int(match[1]) not in expected:
                    continue
                try:
                    phase = json.loads(args.phase.read_text())["phase"]
                except (FileNotFoundError, KeyError, ValueError):
                    phase = "unlabelled"
                row = {"kind": "sample", "seconds": round(elapsed, 6), "pid": int(match[1]), "phase": phase, **parse_memory(match[2])}
                out.write(json.dumps(row) + "\n")
                out.flush()
                count += 1
        finally:
            proc.send_signal(signal.SIGINT)
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
    if not count:
        raise RuntimeError("No real process samples; cannot assess memory")
    print(json.dumps({"samples": count, "seconds": round(time.monotonic()-start, 3), "path": str(args.output)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=float, default=600)
    parser.add_argument("--pid", type=int, action="append", required=True)
    parser.add_argument("--phase", type=Path, required=True)
    parser.add_argument("--stop", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    run(parser.parse_args())
