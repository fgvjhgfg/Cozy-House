$src = "C:\Users\Knp\Desktop\временная папка удали\Animations glb lite"
$dst = "C:\Users\Knp\.gemini\antigravity\scratch\cozy-house\public\animations"

# Общие анимации (корень)
Copy-Item "$src\Any\AnyIdle.glb"    "$dst\AnyIdle.glb"   -Force
Copy-Item "$src\Any\AnyWalk.glb"    "$dst\AnyWalk.glb"   -Force
Copy-Item "$src\Vell\VellWalk.glb"  "$dst\VellWalk.glb"  -Force

# Модели персонажей
Copy-Item "$src\Any\AnyModel.glb"   "$dst\AnyModel.glb"  -Force
Copy-Item "$src\Vell\VellModel.glb" "$dst\VellModel.glb" -Force

# Room2 позы Anny
Copy-Item "$src\Any\Any1p2r.glb"    "$dst\room2\Anny\Any1p2r.glb" -Force
Copy-Item "$src\Any\Any2p2r.glb"    "$dst\room2\Anny\Any2p2r.glb" -Force
Copy-Item "$src\Any\Any3p2r.glb"    "$dst\room2\Anny\Any3p2r.glb" -Force
Copy-Item "$src\Any\Any4p2r.glb"    "$dst\room2\Anny\Any4p2r.glb" -Force

# Room2 позы Vell
Copy-Item "$src\Vell\Vell1p2r.glb"  "$dst\room2\Vell\Vell1p2r.glb" -Force
Copy-Item "$src\Vell\Vell2p2r.glb"  "$dst\room2\Vell\Vell2p2r.glb" -Force
Copy-Item "$src\Vell\Vell3p2r.glb"  "$dst\room2\Vell\Vell3p2r.glb" -Force
Copy-Item "$src\Vell\Vell4p2r.glb"  "$dst\room2\Vell\Vell4p2r.glb" -Force

Write-Host "=== Done! ==="
Get-ChildItem "$dst" -Recurse -File | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}, LastWriteTime
