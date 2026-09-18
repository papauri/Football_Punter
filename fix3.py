with open('engine.js', 'r') as f:
    text = f.read()

import re

# We want to replace the exact broken block.
# Let's find the exact string and replace it.
bad_str = """  getAiConfigPublic() {  async updateAvailableModels() {
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
  getAiConfigPublic() {
    }
  }

    const supported = this.supportedProviders || ["""

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

new_text = text.replace(bad_str, good_str)
with open('engine.js', 'w') as f:
    f.write(new_text)

