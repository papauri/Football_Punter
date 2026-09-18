with open('src/components/Dashboard.jsx', 'r') as f:
    text = f.read()

paren = 0
brace = 0
for char in text:
    if char == '(': paren += 1
    if char == ')': paren -= 1
    if char == '{': brace += 1
    if char == '}': brace -= 1

print(f"Paren: {paren}, Brace: {brace}")
