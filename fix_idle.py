import os, shutil

files_to_copy = [
    (r'AnyIdle.glb', r'AnyIdle.glb'),
    (r'AnyWalk.glb', r'AnyWalk.glb'),
    (r'AnyModel.glb', r'AnyModel.glb'),
    (r'AnyWalk.glb', r'AnyWalk.glb'),
]

src_dir = r'C:\Users\Knp\Desktop\временная папка удали\Animations glb lite\Any'
dst_dir = r'C:\Users\Knp\.gemini\antigravity\scratch\cozy-house\public\animations'

# Копируем все файлы Any
for fname in os.listdir(src_dir):
    src = os.path.join(src_dir, fname)
    dst = os.path.join(dst_dir, fname)
    shutil.copy2(src, dst)
    print(f'Copied: {fname} ({os.path.getsize(src)} bytes)')

print('\nDone. Verifying AnyIdle.glb:')
idle_path = os.path.join(dst_dir, 'AnyIdle.glb')
print(f'  Size: {os.path.getsize(idle_path)} bytes (should be ~176536)')
