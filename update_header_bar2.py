import re

filename = "src/components/HeaderBar.jsx"
with open(filename, "r") as f:
    content = f.read()

content = re.sub(
    r'<div className="flex items-center px-2 py-1 rounded-md text-\[11px\] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">\s*<span>System Accuracy: \{overallAccuracy\}%</span>',
    '<div className="flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono shadow-sm">\n              <span>System Confidence: {overallAccuracy}%</span>',
    content
)

with open(filename, "w") as f:
    f.write(content)
print("done")
