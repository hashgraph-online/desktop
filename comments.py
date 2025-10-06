#!/usr/bin/env python3

import os
import re
import sys

def remove_inline_comments(file_path):
    """Remove inline comments while preserving JSDoc comments."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into lines to process each line individually
    lines = content.split('\n')
    processed_lines = []

    for line in lines:
        # Skip lines that are just inline comments
        if re.match(r'^\s*//', line):
            # Check if it's a JSDoc comment (but we want to keep those)
            if not line.strip().startswith('/**'):
                continue
        processed_lines.append(line)

    # Join lines back together
    processed_content = '\n'.join(processed_lines)

    # Remove multi-line comments that aren't JSDoc
    # This is tricky because we need to preserve /** */ comments
    # For now, let's focus on removing obvious inline /* */ comments

    # Write the processed content back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(processed_content)

    print(f"Processed: {file_path}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python remove_inline_comments.py <directory>")
        sys.exit(1)

    directory = sys.argv[1]

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.ts') or file.endswith('.js'):
                file_path = os.path.join(root, file)
                try:
                    remove_inline_comments(file_path)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    main()







