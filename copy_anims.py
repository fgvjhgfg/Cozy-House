import shutil
import os

src_any  = r"C:\Users\Knp\Desktop\временная папка удали\Animations glb lite\Any"
src_vell = r"C:\Users\Knp\Desktop\временная папка удали\Animations glb lite\Vell"
dst      = r"C:\Users\Knp\.gemini\antigravity\scratch\cozy-house\public\animations"

files = [
    # (source_path, dest_path)
    # Общие анимации
    (f"{src_any}\\AnyIdle.glb",   f"{dst}\\AnyIdle.glb"),
    (f"{src_any}\\AnyWalk.glb",   f"{dst}\\AnyWalk.glb"),
    (f"{src_vell}\\VellWalk.glb", f"{dst}\\VellWalk.glb"),
    # Модели
    (f"{src_any}\\AnyModel.glb",   f"{dst}\\AnyModel.glb"),
    (f"{src_vell}\\VellModel.glb", f"{dst}\\VellModel.glb"),
    # Room2 Anny позы
    (f"{src_any}\\Any1p2r.glb", f"{dst}\\room2\\Anny\\Any1p2r.glb"),
    (f"{src_any}\\Any2p2r.glb", f"{dst}\\room2\\Anny\\Any2p2r.glb"),
    (f"{src_any}\\Any3p2r.glb", f"{dst}\\room2\\Anny\\Any3p2r.glb"),
    (f"{src_any}\\Any4p2r.glb", f"{dst}\\room2\\Anny\\Any4p2r.glb"),
    # Room2 Vell позы
    (f"{src_vell}\\Vell1p2r.glb", f"{dst}\\room2\\Vell\\Vell1p2r.glb"),
    (f"{src_vell}\\Vell2p2r.glb", f"{dst}\\room2\\Vell\\Vell2p2r.glb"),
    (f"{src_vell}\\Vell3p2r.glb", f"{dst}\\room2\\Vell\\Vell3p2r.glb"),
    (f"{src_vell}\\Vell4p2r.glb", f"{dst}\\room2\\Vell\\Vell4p2r.glb"),
]

for src_f, dst_f in files:
    if os.path.exists(src_f):
        shutil.copy2(src_f, dst_f)
        size_kb = os.path.getsize(dst_f) / 1024
        print(f"OK  {os.path.basename(dst_f):25s}  {size_kb:.1f} KB")
    else:
        print(f"MISS {src_f}")
