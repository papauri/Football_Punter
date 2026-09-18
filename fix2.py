with open('engine.js', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "getAiConfigPublic() {  async updateAvailableModels() {" in line:
        skip = True
        new_lines.append("  async updateAvailableModels() {\n")
        new_lines.append("    this.log('AI_Model_Manager', 'Initiating daily auto-update check for latest provider models...');\n")
        new_lines.append("    try {\n")
        new_lines.append("      const geminiEntry = this.aiConfig?.gemini;\n")
        new_lines.append("      const geminiKey = geminiEntry?.key || process.env.GEMINI_API_KEY;\n")
        new_lines.append("      if (geminiKey) {\n")
        new_lines.append("        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);\n")
        new_lines.append("        if (res.ok) {\n")
        new_lines.append("          const data = await res.json();\n")
        new_lines.append("          if (data && data.models) {\n")
        new_lines.append("            const geminiModels = data.models.filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent')).map(m => m.name.replace('models/', '')).sort((a, b) => b.localeCompare(a));\n")
        new_lines.append("            if (geminiModels.length > 0) {\n")
        new_lines.append("              const geminiProvider = this.supportedProviders.find(p => p.id === 'gemini');\n")
        new_lines.append("              if (geminiProvider) {\n")
        new_lines.append("                const newModels = [...new Set([...geminiProvider.models, ...geminiModels])];\n")
        new_lines.append("                geminiProvider.models = newModels;\n")
        new_lines.append("                this.log('AI_Model_Manager', `Gemini model list auto-updated. Found ${geminiModels.length} active models.`);\n")
        new_lines.append("              }\n")
        new_lines.append("            }\n")
        new_lines.append("          }\n")
        new_lines.append("        }\n")
        new_lines.append("      }\n")
        new_lines.append("    } catch(err) {\n")
        new_lines.append("      this.log('AI_Model_Manager_Error', `Failed to auto-update models: ${err.message}`);\n")
        new_lines.append("    }\n")
        new_lines.append("  }\n\n")
        new_lines.append("  getAiConfigPublic() {\n")
        new_lines.append("    const supported = this.supportedProviders || [];\n")
        continue
        
    if skip:
        if "const primary = this.aiConfig?.primaryProvider" in line:
            skip = False
            new_lines.append(line)
        continue

    new_lines.append(line)

with open('engine.js', 'w') as f:
    f.writelines(new_lines)
