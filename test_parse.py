def parse_periods(p_str):
    nums = set()
    parts = p_str.replace(' ', '').split(',')
    for part in parts:
        if '-' in part:
            try:
                st, en = part.split('-')
                if st.isdigit() and en.isdigit():
                    nums.update(range(int(st), int(en)+1))
            except: pass
        elif part.isdigit():
            nums.add(int(part))
    return nums

print(parse_periods("1,2"))
print(parse_periods("3-5"))
print(parse_periods("1, 4-6"))
print(parse_periods("2"))
