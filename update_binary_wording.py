import re

filename = "src/components/BinaryPicksPage.jsx"
with open(filename, "r") as f:
    content = f.read()

content = content.replace("Elite Dislocation", "Elite Value")
content = content.replace("Highest Dislocation Edge", "Highest Betting Edge")
content = content.replace("Positive Edges", "Value Bets")
content = content.replace("Dislocation Engine", "Value Engine")

with open(filename, "w") as f:
    f.write(content)
print("done")
