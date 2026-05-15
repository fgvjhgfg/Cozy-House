import os, shutil

src = r'C:\Users\Knp\Desktop\временная папка удали\Animations glb lite\Any\AnyIdle.glb'
dst = r'C:\Users\Knp\.gemini\antigravity\scratch\cozy-house\public\animations\AnyIdle.glb'

src_size = os.path.getsize(src)
dst_size = os.path.getsize(dst)
print(f'Source size: {src_size} bytes')
print(f'Current size: {dst_size} bytes')
print(f'Same file: {src_size == dst_size}')

# Читаем JSON-чанк GLB чтобы увидеть имя анимации
def read_glb_anim_name(path):
    with open(path, 'rb') as f:
        f.seek(12)  # skip GLB header
        json_len = int.from_bytes(f.read(4), 'little')
        f.read(4)   # chunk type
        json_data = f.read(json_len).decode('utf-8', errors='ignore')
    # Найти animations[].name
    import json
    try:
        j = json.loads(json_data)
        anims = j.get('animations', [])
        return [a.get('name', '?') for a in anims]
    except:
        # fallback - ищем текстово
        names = []
        for part in json_data.split('"name"'):
            if '":' in part:
                val = part.split('":')[1].strip().strip('"').split('"')[0]
                if val and len(val) < 60:
                    names.append(val)
        return names[:5]

print('Source anim names:', read_glb_anim_name(src))
print('Current anim names:', read_glb_anim_name(dst))
