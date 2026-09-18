with open('src/components/Dashboard.jsx', 'r') as f:
    lines = f.readlines()

for i in range(1730, 1750):
    if 'div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950"' in lines[i]:
        print("Deleting line", i)
        del lines[i]
        break

with open('src/components/Dashboard.jsx', 'w') as f:
    f.writelines(lines)
