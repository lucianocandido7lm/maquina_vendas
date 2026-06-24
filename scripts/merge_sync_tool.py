#!/usr/bin/env python3
import os
import shutil
import hashlib
import sys
import time
import json

prod_dir = "/tmp/7lm-connect-prod"
dev_dir = "/opt/7lm-connect"

dry_run = "--dry-run" in sys.argv or "-d" in sys.argv

def get_md5(filepath):
    hasher = hashlib.md5()
    try:
        with open(filepath, 'rb') as f:
            buf = f.read(65536)
            while len(buf) > 0:
                hasher.update(buf)
                buf = f.read(65536)
        return hasher.hexdigest()
    except Exception as e:
        return f"error: {str(e)}"

# Find files in prod
prod_files = {}
for root, dirs, files in os.walk(prod_dir):
    for file in files:
        full_path = os.path.join(root, file)
        rel_path = os.path.relpath(full_path, prod_dir)
        prod_files[rel_path] = full_path

# Find files in dev
dev_files = {}
for root, dirs, files in os.walk(dev_dir):
    for file in files:
        full_path = os.path.join(root, file)
        rel_path = os.path.relpath(full_path, dev_dir)
        dev_files[rel_path] = full_path

all_rel_paths = set(prod_files.keys()).union(set(dev_files.keys()))

copied_only_in_prod = []
kept_only_in_dev = []
merged_prod_won = []
merged_dev_won = []
resolved_conflicts = []

for rel_path in sorted(all_rel_paths):
    # 1. File exists ONLY in prod
    if rel_path not in dev_files:
        p_path = prod_files[rel_path]
        d_path = os.path.join(dev_dir, rel_path)
        copied_only_in_prod.append(rel_path)
        if not dry_run:
            os.makedirs(os.path.dirname(d_path), exist_ok=True)
            shutil.copy2(p_path, d_path)
        continue

    # 2. File exists ONLY in dev
    if rel_path not in prod_files:
        kept_only_in_dev.append(rel_path)
        continue

    # 3. File exists in both
    p_path = prod_files[rel_path]
    d_path = dev_files[rel_path]

    p_hash = get_md5(p_path)
    d_hash = get_md5(d_path)

    if p_hash == d_hash:
        continue

    # Content differs, compare metadata
    try:
        p_stat = os.stat(p_path)
        d_stat = os.stat(d_path)
    except Exception as e:
        resolved_conflicts.append({
            "file": rel_path,
            "status": "error",
            "message": f"Error getting stat: {str(e)}"
        })
        continue

    p_size = p_stat.st_size
    d_size = d_stat.st_size

    p_mtime = p_stat.st_mtime
    d_mtime = d_stat.st_mtime

    # Determine most complete/recent version
    prod_better_or_equal = (p_mtime >= d_mtime and p_size >= d_size)
    dev_better_or_equal = (d_mtime >= p_mtime and d_size >= p_size)

    if prod_better_or_equal and not dev_better_or_equal:
        # Prod wins
        merged_prod_won.append(rel_path)
        if not dry_run:
            shutil.copy2(p_path, d_path)
    elif dev_better_or_equal and not prod_better_or_equal:
        # Dev wins
        merged_dev_won.append(rel_path)
    else:
        # Conflict: one is larger, the other is newer
        if p_mtime > d_mtime:
            # Prod is newer, Dev is larger
            resolved_conflicts.append({
                "file": rel_path,
                "winner": "prod (newer)",
                "p_size": p_size,
                "p_mtime": time.ctime(p_mtime),
                "d_size": d_size,
                "d_mtime": time.ctime(d_mtime),
                "action": "Backed up dev version to .dev_conflict and copied prod version"
            })
            if not dry_run:
                shutil.copy2(d_path, d_path + ".dev_conflict")
                shutil.copy2(p_path, d_path)
        else:
            # Dev is newer, Prod is larger
            resolved_conflicts.append({
                "file": rel_path,
                "winner": "dev (newer)",
                "p_size": p_size,
                "p_mtime": time.ctime(p_mtime),
                "d_size": d_size,
                "d_mtime": time.ctime(d_mtime),
                "action": "Copied prod version to .prod_conflict and kept dev version"
            })
            if not dry_run:
                shutil.copy2(p_path, d_path + ".prod_conflict")

# Write results to a JSON file for local reference/logging
results = {
    "copied_only_in_prod": copied_only_in_prod,
    "kept_only_in_dev": kept_only_in_dev,
    "merged_prod_won": merged_prod_won,
    "merged_dev_won": merged_dev_won,
    "resolved_conflicts": resolved_conflicts
}

with open("/tmp/daily_sync_merge_results.json", "w") as f:
    json.dump(results, f, indent=2)

# Print Summary Report to stdout (which is captured by daily_sync.sh log)
print("==========================================")
print("7lm-connect Safe Merge Summary" + (" (DRY RUN)" if dry_run else ""))
print("==========================================")
print(f"Files ONLY in Prod (copied to Dev): {len(copied_only_in_prod)}")
print(f"Files ONLY in Dev (kept in Dev): {len(kept_only_in_dev)}")
print(f"Merged files (Prod won -> Dev updated): {len(merged_prod_won)}")
print(f"Merged files (Dev won -> Dev kept): {len(merged_dev_won)}")
print(f"Conflicts found and resolved: {len(resolved_conflicts)}")
for c in resolved_conflicts:
    print(f"  ! {c['file']} (Winner: {c['winner']})")
    print(f"    Action: {c['action']}")
print("==========================================")
