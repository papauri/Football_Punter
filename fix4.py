import re
with open('engine.js', 'r') as f:
    text = f.read()

# Replace any occurrence of the garbled block with the correct one
pattern = re.compile(r"  getAiConfigPublic\(\) \{\s*async updateAvailableModels\(\) \{.*?  getAiConfigPublic\(\) \{\s*\}\s*\}\s*const supported = this\.supportedProviders \|\| \[", re.DOTALL)

good_str = """  async updateAvailableModels() {
    this.log('AI_Model_Manager', 'Initiating daily auto-update check for latest provider models...');
    try {
      const geminiEntry = this.aiConfig?.gemini;
      const geminiKey = geminiEntry?.key || process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.models) {
            const geminiModels = data.models
              .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => m.name.replace('models/', ''))
              .sort((a, b) => b.localeCompare(a));
            
            if (geminiModels.length > 0) {
              const geminiProvider = this.supportedProviders.find(p => p.id === 'gemini');
              if (geminiProvider) {
                const newModels = [...new Set([...geminiProvider.models, ...geminiModels])];
                geminiProvider.models = newModels;
                this.log('AI_Model_Manager', `Gemini model list auto-updated. Found ${geminiModels.length} active models.`);
              }
            }
          }
        }
      }
    } catch(err) {
      this.log('AI_Model_Manager_Error', `Failed to auto-update models: ${err.message}`);
    }
  }

  getAiConfigPublic() {
    const supported = this.supportedProviders || ["""

text = pattern.sub(good_str, text)

with open('engine.js', 'w') as f:
    f.write(text)

