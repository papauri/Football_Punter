import re

filename = "src/components/AccumulatorPage.jsx"
with open(filename, "r") as f:
    content = f.read()

content = content.replace("Compound Edge Variance Tracker", "Accumulator Risk Analysis")
content = content.replace("Variance Risk", "Risk Rating")

with open(filename, "w") as f:
    f.write(content)
print("done")
