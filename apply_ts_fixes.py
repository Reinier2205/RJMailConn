import re

# Fix sync-engine.ts
print("Fixing sync-engine.ts...")
with open("src/sync/sync-engine.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Remove unused imports
content = content.replace("GraphEmailMessage, transformGraphMessage,", "")
content = content.replace("SyncStateRecord, ", "")

# Fix Date to ISO string
content = re.sub(r'(\s+)(const startTime = )new Date\(\);', r'\1\2new Date().toISOString();', content)
content = re.sub(r'(\s+)(completedAt: )new Date\(\),', r'\1\2new Date().toISOString(),', content)
content = re.sub(r'(\s+)(result\.completedAt = )new Date\(\);', r'\1\2new Date().toISOString();', content)
content = re.sub(r'(\s+)(timestamp: )new Date\(\),', r'\1\2new Date().toISOString(),', content)

# Fix checkpoint timestamp
content = content.replace(
    "const safetyOverlap = checkpoint ? new Date(checkpoint.timestamp.getTime() - 3600000) : null;",
    "const safetyOverlap = checkpoint ? new Date(new Date(checkpoint.timestamp).getTime() - 3600000) : null;"
)
content = content.replace(
    "timestamp: new Date(result.last_success_at as string),",
    "timestamp: result.last_success_at as string,"
)

# Fix cursor undefined
content = content.replace(
    "cursor: retrievalResult.nextLink || undefined",
    "cursor: retrievalResult.nextLink"
)
content = content.replace(
    "cursor: result.last_success_cursor as string | undefined,",
    "cursor: result.last_success_cursor as string,"
)

with open("src/sync/sync-engine.ts", "w", encoding="utf-8") as f:
    f.write(content)

# Fix microsoft/graph.ts
print("Fixing microsoft/graph.ts...")
with open("src/microsoft/graph.ts", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "if (pageData.value && Array.isArray(pageData.value))" in line:
        lines[i] = line.replace("pageData.value", "(pageData as any).value")
    elif "items.push(...pageData.value);" in line:
        lines[i] = line.replace("pageData.value", "(pageData as any).value")
    elif 'currentUrl = pageData["@odata.nextLink"] || null;' in line:
        lines[i] = line.replace('pageData["@odata.nextLink"]', '(pageData as any)["@odata.nextLink"]')

with open("src/microsoft/graph.ts", "w", encoding="utf-8") as f:
    f.writelines(lines)

# Fix index.ts
print("Fixing index.ts...")
with open("src/index.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(", ctx: ExecutionContext)", ", _ctx: ExecutionContext)")
content = content.replace("export type { Environment };", "// export type { Environment }; // Already exported above")

with open("src/index.ts", "w", encoding="utf-8") as f:
    f.write(content)

# Fix auth/state.ts
print("Fixing auth/state.ts...")
with open("src/auth/state.ts", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "const stateTime = parseInt(timestamp);",
    "const stateTime = parseInt(timestamp || '0');"
)

with open("src/auth/state.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("All fixes applied successfully!")
