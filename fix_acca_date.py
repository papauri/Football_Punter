import re

filename = "src/components/AccumulatorPage.jsx"
with open(filename, "r") as f:
    content = f.read()

content = re.sub(
    r'(<td className="py-2 px-3 text-slate-500">)\s*({leg\.time})\s*(</td>)',
    r'\1{leg.date ? leg.date.slice(0, 10) : \'Upcoming\'}<br/>\2\3',
    content
)

with open(filename, "w") as f:
    f.write(content)
print("done")
