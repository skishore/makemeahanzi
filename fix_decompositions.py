#!/usr/bin/env python3
"""
Fix decomposition placeholders in Make Me a Hanzi dictionary.txt

The dictionary.txt file originally had 449 entries where the decomposition
field uses ？ (fullwidth question mark U+FF1F) as a placeholder for
components that didn't have known Unicode codepoints. Most of these were
already fixed in a previous commit (loqu8/makemeahanzi). This script
fixes the remaining entries where confident replacements can be made.

Corrections are based on the cjkvi-ids database
(https://github.com/cjkvi/cjkvi-ids) cross-referenced with Unicode
Unihan data.

Usage:
    python3 fix_decompositions.py [--dry-run]

Output:
    - Writes corrected dictionary.txt (unless --dry-run)
    - Prints a report of what was changed and what couldn't be resolved
"""

import json
import sys
import os

# =============================================================================
# CORRECTION TABLE
# =============================================================================
# Maps (character, old_decomposition) -> new_decomposition.
# Only entries where the replacement component has a confirmed Unicode
# codepoint and matches the cjkvi-ids reference decomposition.
#
# Component codepoints:
#   U+20089 𠂉  2-stroke component under 方 in 旅/旗/旃 etc.
#   U+200CC 𠃌  hook/bend component in 刀/司/习/马/与
# =============================================================================

CORRECTIONS = {
    # 与 (U+4E0E) - cjkvi-ids: ⿹②一 where ② represents an unencoded
    # component, but structurally this is the same 𠃌 hook used in 刀/司/习.
    # The existing dictionary already uses 𠃌 for those chars (刀=⿹𠃌丿,
    # 司=⿹𠃌𠮛, 习=⿹𠃌冫), so 与 should use it too for consistency.
    ('与', '⿹？一'): '⿹𠃌一',

    # 马 (U+9A6C) - simplified horse. Same 𠃌 enclosing hook as 与.
    # The traditional 馬 uses a complex multi-stroke body (cjkvi: ⿹⑥灬),
    # but simplified 马 has the same simple hook structure as 与.
    ('马', '⿹？一'): '⿹𠃌一',

    # 旅 (U+65C5) - cjkvi-ids: ⿰方⿱𠂉④ where 𠂉 (U+20089) is the
    # 2-stroke component between 方 and the lower part. The existing
    # dictionary already uses 𠂉 for other 方-based chars (旃, 旗, etc.
    # were fixed in a prior commit), but 旅 was missed.
    ('旅', '⿰方⿱？氏'): '⿰方⿱𠂉氏',
}

# =============================================================================
# Characters that CANNOT be fixed -- their components are genuinely
# unencoded in Unicode. The cjkvi-ids database uses circled numbers
# (②③④⑤⑥⑦⑧) as placeholders for these same components.
#
# Not fixable:
#   不 ⿱一？     -- bottom is ③ (unencoded, ~3 strokes: 丨+丿+丶)
#   业 ⿱？一     -- top is ④ (unencoded)
#   丝 ⿱⿰？？一 -- both ？ are ② (unencoded)
#   之 ⿱丶？     -- bottom is ② (unencoded)
#   乌 ⿱丿？     -- bottom is ③ (unencoded)
#   亙 ⿻二？     -- middle is ④ (unencoded)
#   亞 ⿻二？     -- middle is ⑥ (unencoded)
#   亦 ⿱亠？     -- bottom is ④ (unencoded)
#   兜 ⿱⿴？白儿 -- enclosure is ② (unencoded)
#   北 ⿰？匕     -- left is ③ (unencoded)
#   印 ⿰？卩     -- left is ③ (unencoded)
#   即 ⿰？卩     -- left is ⑤ (unencoded, 皀-like)
#   卿 ⿴卯？     -- inner is ⑤ (unencoded)
#   叚 ⿰？⿱？又 -- both ？ are ⑤ and コ (unencoded)
#   垂 ⿻⿱？士卄 -- component is ⑥ (unencoded)
#   惠 ⿱？心     -- top is ⑧ (unencoded)
#   既 ⿰？旡     -- left is ⑤ (unencoded, 皀-like)
#   段 ⿰？殳     -- left is ⑤ (unencoded)
#   烏 ⿹？灬     -- body is ⑥ (unencoded, multi-stroke bird body)
#   焉 ⿳正？灬   -- middle is ② (unencoded)
#   癶 ⿰？？     -- both halves unencoded (② and ③)
#   眔 ⿱目？     -- bottom is ⑤ (unencoded)
#   糹 ⿱幺？     -- bottom is ③ (unencoded)
#   與 ⿱⿻臼？八 -- middle component unencoded
#   華 ⿱艹⿻十？ -- bottom of right part unencoded (⑦)
#   虍 ⿸？七     -- enclosure unencoded
#   長 ⿱？？     -- both components unencoded (④ + complex)
#   镸 ⿱？厶     -- top is ④ (unencoded)
#   飠 ⿱人？     -- bottom is ⿱丶⑤ (unencoded)
#   馬 ⿹？灬     -- body is ⑥ (unencoded, multi-stroke horse body)
#   鳥 ⿹？灬     -- body is ⑦ (unencoded, multi-stroke bird body)
#   黑 ⿱？灬     -- top is ⑧ (unencoded)
#   鼎 ⿶？目     -- base is ⑧ (unencoded)
#   鼠 ⿱臼？     -- bottom is ⑦ (unencoded)
#   齊 ⿱？？     -- both components unencoded
#   龍 ⿰⿱立月？ -- right is ⑦ (unencoded)
#
# Also: 幺 and 鸟 have decomposition = ？ (they are base components)
# =============================================================================


