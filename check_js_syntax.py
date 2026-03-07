import re

def check_brackets(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove strings and comments for simple bracket check
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'\'(.*?)\'', '', content)
    content = re.sub(r'"(.*?)"', '', content)
    content = re.sub(r'`(.*?)`', '', content, flags=re.DOTALL)

    brackets = {'{': '}', '[': ']', '(': ')'}
    stack = []
    
    for i, char in enumerate(content):
        if char in brackets.keys():
            stack.append((char, i))
        elif char in brackets.values():
            if not stack:
                print(f"Unmatched closing {char} at index {i}")
                return False
            open_char, idx = stack.pop()
            if brackets[open_char] != char:
                print(f"Mismatched bracked at index {i}: expected {brackets[open_char]} but got {char}")
                return False
                
    if stack:
        print(f"Unclosed brackets: {stack}")
        return False
        
    print("Brackets are balanced.")
    return True

check_brackets('app/static/js/main.js')
