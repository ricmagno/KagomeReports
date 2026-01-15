SELECT DateTime, TagName, Value, Quality FROM History
WHERE TagName = 'MegaJouleCounter'
AND DateTime = GETDATE()
AND wwRetrievalMode = 'Cyclic'