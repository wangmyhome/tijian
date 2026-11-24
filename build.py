"""Build the portable, fully offline HTML file from the local sources."""
from pathlib import Path
import argparse
import json
import shutil

root = Path(__file__).resolve().parent
csv_source = root / "data" / "计算机程序设计员 · 三级_已分类.csv"
if not csv_source.exists():
    csv_source = root.parent / "理论题.csv"
if csv_source.exists():
    csv_text = csv_source.read_text(encoding="utf-8-sig")
    (root / "seed.js").write_text(
        "window.QUIZ_SEED_CSV = "
        + json.dumps(csv_text, ensure_ascii=False).replace("</script", "<\\/script")
        + ";\n",
        encoding="utf-8",
    )

html = (root / "index.html").read_text(encoding="utf-8")
for stylesheet in ["style.css", "mobile.css"]:
    css = (root / stylesheet).read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="' + stylesheet + '">', '<style>\n' + css + '\n</style>')
# Portable file stays self-contained; install metadata belongs to the hosted app.
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '').replace('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">', '')
for filename in ["core.js", "seed.js", "config.js", "cloud.js", "app.js"]:
    source = (root / filename).read_text(encoding="utf-8")
    if filename == "config.js":
        source = "window.TIJIAN_CLOUD_CONFIG = { enabled: false };"
    html = html.replace('<script src="' + filename + '"></script>', '<script>\n' + source + '\n</script>')
target = root / "题间·离线刷题.html"
target.write_text(html, encoding="utf-8")
print(f"Built: {target} ({target.stat().st_size:,} bytes)")

parser = argparse.ArgumentParser()
parser.add_argument("--site-dir", help="Write only public website assets to this folder")
args = parser.parse_args()
if args.site_dir:
    site = Path(args.site_dir).resolve()
    site.mkdir(parents=True, exist_ok=True)
    for filename in ["index.html", "style.css", "mobile.css", "core.js", "seed.js", "config.js", "cloud.js", "app.js", "sw.js", "manifest.webmanifest"]:
        shutil.copy2(root / filename, site / filename)
    shutil.copytree(root / "icons", site / "icons", dirs_exist_ok=True)
    shutil.copytree(root / "operation-page", site / "operation-page", dirs_exist_ok=True)
    (site / ".nojekyll").touch()
    print(f"Website: {site}")
