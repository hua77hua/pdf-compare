# 合併 CSS:修改 style.css / theme-modern.css / theme-home.css 後執行 `python3 build_css.py`,
# 並把 index.html 裡 all.css 的 ?v= 版本號改成新日期。
import os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
parts = ['style.css', 'theme-modern.css', 'theme-home.css']
with open(os.path.join(d, 'all.css'), 'w', encoding='utf-8') as out:
    for f in parts:
        out.write(f'/* ── {f} ── */\n')
        out.write(open(os.path.join(d, f), encoding='utf-8').read() + '\n')