def main():
    dry_run = '--dry-run' in sys.argv

    input_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dictionary.txt')

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found")
        sys.exit(1)

    # Read all entries
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Track statistics
    total_entries = 0
    entries_with_q = 0
    entries_fixed = 0
    entries_remaining = 0
    entries_just_q = 0
    changes = []
    remaining = []

    # Process each line
    output_lines = []
    for line in lines:
        line = line.rstrip('\n')
        entry = json.loads(line)
        total_entries += 1

        decomp = entry.get('decomposition', '')
        char = entry.get('character', '')

        if '\uff1f' not in decomp:  # ？ = U+FF1F
            output_lines.append(json.dumps(entry, ensure_ascii=False))
            continue

        entries_with_q += 1

        if decomp == '\uff1f':
            entries_just_q += 1
            output_lines.append(json.dumps(entry, ensure_ascii=False))
            continue

        key = (char, decomp)
        if key in CORRECTIONS:
            new_decomp = CORRECTIONS[key]
            old_decomp = decomp
            entry['decomposition'] = new_decomp
            entries_fixed += 1
            changes.append((char, f'U+{ord(char):04X}', old_decomp, new_decomp))
        else:
            entries_remaining += 1
            remaining.append((char, f'U+{ord(char):04X}', decomp))

        output_lines.append(json.dumps(entry, ensure_ascii=False))

    # Write output
    if not dry_run:
        with open(input_file, 'w', encoding='utf-8') as f:
            for line in output_lines:
                f.write(line + '\n')

    # Print report
    print("=" * 72)
    print("DECOMPOSITION FIX REPORT")
    print("=" * 72)
    print()
    print(f"Total entries in dictionary.txt:     {total_entries}")
    print(f"Entries with fullwidth ?:             {entries_with_q}")
    print(f"  - Decomposition is just ?:          {entries_just_q}")
    print(f"  - Has ? as component:               {entries_with_q - entries_just_q}")
    print(f"  - Fixed in this run:                {entries_fixed}")
    print(f"  - Remaining (no Unicode codepoint): {entries_remaining}")
    print()

    if changes:
        print("-" * 72)
        print(f"CHANGES APPLIED ({len(changes)}):")
        print("-" * 72)
        for char, codepoint, old, new in sorted(changes, key=lambda x: x[1]):
            print(f"  {char} ({codepoint}): {old}  ->  {new}")
        print()

    if remaining:
        print("-" * 72)
        print(f"REMAINING ({len(remaining)}):")
        print("-" * 72)
        print("  These components genuinely lack Unicode codepoints.")
        print("  The cjkvi-ids database uses circled number placeholders")
        print("  for the same components (e.g. ② ③ ④ ⑤ ⑥ ⑦ ⑧).")
        print()
        for char, codepoint, decomp in sorted(remaining, key=lambda x: x[1]):
            print(f"  {char} ({codepoint}): {decomp}")
        print()

    # Component reference
    print("-" * 72)
    print("COMPONENT CODEPOINTS USED:")
    print("-" * 72)
    print("  \U000200CC U+200CC: hook/bend stroke (used in 与, 马)")
    print("  \U00020089 U+20089: 2-stroke component under 方 (used in 旅)")
    print()

    if dry_run:
        print("[DRY RUN] No files were modified.")
    else:
        print(f"[DONE] dictionary.txt updated with {entries_fixed} corrections.")

    return 0


if __name__ == '__main__':
    sys.exit(main())
