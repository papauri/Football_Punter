import re

filename = "src/components/AutonomousPatchCenter.jsx"
with open(filename, "r") as f:
    content = f.read()

content = content.replace("Autonomous Deep-Learning & Self-Patch Engine", "System Update & Error Correction Engine")
content = content.replace("Surprises Diagnosed", "Misses Analyzed")
content = content.replace("Patches Committed", "System Fixes Applied")
content = content.replace("Net Brier Reduction", "Accuracy Improvement")
content = content.replace("Safety Guardrails", "Changes Validated")

with open(filename, "w") as f:
    f.write(content)
print("done")
