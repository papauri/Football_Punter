import re

filename = "src/components/HeaderBar.jsx"
with open(filename, "r") as f:
    content = f.read()

content = re.sub(
    r'<div className="hidden md:flex items-center px-2 py-1 rounded-md text-\[11px\] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">\s*<span>\{overallAccuracy\}% Hit</span>\s*</div>',
    '<div className="flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">\n              <span>System Accuracy: {overallAccuracy}%</span>\n            </div>',
    content
)

with open(filename, "w") as f:
    f.write(content)
print("done")
