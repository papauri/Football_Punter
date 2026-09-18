import re

with open('src/components/FixturesTablePage.jsx', 'r') as f:
    content = f.read()

pattern = r'\{/\* Remove old action row & chips \*/\}.*?\{/\* Matches League Table \*/\}'
content = re.sub(pattern, '{/* Matches League Table */}', content, flags=re.DOTALL)

with open('src/components/FixturesTablePage.jsx', 'w') as f:
    f.write(content)

