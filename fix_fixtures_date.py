import re

filename = "src/components/FixturesTablePage.jsx"
with open(filename, "r") as f:
    content = f.read()

content = re.sub(
    r'(<span>{m\.league}</span>\s*<span>•</span>\s*)(<span>{m\.time}</span>)',
    r'\1<span>{m.date ? m.date.slice(0,10) : \'Upcoming\'}</span><span>•</span>\2',
    content
)

with open(filename, "w") as f:
    f.write(content)
print("done")
