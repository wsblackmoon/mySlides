#!/bin/bash
# ============================================================
# mySlides 作品集同步脚本（手动运行）
#   把本地源 HTML 同步到 GitHub Pages 仓库并发布。
#   用法：  bash sync.sh
#   新增作品：在下面 MAP 里加一行 "源绝对路径|仓库内相对路径"
# ============================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="/Users/aaronwu/AItools/cowork/slides-pages"
BASE="/Users/aaronwu/AItools/cowork/InvestmentAnalysis/复盘与内容"

# —— 源 => 目标（仓库内相对路径）。首页 index.html 已在仓库定制，不在此同步。——
MAP=(
  "$BASE/构建个人投资交易系统_网页版_白底_V1.0.html|investment-system/web.html"
  "$BASE/构建个人投资交易系统_幻灯片版_白底_V1.0.html|investment-system/slides.html"
)

C_G='\033[0;32m'; C_Y='\033[1;33m'; C_R='\033[0;31m'; C_N='\033[0m'
ok(){   echo -e "  ${C_G}✅ $*${C_N}"; }
warn(){ echo -e "  ${C_Y}⚠️  $*${C_N}"; }
err(){  echo -e "  ${C_R}❌ $*${C_N}"; }

# 等文件稳定（大小连续 2 次相同），避免读到"保存中途"的残缺文件
wait_stable(){
  local f="$1" last=-1 cur i
  for i in $(seq 1 10); do
    cur=$(stat -f%z "$f" 2>/dev/null || echo -1)
    [ "$cur" = "$last" ] && [ "$cur" != "-1" ] && return 0
    last="$cur"; sleep 1
  done
  return 0   # 超时也放行（尽力而为）
}

# 高置信度字面密钥扫描：剥离所有长 base64 后，只查含 - / _ 等 base64 里不会出现的密钥。
# 退出码：0=干净  1=命中  2=扫描出错(放行)
scan_secret(){
  /usr/bin/python3 - "$1" 2>/dev/null <<'PY' || exit 2
import re,sys
h=open(sys.argv[1],encoding='utf-8',errors='ignore').read()
h=re.sub(r'data:[^;,]+;base64,[A-Za-z0-9+/=\s]+','',h)   # 去 data: 内嵌资源
h=re.sub(r'[A-Za-z0-9+/]{40,}={0,2}','',h)               # 去任何长 base64 串(图片/字体)
t=re.sub(r'<[^>]+>',' ',h)
pat=r'sk-(?:ant|proj|live|test)-[A-Za-z0-9_\-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}'
sys.exit(1 if re.search(pat,t) else 0)
PY
}

echo "🔄 mySlides 作品集同步"
cd "$REPO" || { err "仓库不存在: $REPO"; exit 1; }

changed=0
for pair in "${MAP[@]}"; do
  src="${pair%%|*}"; dst="${pair##*|}"
  echo "• $dst"
  if [ ! -f "$src" ]; then err "源文件不存在，跳过：$src"; continue; fi
  wait_stable "$src"
  if cmp -s "$src" "$REPO/$dst"; then echo "    无变化"; continue; fi
  scan_secret "$src"; rc=$?
  if [ "$rc" = 1 ]; then err "疑似高危密钥，已跳过未发布（请检查源文件）"; continue; fi
  [ "$rc" = 2 ] && warn "密钥扫描异常，按无密钥放行"
  cp "$src" "$REPO/$dst"; changed=1
  ok "已更新（$(stat -f%z "$REPO/$dst") 字节）"
done

if [ "$changed" != 1 ]; then echo "✔ 无需发布（全部已是最新）"; exit 0; fi

echo "📤 提交并推送…"
git add -A
git -c user.name="AaronWU" -c user.email="wsblackmoon@gmail.com" \
    commit -q -m "sync: 更新作品集 $(date '+%F %T')"
if git push -q origin main 2>&1; then ok "已推送 → GitHub Pages 约 1 分钟后生效"; else err "推送失败（检查网络/SSH）"; exit 1; fi

# 发布后校验（等待重建）
echo "⏳ 等待 Pages 重建并校验…"; sleep 45
for pair in "${MAP[@]}"; do
  dst="${pair##*|}"
  url="https://wsblackmoon.github.io/mySlides/$dst"
  code=$(curl -s -o /tmp/_sync_chk -m 25 -L -w '%{http_code}' "$url")
  if [ "$code" = 200 ] && cmp -s "$REPO/$dst" /tmp/_sync_chk; then ok "$dst 线上=最新"; else warn "$dst HTTP $code（CDN 可能未刷完，稍后自动一致）"; fi
done
echo "🌐 https://wsblackmoon.github.io/mySlides/  →「作品集」"
