from llm import settings

k = settings.api_key
print("LENGTH:", len(k) if k else 0)
print("STARTS:", repr(k[:12]) if k else None)
print("ENDS:", repr(k[-6:]) if k else None)
print("HAS_QUOTE:", ('"' in k or "'" in k) if k else None)
print("HAS_NEWLINE:", ("\n" in k or "\r" in k) if k else None)
print("IS_CONFIGURED:", settings.is_configured)