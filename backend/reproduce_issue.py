
import re

def prepare_turkish_search(q: str):
    if not q:
        return None
    
    replacements = {
        "i": "[iİ]", "İ": "[iİ]",
        "ı": "[ıI]", "I": "[ıI]",
        "g": "[gG]", "G": "[gG]",
        "ğ": "[ğĞ]", "Ğ": "[ğĞ]",
        "ü": "[üÜ]", "Ü": "[üÜ]",
        "ş": "[şŞ]", "Ş": "[şŞ]",
        "ö": "[öÖ]", "Ö": "[öÖ]",
        "ç": "[çÇ]", "Ç": "[çÇ]",
        "c": "[cC]", "C": "[cC]",
        "o": "[oO]", "O": "[oO]",
        "u": "[uU]", "U": "[uU]",
        "s": "[sS]", "S": "[sS]",
    }
    
    pattern = ""
    for char in q:
        replacement = replacements.get(char)
        if replacement:
            pattern += replacement
        elif char.isalpha():
            pattern += f"[{char.lower()}{char.upper()}]"
        else:
            pattern += re.escape(char)
            
    return pattern

test_queries = ["gizem", "GİZEM", "Gizem", "İlker", "ilker", "Şeyma", "seyma"]
test_targets = ["Gizem", "GİZEM", "gizem", "İlker", "Şeyma"]

print(f"{'Query':<10} | {'Regex':<30} | {'Target':<10} | {'Match?'}")
print("-" * 65)

for q in test_queries:
    regex = prepare_turkish_search(q)
    for target in test_targets:
        # Check if regex matches target
        match = re.search(regex, target, re.IGNORECASE)
        is_match = "YES" if match else "NO"
        if q.lower() in target.lower() or target.lower() in q.lower(): # approximate relevance
             print(f"{q:<10} | {regex:<30} | {target:<10} | {is_match}")
