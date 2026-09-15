#!/bin/bash
# ============================================================
# mySlides 自动同步：源 HTML 改动 → 拷入仓库 → commit → push → Pages 重建
# 由 launchd (com.aaronwu.slides-autosync) 在源文件变化时触发；也可手动运行。
# 新增作品：在下面 MAP 里加一行 "源绝对路径|仓库内相对路径" 即可。
# ============================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="/Users/aaronwu/AItools/cowork/slides-pages"
BASE="/Users/aaronwu/AItools/cowork/InvestmentAnalysis/复盘与内容"
LOG="$REPO/.autosync.log"
LOCK="$REPO/.autosync.lock"

log(){ echo "[$(date '+%F %T')] $*" >> "$LOG"; }
notify(){ osascript -e "display notification \"$1\" with title \"mySlides 自动同步\"" >/dev/null 2>&1 || true; }

# 源 => 目标（相对 repo）。首页 index.html 不在此列（仓库版已定制，勿自动覆盖）。
MAP=(
  "$BASE/构建个人投资交易系统_网页版_白底_V1.0.html|investment-system/web.html"
  "$BASE/构建个人投资交易系统_幻灯片版_白底_V1.0.html|investment-system/slides.html"
)

# 防并发（WatchPaths 可能连续触发）
if ! mkdir "$LOCK" 2>/dev/null; then log "已有同步在跑，跳过"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

cd "$REPO" || { log "❌ 仓库不存在: $REPO"; exit 1; }

# 高置信度密钥扫描（去 base64 后）——命中则拒发该文件（邮箱/账号不拦）
has_secret(){
  /usr/bin/python3 - "$1" <<'PY'
import re,sys
h=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
h=re.sub(r'data:[^;]+;base64,[A-Za-z0-9+/=\s]+','',h)   # 去内嵌 base64
t=re.sub(r'<[^>]+>',' ',h)
pat=r'AIzaSy[0-9A-Za-z_\-]{30,}|sk-(?:ant-)?[A-Za-z0-9_\-]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}'
sys.exit(1 if re.search(pat,t) else 0)
PY
}

changed=0
for pair in "${MAP[@]}"; do
  src="${pair%%|*}"; dst="${pair##*|}"
  [ -f "$src" ] || { log "跳过(源不存在): $src"; continue; }
  if cmp -s "$src" "$REPO/$dst"; then continue; fi          # 无变化
  if has_secret "$src"; then
    log "⚠️ 高危密钥命中，未发布: $dst"; notify "检测到疑似密钥，$dst 未发布"; continue
  fi
  cp "$src" "$REPO/$dst"; changed=1; log "已更新 $dst"
done

if [ "$changed" != 1 ]; then log "无变化"; exit 0; fi

git add -A
git -c user.name="AaronWU" -c user.email="wsblackmoon@gmail.com" \
    commit -q -m "auto-sync: 更新作品 $(date '+%F %T')"
if git push -q origin main 2>>"$LOG"; then
  log "✅ 已推送 → Pages 将自动重建"; notify "已同步上线，约 1 分钟后生效"
else
  log "❌ push 失败（检查网络/SSH）"; notify "推送失败，请查看 .autosync.log"
fi
